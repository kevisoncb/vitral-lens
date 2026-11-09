/**
 * Planos do Vitral (o banco tem a mesma regra em recursos_adicionais, migração 0023):
 *   Essencial R$ 99: consultório, loja, laboratório, agenda, clientes, estoque, site.
 *   Especial R$ 199: tudo do Essencial + PDV e caixa + notas fiscais.
 *   Loja extra: + R$ 49 cada. Notas fiscais avulsas no Essencial: preço a definir.
 */
export const PRECO_ESSENCIAL = 99;
export const PRECO_ESPECIAL = 199;
export const PRECO_LOJA_EXTRA = 49;

/** Recursos que um adicional libera junto. */
const INCLUI: Record<string, string[]> = { plano_especial: ["nota_fiscal"] };

/** Tudo o que a ótica tem liberado, a partir dos adicionais contratados. */
export function recursosLiberados(contratados: Iterable<string>): Set<string> {
  const todos = new Set<string>();
  for (const r of contratados) {
    todos.add(r);
    for (const extra of INCLUI[r] ?? []) todos.add(extra);
  }
  return todos;
}

export function nomeDoPlano(adicionais: Record<string, number>): "Essencial" | "Especial" {
  return adicionais.plano_especial ? "Especial" : "Essencial";
}

/** Mensalidade conhecida da ótica (sem as notas avulsas, que ainda não têm preço). */
export function mensalidade(adicionais: Record<string, number>): number {
  return (adicionais.plano_especial ? PRECO_ESPECIAL : PRECO_ESSENCIAL) + PRECO_LOJA_EXTRA * (adicionais.multiloja ?? 0);
}
