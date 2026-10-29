import { cache } from "react";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { pode, type Acao, type Modulo, type Permissoes } from "@/lib/permissoes";

export type Sessao = {
  usuarioId: string;
  nome: string;
  oticaId: string;
  permissoes: Permissoes;
  pode: (modulo: Modulo, acao?: Acao) => boolean;
};

/**
 * Quem está logado e o que pode fazer. Serve só para esconder botões:
 * quem decide de verdade é o banco (RLS e acesso()).
 */
export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("usuarios")
    .select("nome, otica_id, perfis(permissoes)")
    .eq("id", user.id)
    .maybeSingle<{ nome: string; otica_id: string; perfis: { permissoes: Permissoes } | null }>();
  if (!data) return null;
  const permissoes = data.perfis?.permissoes ?? {};
  return {
    usuarioId: user.id,
    nome: data.nome,
    oticaId: data.otica_id,
    permissoes,
    pode: (modulo, acao = "ver") => pode(permissoes, modulo, acao),
  };
});
