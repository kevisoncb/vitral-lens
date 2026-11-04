"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { cancelarNfce, emitirNfce, urlArquivo, type Ambiente } from "@/lib/focus-nfe";
import type { Json } from "@/lib/supabase/tipos";

export type ResultadoNota = { ok: boolean; mensagem: string; danfe?: string | null };

type Preparada = { nota_id: string; referencia: string; ambiente: Ambiente; token: string; dados: Record<string, unknown> };

/** Emite a NFC-e da venda: o banco prepara e confere, a Focus NFe manda para a SEFAZ, o banco guarda o retorno. */
export async function emitirNota(vendaId: string): Promise<ResultadoNota> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("preparar_nfce", { p_venda: vendaId });
  if (error) return { ok: false, mensagem: error.message };
  const n = data as unknown as Preparada;

  const retorno = await emitirNfce(n.token, n.ambiente, n.referencia, n.dados);
  // sem resposta: a nota segue pendente; tentar de novo usa a mesma referência e não duplica
  if (retorno.semResposta) return { ok: false, mensagem: retorno.mensagem ?? "Sem resposta do emissor. Tente de novo." };

  const { data: situacao, error: erroRetorno } = await supabase.rpc("registrar_retorno_nfce", {
    p_nota: n.nota_id,
    p_retorno: retorno as unknown as Json,
  });
  revalidatePath("/pdv");
  revalidatePath("/pdv/vendas");
  if (erroRetorno) return { ok: false, mensagem: erroRetorno.message };
  if (situacao === "autorizada") {
    const ambiente = n.ambiente === "homologacao" ? " (ambiente de teste, sem valor fiscal)" : "";
    return { ok: true, mensagem: `NFC-e ${retorno.numero ?? ""} autorizada${ambiente}.`, danfe: urlArquivo(n.ambiente, retorno.caminho_danfe) };
  }
  return { ok: false, mensagem: `Nota rejeitada: ${retorno.mensagem ?? "sem motivo informado"}. Corrija e emita de novo.` };
}

/** Cancela a NFC-e (gerente, até 30 minutos depois de autorizada). */
export async function cancelarNota(notaId: string, justificativa: string): Promise<ResultadoNota> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("preparar_cancelamento_nfce", { p_nota: notaId, p_justificativa: justificativa });
  if (error) return { ok: false, mensagem: error.message };
  const c = data as unknown as { referencia: string; ambiente: Ambiente; token: string };

  const retorno = await cancelarNfce(c.token, c.ambiente, c.referencia, justificativa.trim());
  if (retorno.semResposta) return { ok: false, mensagem: retorno.mensagem ?? "Sem resposta do emissor. Tente de novo." };
  const cancelada = retorno.status === "cancelado";
  await supabase.rpc("registrar_cancelamento_nfce", {
    p_nota: notaId,
    p_justificativa: justificativa,
    p_cancelado: cancelada,
    p_mensagem: retorno.mensagem ?? (cancelada ? "Cancelamento homologado" : "Cancelamento recusado"),
  });
  revalidatePath("/pdv/vendas");
  return cancelada
    ? { ok: true, mensagem: "NFC-e cancelada na SEFAZ." }
    : { ok: false, mensagem: `A SEFAZ não aceitou o cancelamento: ${retorno.mensagem ?? "sem motivo informado"}.` };
}
