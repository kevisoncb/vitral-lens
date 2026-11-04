/**
 * Leitura do XML da NF-e do fornecedor (o arquivo que vem por e-mail junto com o DANFE), para dar
 * entrada no estoque sem digitar item por item. Roda no navegador e nos testes (sem DOMParser).
 */

export type ItemNfe = {
  /** código que vai para o catálogo: o EAN (código de barras) quando a nota traz, senão o código do fornecedor */
  codigo: string;
  codigoFornecedor: string;
  ean: string | null;
  nome: string;
  ncm: string | null;
  unidade: string | null;
  quantidade: number;
  custo: number; // valor unitário
  categoria: string; // chave do catálogo, deduzida do NCM
};

export type DuplicataNfe = { numero: string | null; vencimento: string; valor: number };

export type NotaFiscal = {
  chave: string | null;
  numero: string;
  serie: string | null;
  emissao: string | null; // aaaa-mm-dd
  fornecedor: string;
  cnpj: string | null;
  valorTotal: number;
  itens: ItemNfe[];
  duplicatas: DuplicataNfe[];
};

function texto(t: string): string {
  return t
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();
}

/** Conteúdo da primeira tag com esse nome (aceita prefixo de namespace, ex.: <nfe:xProd>). */
function tag(xml: string, nome: string): string | null {
  const m = new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`).exec(xml);
  return m ? texto(m[1]) : null;
}

function blocos(xml: string, nome: string): string[] {
  return xml.match(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>[\\s\\S]*?</(?:\\w+:)?${nome}>`, "g")) ?? [];
}

/** NCM -> categoria do catálogo. 9003 armações, 9004 óculos de sol, 9001.30 lente de contato, 9001.40/50 lentes. */
export function categoriaPorNcm(ncm: string | null): string {
  const n = (ncm ?? "").replace(/\D/g, "");
  if (n.startsWith("9003") || n.startsWith("9004")) return "armacao";
  if (n.startsWith("900130")) return "lente_contato";
  if (n.startsWith("900140") || n.startsWith("900150")) return "lente";
  return "acessorio";
}

/** "SEM GTIN" e códigos inválidos não servem de código de barras. */
function eanValido(ean: string | null): string | null {
  const e = (ean ?? "").trim();
  return /^\d{8}$|^\d{12,14}$/.test(e) ? e : null;
}

export function lerNfe(xml: string): NotaFiscal {
  const inf = blocos(xml, "infNFe")[0];
  if (!inf) throw new Error("Este arquivo não é o XML de uma NF-e (não achei a nota dentro dele).");
  const ide = blocos(inf, "ide")[0] ?? "";
  const emit = blocos(inf, "emit")[0] ?? "";

  const itens = blocos(inf, "det").map((det): ItemNfe => {
    const prod = blocos(det, "prod")[0] ?? det;
    const ean = eanValido(tag(prod, "cEAN")) ?? eanValido(tag(prod, "cEANTrib"));
    const codigoFornecedor = tag(prod, "cProd") ?? "";
    const ncm = tag(prod, "NCM");
    return {
      codigo: (ean ?? codigoFornecedor).slice(0, 40),
      codigoFornecedor,
      ean,
      nome: (tag(prod, "xProd") ?? "").slice(0, 160),
      ncm,
      unidade: tag(prod, "uCom"),
      quantidade: Number(tag(prod, "qCom") ?? 0),
      custo: Math.round(Number(tag(prod, "vUnCom") ?? 0) * 100) / 100,
      categoria: categoriaPorNcm(ncm),
    };
  });
  if (itens.length === 0) throw new Error("A nota não tem produtos.");

  const duplicatas = blocos(inf, "dup").map((d) => ({
    numero: tag(d, "nDup"),
    vencimento: (tag(d, "dVenc") ?? "").slice(0, 10),
    valor: Number(tag(d, "vDup") ?? 0),
  })).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.vencimento) && d.valor > 0);

  // a chave vem no Id="NFe<44 dígitos>" ou no protocolo de autorização
  const chave = /Id="NFe(\d{44})"/.exec(inf)?.[1] ?? tag(xml, "chNFe");

  return {
    chave: chave && /^\d{44}$/.test(chave) ? chave : null,
    numero: tag(ide, "nNF") ?? "",
    serie: tag(ide, "serie"),
    emissao: (tag(ide, "dhEmi") ?? tag(ide, "dEmi"))?.slice(0, 10) ?? null,
    fornecedor: tag(emit, "xFant") ?? tag(emit, "xNome") ?? "Fornecedor",
    cnpj: tag(emit, "CNPJ") ?? tag(emit, "CPF"),
    valorTotal: Number(tag(blocos(inf, "ICMSTot")[0] ?? "", "vNF") ?? 0),
    itens,
    duplicatas,
  };
}
