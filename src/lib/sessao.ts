import { cache } from "react";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { pode, type Acao, type Modulo, type Permissoes } from "@/lib/permissoes";
import { INICIO_DA_AREA, type Area } from "@/lib/areas";

export type Sessao = {
  usuarioId: string;
  nome: string;
  oticaId: string;
  oticaNome: string;
  perfilNome: string;
  area: Area;
  permissoes: Permissoes;
  pode: (modulo: Modulo, acao?: Acao) => boolean;
};

type Linha = {
  nome: string;
  otica_id: string;
  perfis: { nome: string; area: Area; permissoes: Permissoes } | null;
  oticas: { nome: string } | null;
};

/**
 * Quem está logado, a área e o que pode fazer. Serve para montar a tela e esconder botões:
 * quem decide de verdade é o banco (RLS e acesso()).
 */
export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("usuarios")
    .select("nome, otica_id, perfis(nome, area, permissoes), oticas(nome)")
    .eq("id", user.id)
    .maybeSingle<Linha>();
  if (!data || !data.perfis || !data.oticas) return null;
  const permissoes = data.perfis.permissoes ?? {};
  return {
    usuarioId: user.id,
    nome: data.nome,
    oticaId: data.otica_id,
    oticaNome: data.oticas.nome,
    perfilNome: data.perfis.nome,
    area: data.perfis.area ?? "loja",
    permissoes,
    pode: (modulo, acao = "ver") => pode(permissoes, modulo, acao),
  };
});

/**
 * Garante que quem está na tela é da área certa (ou da gestão, que entra em todas).
 * Quem é de outra área volta para a tela dela.
 */
export async function exigirArea(...areas: Area[]): Promise<Sessao> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  if (sessao.area !== "gestao" && !areas.includes(sessao.area)) {
    redirect(INICIO_DA_AREA[sessao.area]);
  }
  return sessao;
}
