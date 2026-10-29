"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

/** Ações da ordem de serviço, usadas pela loja (/laboratorio) e pelo laboratório (/producao). */

export type Resultado = { ok: true } | { ok: false; erro: string };

function atualizarTelas(osId?: string) {
  revalidatePath("/laboratorio");
  revalidatePath("/producao");
  if (osId) {
    revalidatePath(`/laboratorio/${osId}`);
    revalidatePath(`/producao/os/${osId}`);
  }
}

/** Move a OS. O banco confere se a etapa é da área de quem move (trigger os_etapa_permitida). */
export async function moverOS(id: string, etapaId: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("ordens_servico").update({ etapa_id: etapaId }).eq("id", id).select("id");
  if (error) return { ok: false, erro: error.message };
  if (!data || data.length === 0) return { ok: false, erro: "Você não tem permissão para mover esta ordem." };
  atualizarTelas(id);
  return { ok: true };
}

export async function moverOSFormulario(id: string, etapaId: string) {
  await moverOS(id, etapaId);
}

export async function enviarRecado(osId: string, formulario: FormData) {
  const texto = textoOuNulo(formulario.get("texto"));
  if (!texto) return;
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("os_mensagens").insert({ os_id: osId, texto: texto.slice(0, 1000), autor_id: user?.id });
  atualizarTelas(osId);
}

const TIPOS_ARMACAO = ["aro_fechado", "fio_nylon", "parafusada", "outro"];

export async function salvarFicha(osId: string, formulario: FormData) {
  const tipo = String(formulario.get("armacao_tipo") ?? "");
  const supabase = await criarClienteServidor();
  await supabase
    .from("ordens_servico")
    .update({
      lente: textoOuNulo(formulario.get("lente")),
      tratamentos: textoOuNulo(formulario.get("tratamentos")),
      armacao: textoOuNulo(formulario.get("armacao")),
      armacao_tipo: TIPOS_ARMACAO.includes(tipo) ? tipo : null,
      aro: numeroOuNulo(formulario.get("aro")),
      ponte: numeroOuNulo(formulario.get("ponte")),
      diagonal_maior: numeroOuNulo(formulario.get("diagonal_maior")),
      dnp_od: numeroOuNulo(formulario.get("dnp_od")),
      dnp_oe: numeroOuNulo(formulario.get("dnp_oe")),
      altura_od: numeroOuNulo(formulario.get("altura_od")),
      altura_oe: numeroOuNulo(formulario.get("altura_oe")),
      laboratorio_nome: textoOuNulo(formulario.get("laboratorio_nome")),
      data_prometida: textoOuNulo(formulario.get("data_prometida")),
      obs_tecnica: textoOuNulo(formulario.get("obs_tecnica")),
    })
    .eq("id", osId);
  atualizarTelas(osId);
}

const ETAPAS_PRODUCAO = ["surfacagem", "tratamento", "coloracao", "corte", "montagem", "conferencia"];

export async function registrarProducao(osId: string, formulario: FormData) {
  const etapa = String(formulario.get("etapa") ?? "");
  if (!ETAPAS_PRODUCAO.includes(etapa)) return;
  const supabase = await criarClienteServidor();
  await supabase.from("os_producao").insert({
    os_id: osId,
    etapa,
    aprovado: formulario.get("resultado") !== "reprovado",
    observacao: textoOuNulo(formulario.get("observacao")),
  });
  atualizarTelas(osId);
}
