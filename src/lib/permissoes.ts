export type Modulo =
  | "clientes"
  | "receitas"
  | "vendas"
  | "laboratorio"
  | "agenda"
  | "catalogo"
  | "relatorios"
  | "pdv"
  | "financeiro"
  | "usuarios"
  | "configuracoes";

export type Acao = "ver" | "criar" | "editar" | "excluir";

/** Formato guardado em perfis.permissoes: { clientes: ["ver", "criar"], ... } */
export type Permissoes = Partial<Record<Modulo, Acao[]>>;

export function pode(permissoes: Permissoes, modulo: Modulo, acao: Acao = "ver"): boolean {
  return permissoes[modulo]?.includes(acao) ?? false;
}

/**
 * Módulos que dependem do plano. A lista real vem da tabela plano_recursos;
 * aqui só calculamos o que o plano da ótica libera.
 */
export function moduloLiberado(
  modulo: Modulo,
  recursosDoPlano: Set<string>,
  recursosControlados: Set<string>,
): boolean {
  if (!recursosControlados.has(modulo)) return true;
  return recursosDoPlano.has(modulo);
}

/** modulo null = sempre visível para quem está logado. */
export type ItemMenu = { modulo: Modulo | null; rotulo: string; href: string };

/** Ordem do menu lateral. Telas de PDV e financeiro entram na Versão 4. */
export const MENU: ItemMenu[] = [
  { modulo: null, rotulo: "Início", href: "/inicio" },
  { modulo: "vendas", rotulo: "Vendas", href: "/vendas" },
  { modulo: "laboratorio", rotulo: "Laboratório", href: "/laboratorio" },
  { modulo: "clientes", rotulo: "Clientes", href: "/clientes" },
  { modulo: "agenda", rotulo: "Agenda", href: "/agenda" },
  { modulo: "catalogo", rotulo: "Catálogo", href: "/catalogo" },
  { modulo: "financeiro", rotulo: "Financeiro", href: "/financeiro" },
  { modulo: "relatorios", rotulo: "Relatórios", href: "/relatorios" },
  { modulo: "configuracoes", rotulo: "Configurações", href: "/configuracoes" },
];
