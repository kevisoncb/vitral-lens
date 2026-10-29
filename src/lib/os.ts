import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartaoOS, EtapaOS } from "@/components/os/quadro-os";

type LinhaOS = {
  id: string;
  numero: number;
  etapa_id: string;
  descricao: string;
  lente: string | null;
  cliente_nome: string | null;
  laboratorio_nome: string | null;
  data_prometida: string | null;
  garantia_ate: string | null;
  retrabalho: boolean;
  etapa_desde: string;
  responsavel: { nome: string } | null;
  os_mensagens: { count: number }[];
};

/**
 * Busca as etapas e os cards de OS. O telefone do cliente só vem para quem pode ver clientes
 * (a loja); o laboratório recebe só o nome gravado na própria OS.
 */
export async function carregarQuadroOS(supabase: SupabaseClient, comTelefone: boolean, etapasFiltro?: (e: EtapaOS) => boolean) {
  const [etapasR, osR] = await Promise.all([
    supabase.from("os_etapas").select("id, nome, final, avisa_cliente, area").order("ordem"),
    supabase
      .from("ordens_servico")
      .select(
        "id, numero, etapa_id, descricao, lente, cliente_nome, laboratorio_nome, data_prometida, garantia_ate, retrabalho, etapa_desde, " +
          "responsavel:usuarios!ordens_servico_responsavel_lab_id_fkey(nome), os_mensagens(count)",
      )
      .order("data_prometida", { ascending: true, nullsFirst: false })
      .limit(500)
      .returns<LinhaOS[]>(),
  ]);

  let etapas: EtapaOS[] = (etapasR.data ?? []).map((e) => ({
    id: e.id as string,
    nome: e.nome as string,
    final: e.final as boolean,
    avisaCliente: e.avisa_cliente as boolean,
    area: e.area as "loja" | "laboratorio",
  }));
  if (etapasFiltro) etapas = etapas.filter(etapasFiltro);
  const visiveis = new Set(etapas.map((e) => e.id));

  let telefones = new Map<string, string | null>();
  if (comTelefone) {
    const ids = (osR.data ?? []).map((o) => o.id);
    if (ids.length > 0) {
      const { data } = await supabase
        .from("ordens_servico")
        .select("id, clientes(telefone)")
        .in("id", ids)
        .returns<{ id: string; clientes: { telefone: string | null } | null }[]>();
      telefones = new Map((data ?? []).map((o) => [o.id, o.clientes?.telefone ?? null]));
    }
  }

  const cartoes: CartaoOS[] = (osR.data ?? [])
    .filter((o) => visiveis.has(o.etapa_id))
    .map((o) => ({
      id: o.id,
      numero: o.numero,
      etapaId: o.etapa_id,
      cliente: o.cliente_nome ?? "Cliente",
      telefone: telefones.get(o.id) ?? null,
      descricao: o.descricao,
      lente: o.lente,
      laboratorio: o.laboratorio_nome,
      responsavelLab: o.responsavel?.nome ?? null,
      prometida: o.data_prometida,
      garantiaAte: o.garantia_ate,
      retrabalho: o.retrabalho,
      recados: o.os_mensagens?.[0]?.count ?? 0,
      desde: o.etapa_desde,
    }));

  return { etapas, cartoes };
}

export type DetalheOS = {
  id: string;
  numero: number;
  cliente_id: string;
  cliente_nome: string | null;
  descricao: string;
  etapa_id: string;
  data_prometida: string | null;
  data_entrega: string | null;
  garantia_ate: string | null;
  laboratorio_nome: string | null;
  retrabalho: boolean;
  motivo_retrabalho: string | null;
  receita_id: string | null;
  lente: string | null;
  tratamentos: string | null;
  armacao: string | null;
  armacao_tipo: string | null;
  aro: number | null;
  ponte: number | null;
  diagonal_maior: number | null;
  dnp_od: number | null;
  dnp_oe: number | null;
  altura_od: number | null;
  altura_oe: number | null;
  obs_tecnica: string | null;
  puxada_em: string | null;
  responsavel: { nome: string } | null;
  os_etapas: { nome: string } | null;
};

export const NOME_ETAPA_PRODUCAO: Record<string, string> = {
  surfacagem: "Surfaçagem",
  tratamento: "Tratamento (antirreflexo etc.)",
  coloracao: "Coloração",
  corte: "Corte / bisotê",
  montagem: "Montagem",
  conferencia: "Conferência",
};

/** Tudo da OS para a tela de detalhe: ficha, grau, produção, histórico e etapas. */
export async function carregarOS(supabase: SupabaseClient, id: string) {
  const { data: os } = await supabase
    .from("ordens_servico")
    .select("*, responsavel:usuarios!ordens_servico_responsavel_lab_id_fkey(nome), os_etapas(nome)")
    .eq("id", id)
    .maybeSingle<DetalheOS>();
  if (!os) return null;

  const [olhosR, producaoR, historicoR, etapasR] = await Promise.all([
    os.receita_id
      ? supabase.from("receita_olhos").select("olho, distancia, esferico, cilindrico, eixo, adicao").eq("receita_id", os.receita_id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("os_producao")
      .select("id, etapa, aprovado, observacao, feito_em, usuarios(nome)")
      .eq("os_id", id)
      .order("feito_em")
      .returns<{ id: string; etapa: string; aprovado: boolean; observacao: string | null; feito_em: string; usuarios: { nome: string } | null }[]>(),
    supabase
      .from("os_historico")
      .select("id, em, usuarios(nome), para:os_etapas!os_historico_para_etapa_fkey(nome)")
      .eq("os_id", id)
      .order("em")
      .returns<{ id: string; em: string; usuarios: { nome: string } | null; para: { nome: string } | null }[]>(),
    supabase.from("os_etapas").select("id, nome, area, ordem").order("ordem"),
  ]);

  return {
    os,
    olhos: (olhosR.data ?? []) as import("@/components/os/ficha-tecnica").OlhoReceita[],
    producao: producaoR.data ?? [],
    historico: historicoR.data ?? [],
    etapas: (etapasR.data ?? []) as { id: string; nome: string; area: "loja" | "laboratorio"; ordem: number }[],
  };
}
