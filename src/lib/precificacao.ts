/**
 * Conta do custo e do preço do produto (a mesma da coluna custo_final do banco).
 * Insumos e impostos da compra podem estar em reais (como vieram na nota) ou em % da compra.
 * Margem é % sobre o custo final: custo R$ 100 com margem 30% = venda R$ 130.
 */

export type Tipo = "reais" | "porcentagem";

const centavos = (n: number) => Math.round(n * 100) / 100;

/** Valor da parte em reais por unidade. */
export function emReais(compra: number, valor: number, tipo: Tipo): number {
  return tipo === "porcentagem" ? (compra * valor) / 100 : valor;
}

export function custoFinal(compra: number, insumos: number, insumosTipo: Tipo, impostos: number, impostosTipo: Tipo): number {
  return centavos(compra + emReais(compra, insumos, insumosTipo) + emReais(compra, impostos, impostosTipo));
}

/** Troca R$ por % (ou o contrário) mantendo o mesmo valor em dinheiro. */
export function converter(valor: number, de: Tipo, para: Tipo, compra: number): number {
  if (de === para) return valor;
  if (para === "porcentagem") return compra > 0 ? centavos((valor / compra) * 100) : 0;
  return centavos((compra * valor) / 100);
}

export function precoPelaMargem(custo: number, margem: number): number {
  return centavos(custo * (1 + margem / 100));
}

/** Margem (% sobre o custo) que um preço dá. null quando não há custo. */
export function margemPeloPreco(custo: number, preco: number): number | null {
  return custo > 0 ? centavos((preco / custo - 1) * 100) : null;
}
