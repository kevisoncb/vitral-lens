import type { criarClienteServidor } from "@/lib/supabase/servidor";

type Cliente = Awaited<ReturnType<typeof criarClienteServidor>>;

/**
 * Registra que a pessoa logada viu dado de saúde do cliente (receita ou exame). LGPD: o dono vê na ficha
 * quem abriu. O banco ignora repetição em 10 minutos. Falha no registro não impede de mostrar a tela.
 */
export async function registrarAcessoSaude(supabase: Cliente, clienteId: string, acao: "viu_receita" | "viu_exame", origem: string) {
  await supabase.rpc("registrar_acesso_saude", { p_cliente: clienteId, p_acao: acao, p_origem: origem });
}

export const ROTULO_ACESSO: Record<string, string> = {
  viu_receita: "viu a receita",
  viu_exame: "viu o exame",
  exportou: "exportou os dados",
  anonimizou: "anonimizou o cliente",
};
