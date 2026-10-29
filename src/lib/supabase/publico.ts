import { createClient } from "@supabase/supabase-js";

/**
 * Cliente sem login (papel anon) para o site público da ótica.
 * Só consegue chamar as funções liberadas para anon: site_da_otica, pedido_orcamento_site,
 * horarios_livres e agendar_pelo_site. Não lê nenhuma tabela.
 */
export function criarClientePublico() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type DadosSite = {
  nome: string;
  titulo: string | null;
  sobre: string | null;
  endereco: string | null;
  whatsapp: string | null;
  horario: string | null;
  instagram: string | null;
  cor: string | null;
  logo_url: string | null;
  agendamento_online: boolean;
};

export async function buscarSite(slug: string): Promise<DadosSite | null> {
  const { data } = await criarClientePublico().rpc("site_da_otica", { p_slug: slug });
  const linhas = (data ?? []) as DadosSite[];
  return linhas[0] ?? null;
}
