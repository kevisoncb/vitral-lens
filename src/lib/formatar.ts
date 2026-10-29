export function moeda(valor: number | string | null | undefined): string {
  return Number(valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "2026-10-29" ou ISO completo -> "29/10/2026" (sem mudar o dia por fuso). */
export function dataBR(valor: string | null | undefined): string {
  if (!valor) return "—";
  const [ano, mes, dia] = valor.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function dataHoraBR(valor: string | null | undefined): string {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Número de grau com sinal: 1.5 -> "+1,50"; -2 -> "-2,00". */
export function grau(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const n = Number(valor);
  return `${n > 0 ? "+" : ""}${n.toFixed(2).replace(".", ",")}`;
}

/** Converte "1,25" ou "1.25" em número; vazio vira null. */
export function numeroOuNulo(texto: FormDataEntryValue | null): number | null {
  const t = String(texto ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function textoOuNulo(texto: FormDataEntryValue | null): string | null {
  const t = String(texto ?? "").trim();
  return t === "" ? null : t;
}
