/** Cada perfil trabalha numa área, e cada área tem a sua tela. */
export type Area = "loja" | "consultorio" | "laboratorio" | "gestao";

export const ROTULO_AREA: Record<Area, string> = {
  loja: "Loja (balcão)",
  consultorio: "Consultório",
  laboratorio: "Laboratório",
  gestao: "Gestão",
};

/** Para onde cada área vai depois do login. */
export const INICIO_DA_AREA: Record<Area, string> = {
  loja: "/inicio",
  gestao: "/inicio",
  consultorio: "/consultorio",
  laboratorio: "/producao",
};
