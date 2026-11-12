/** Cada perfil trabalha numa área, e cada área tem a sua tela. */
export type Area = "loja" | "consultorio" | "laboratorio" | "gestao" | "pdv" | "financeiro";

export const ROTULO_AREA: Record<Area, string> = {
  loja: "Loja (balcão)",
  consultorio: "Consultório",
  laboratorio: "Laboratório",
  gestao: "Gestão",
  pdv: "PDV (caixa)",
  financeiro: "Financeiro",
};

/** Para onde cada área vai depois do login. */
export const INICIO_DA_AREA: Record<Area, string> = {
  loja: "/inicio",
  gestao: "/inicio",
  consultorio: "/consultorio",
  laboratorio: "/producao",
  pdv: "/pdv",
  financeiro: "/financeiro",
};
