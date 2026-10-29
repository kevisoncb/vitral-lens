export type Modulo =
  | "clientes"
  | "consultorio"
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
 * modulo null = sempre visível para quem está logado.
 * soGestao = atalho para a tela de outra área (consultório, produção), só para a gestão.
 */
export type ItemMenu = { modulo: Modulo | null; rotulo: string; href: string; soGestao?: boolean };

/** Menu lateral da loja e da gestão. Consultório e laboratório têm telas próprias. */
export const MENU: ItemMenu[] = [
  { modulo: null, rotulo: "Início", href: "/inicio" },
  { modulo: "vendas", rotulo: "Vendas", href: "/vendas" },
  { modulo: "laboratorio", rotulo: "Ordens de serviço", href: "/laboratorio" },
  { modulo: "clientes", rotulo: "Clientes", href: "/clientes" },
  { modulo: "agenda", rotulo: "Agenda", href: "/agenda" },
  { modulo: "catalogo", rotulo: "Catálogo", href: "/catalogo" },
  { modulo: "consultorio", rotulo: "Consultório", href: "/consultorio", soGestao: true },
  { modulo: "laboratorio", rotulo: "Produção (laboratório)", href: "/producao", soGestao: true },
  { modulo: "financeiro", rotulo: "Financeiro", href: "/financeiro" },
  { modulo: "relatorios", rotulo: "Relatórios", href: "/relatorios" },
  { modulo: "configuracoes", rotulo: "Configurações", href: "/configuracoes" },
];
