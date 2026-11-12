/**
 * Máscaras dos campos: a pessoa digita só os números e o campo se arruma sozinho.
 * Dinheiro e porcentagem enchem da direita para a esquerda, como na maquininha:
 * digitar 1, 2, 3, 4, 5 vira "123,45".
 */

export type Mascara = "moeda" | "porcentagem" | "cpf" | "cnpj" | "telefone" | "ncm" | "cest" | "cfop" | "cep" | "inteiro" | "digitos";

function digitos(t: string): string {
  return t.replace(/\D/g, "");
}

/** Número -> "1.234,56" (sem "R$"). */
export function formatarDecimal(n: number, casas = 2): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Texto com máscara -> número ("1.234,56" -> 1234.56; "-5,25" -> -5.25). Vazio -> null. */
export function lerDecimal(t: string | null | undefined): number | null {
  const s = (t ?? "").trim();
  if (!s) return null;
  const negativo = s.startsWith("-");
  const limpo = s.replace(/[^\d,.]/g, "");
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normal);
  if (!Number.isFinite(n) || normal === "") return null;
  return negativo ? -n : n;
}

/** Enche da direita: só os dígitos contam, as duas últimas são os centavos. Aceita "-" na frente quando negativo é permitido. */
function decimalDigitado(t: string, permitirNegativo: boolean, casas = 2): string {
  const negativo = permitirNegativo && t.trim().startsWith("-");
  const d = digitos(t).replace(/^0+(?=\d)/, "").slice(0, 13);
  if (!d) return negativo ? "-" : "";
  const n = Number(d) / 10 ** casas;
  return (negativo ? "-" : "") + formatarDecimal(n, casas);
}

function agrupar(d: string, partes: [number, string][]): string {
  let saida = "";
  let i = 0;
  for (const [tamanho, separador] of partes) {
    if (i >= d.length) break;
    saida += (i > 0 ? separador : "") + d.slice(i, i + tamanho);
    i += tamanho;
  }
  return saida;
}

/** Aplica a máscara ao que foi digitado. */
export function aplicarMascara(mascara: Mascara, t: string, permitirNegativo = false): string {
  const d = digitos(t);
  switch (mascara) {
    case "moeda":
    case "porcentagem":
      return decimalDigitado(t, permitirNegativo);
    case "inteiro":
      return d.replace(/^0+(?=\d)/, "").slice(0, 9);
    case "digitos": // códigos com zero na frente (CST, cClassTrib, inscrição estadual)
      return d.slice(0, 20);
    case "cpf":
      return agrupar(d.slice(0, 11), [[3, ""], [3, "."], [3, "."], [2, "-"]]);
    case "cnpj":
      return agrupar(d.slice(0, 14), [[2, ""], [3, "."], [3, "."], [4, "/"], [2, "-"]]);
    case "telefone": {
      const n = d.slice(0, 11);
      if (n.length <= 2) return n ? `(${n}` : "";
      const meio = n.length === 11 ? 5 : 4; // celular tem 9 dígitos depois do DDD
      return `(${n.slice(0, 2)}) ${n.slice(2, 2 + meio)}${n.length > 2 + meio ? `-${n.slice(2 + meio)}` : ""}`;
    }
    case "ncm":
      return agrupar(d.slice(0, 8), [[4, ""], [2, "."], [2, "."]]);
    case "cest":
      return agrupar(d.slice(0, 7), [[2, ""], [3, "."], [2, "."]]);
    case "cfop":
      return d.slice(0, 4);
    case "cep":
      return agrupar(d.slice(0, 8), [[5, ""], [3, "-"]]);
  }
}

/** Valor inicial (do banco) já com a máscara: números viram "1.234,56"; códigos ganham os pontos. */
export function valorInicial(mascara: Mascara, valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  if (mascara === "moeda" || mascara === "porcentagem") {
    const n = typeof valor === "number" ? valor : lerDecimal(String(valor));
    return n === null ? "" : formatarDecimal(n);
  }
  return aplicarMascara(mascara, String(valor));
}
