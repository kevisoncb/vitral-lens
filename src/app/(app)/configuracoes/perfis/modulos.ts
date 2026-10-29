import type { Acao, Modulo } from "@/lib/permissoes";

export const ACOES: Acao[] = ["ver", "criar", "editar", "excluir"];

export const MODULOS_CONFIGURAVEIS: { modulo: Modulo; rotulo: string }[] = [
  { modulo: "clientes", rotulo: "Clientes" },
  { modulo: "receitas", rotulo: "Receitas" },
  { modulo: "consultorio", rotulo: "Consultório (exames)" },
  { modulo: "vendas", rotulo: "Vendas (funil e valores)" },
  { modulo: "laboratorio", rotulo: "Laboratório (excluir = gerente do lab)" },
  { modulo: "agenda", rotulo: "Agenda" },
  { modulo: "catalogo", rotulo: "Catálogo" },
  { modulo: "estoque", rotulo: "Estoque (criar = entrada; editar = saída, ajuste, transferência)" },
  { modulo: "comissoes", rotulo: "Comissões (ver = só as próprias; editar = todas, regras e pagamento)" },
  { modulo: "relatorios", rotulo: "Relatórios" },
  { modulo: "pdv", rotulo: "PDV (Versão 4)" },
  { modulo: "financeiro", rotulo: "Financeiro (Versão 4)" },
  { modulo: "usuarios", rotulo: "Usuários e perfis" },
  { modulo: "configuracoes", rotulo: "Configurações" },
];
