import type { Acao, Modulo } from "@/lib/permissoes";

export const ACOES: Acao[] = ["ver", "criar", "editar", "excluir"];

export const MODULOS_CONFIGURAVEIS: { modulo: Modulo; rotulo: string }[] = [
  { modulo: "clientes", rotulo: "Clientes" },
  { modulo: "receitas", rotulo: "Receitas" },
  { modulo: "vendas", rotulo: "Vendas (funil e valores)" },
  { modulo: "laboratorio", rotulo: "Laboratório" },
  { modulo: "agenda", rotulo: "Agenda" },
  { modulo: "catalogo", rotulo: "Catálogo" },
  { modulo: "relatorios", rotulo: "Relatórios" },
  { modulo: "pdv", rotulo: "PDV (Versão 4)" },
  { modulo: "financeiro", rotulo: "Financeiro (Versão 4)" },
  { modulo: "usuarios", rotulo: "Usuários e perfis" },
  { modulo: "configuracoes", rotulo: "Configurações" },
];
