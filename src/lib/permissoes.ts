export type Modulo =
  | "clientes"
  | "consultorio"
  | "receitas"
  | "vendas"
  | "laboratorio"
  | "agenda"
  | "catalogo"
  | "estoque"
  | "comissoes"
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
 * adicional = recurso pago à parte (recursos_adicionais): aparece no menu com o selo "adicional" enquanto a ótica não tem.
 */
export type ItemMenu = { modulo: Modulo | null; rotulo: string; href: string; soGestao?: boolean; adicional?: string };
export type SecaoMenu = { titulo: string | null; itens: ItemMenu[] };

/**
 * Menu lateral da loja e da gestão, separado por assunto: cada coisa no seu lugar
 * (venda é venda, cliente é cliente, produto é produto). Consultório e laboratório têm telas próprias.
 */
export const MENU: SecaoMenu[] = [
  { titulo: null, itens: [{ modulo: null, rotulo: "Início", href: "/inicio" }] },
  {
    titulo: "Atendimento",
    itens: [
      { modulo: "vendas", rotulo: "Vendas", href: "/vendas" },
      { modulo: "agenda", rotulo: "Agenda", href: "/agenda" },
      { modulo: "laboratorio", rotulo: "Ordens de serviço", href: "/laboratorio" },
    ],
  },
  { titulo: "Clientes", itens: [{ modulo: "clientes", rotulo: "Clientes", href: "/clientes" }] },
  {
    titulo: "Produtos",
    itens: [
      { modulo: "catalogo", rotulo: "Produtos", href: "/catalogo" },
      { modulo: "estoque", rotulo: "Estoque", href: "/estoque" },
      { modulo: "estoque", rotulo: "Entrada pela nota", href: "/estoque/nota", adicional: "nota_fiscal" },
      { modulo: "catalogo", rotulo: "Etiquetas", href: "/catalogo/etiquetas" },
    ],
  },
  {
    titulo: "Equipe e resultados",
    itens: [
      { modulo: "comissoes", rotulo: "Comissões", href: "/comissoes" },
      { modulo: "relatorios", rotulo: "Relatórios", href: "/relatorios" },
    ],
  },
  {
    titulo: "Outras áreas",
    itens: [
      { modulo: "consultorio", rotulo: "Consultório", href: "/consultorio", soGestao: true },
      { modulo: "laboratorio", rotulo: "Produção (laboratório)", href: "/producao", soGestao: true },
      { modulo: "pdv", rotulo: "PDV (caixa)", href: "/pdv", soGestao: true },
      { modulo: "financeiro", rotulo: "Financeiro", href: "/financeiro", soGestao: true },
    ],
  },
  { titulo: "Ajustes", itens: [{ modulo: "configuracoes", rotulo: "Configurações", href: "/configuracoes" }] },
];
