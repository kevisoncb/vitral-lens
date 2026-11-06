/**
 * Conversa com a API da Focus NFe (https://doc.focusnfe.com.br). Só no servidor: recebe o token da
 * ótica, que nunca vai para o navegador. A NFC-e é síncrona: a resposta já diz se a SEFAZ autorizou.
 *
 * Autenticação: HTTP Basic com o token como usuário e senha vazia.
 * Emitir:    POST   /v2/nfce?ref=REFERENCIA
 * Consultar: GET    /v2/nfce/REFERENCIA
 * Cancelar:  DELETE /v2/nfce/REFERENCIA  {"justificativa": "..."} (até 30 minutos, 15 a 255 letras)
 */

export type Ambiente = "homologacao" | "producao";

export type RetornoNfce = {
  status: "autorizado" | "erro_autorizacao" | "cancelado" | "erro_cancelamento" | "erro";
  mensagem: string | null;
  numero?: string;
  serie?: string;
  chave_nfe?: string;
  caminho_xml_nota_fiscal?: string;
  caminho_danfe?: string;
  qrcode_url?: string;
  /** a requisição não chegou ou não voltou: a nota continua pendente e pode ser tentada de novo */
  semResposta?: boolean;
};

type Fetch = typeof fetch;

export function urlBase(ambiente: Ambiente): string {
  return ambiente === "producao" ? "https://api.focusnfe.com.br/v2" : "https://homologacao.focusnfe.com.br/v2";
}

/** Os caminhos da Focus (XML, DANFCe) vêm relativos ao domínio da API. */
export function urlArquivo(ambiente: Ambiente, caminho: string | null | undefined): string | null {
  if (!caminho) return null;
  if (/^https?:\/\//.test(caminho)) return caminho;
  return urlBase(ambiente).replace(/\/v2$/, "") + caminho;
}

function cabecalhos(token: string): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`,
    "Content-Type": "application/json",
  };
}

/** Hora de emissão no fuso de Brasília (a SEFAZ aceita no máximo 5 minutos de diferença). */
export function dataEmissao(agora = new Date()): string {
  const local = new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 19);
  return `${local}-03:00`;
}

async function lerJson(resposta: Response): Promise<Record<string, unknown>> {
  try {
    return (await resposta.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizar(corpo: Record<string, unknown>, padrao: RetornoNfce["status"]): RetornoNfce {
  const texto = (k: string) => (typeof corpo[k] === "string" ? (corpo[k] as string) : undefined);
  const erros = Array.isArray(corpo.erros) ? (corpo.erros as { mensagem?: string }[]).map((e) => e.mensagem).filter(Boolean).join("; ") : "";
  const status = (texto("status") as RetornoNfce["status"]) ?? padrao;
  return {
    status,
    mensagem: texto("mensagem_sefaz") ?? (erros || texto("mensagem")) ?? null,
    numero: texto("numero"),
    serie: texto("serie"),
    chave_nfe: texto("chave_nfe"),
    caminho_xml_nota_fiscal: texto("caminho_xml_nota_fiscal"),
    caminho_danfe: texto("caminho_danfe"),
    qrcode_url: texto("qrcode_url"),
  };
}

export async function consultarNfce(token: string, ambiente: Ambiente, referencia: string, f: Fetch = fetch): Promise<RetornoNfce> {
  const r = await f(`${urlBase(ambiente)}/nfce/${encodeURIComponent(referencia)}`, { headers: cabecalhos(token), cache: "no-store" });
  return normalizar(await lerJson(r), r.ok ? "erro_autorizacao" : "erro");
}

/**
 * Emite a NFC-e. Se a Focus disser que essa referência já foi processada (ex.: a primeira tentativa
 * caiu antes da resposta), consulta e devolve o resultado dela, sem emitir outra.
 */
export async function emitirNfce(
  token: string,
  ambiente: Ambiente,
  referencia: string,
  dados: Record<string, unknown>,
  f: Fetch = fetch,
): Promise<RetornoNfce> {
  let r: Response;
  try {
    r = await f(`${urlBase(ambiente)}/nfce?ref=${encodeURIComponent(referencia)}`, {
      method: "POST",
      headers: cabecalhos(token),
      body: JSON.stringify({ ...dados, data_emissao: dataEmissao() }),
      cache: "no-store",
    });
  } catch {
    return { status: "erro", mensagem: "Sem conexão com o emissor de notas. Tente de novo em instantes.", semResposta: true };
  }
  if (r.status >= 500) return { status: "erro", mensagem: "O emissor de notas está fora do ar. Tente de novo em instantes.", semResposta: true };
  const corpo = await lerJson(r);
  if (corpo.codigo === "already_processed" || corpo.codigo === "pending_operation") {
    return consultarNfce(token, ambiente, referencia, f);
  }
  if (!r.ok && !corpo.status) {
    const n = normalizar(corpo, "erro");
    return { ...n, mensagem: n.mensagem ?? `O emissor recusou a nota (HTTP ${r.status}).` };
  }
  return normalizar(corpo, "erro_autorizacao");
}

export async function cancelarNfce(token: string, ambiente: Ambiente, referencia: string, justificativa: string, f: Fetch = fetch): Promise<RetornoNfce> {
  try {
    const r = await f(`${urlBase(ambiente)}/nfce/${encodeURIComponent(referencia)}`, {
      method: "DELETE",
      headers: cabecalhos(token),
      body: JSON.stringify({ justificativa }),
      cache: "no-store",
    });
    return normalizar(await lerJson(r), r.ok ? "erro_cancelamento" : "erro");
  } catch {
    return { status: "erro", mensagem: "Sem conexão com o emissor de notas. Tente de novo em instantes.", semResposta: true };
  }
}
