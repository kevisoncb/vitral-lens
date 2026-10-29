"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { textoOuNulo } from "@/lib/formatar";

const CAMINHO = "/configuracoes/funil";

export async function salvarEtapa(id: string, formulario: FormData) {
  const dias = Number(formulario.get("dias"));
  const supabase = await criarClienteServidor();
  await supabase
    .from("funil_etapas")
    .update({
      nome: textoOuNulo(formulario.get("nome")) ?? undefined,
      dias_para_sem_retorno: Number.isFinite(dias) && dias > 0 ? Math.round(dias) : null,
    })
    .eq("id", id);
  revalidatePath(CAMINHO);
}

export async function criarMotivo(formulario: FormData) {
  const nome = textoOuNulo(formulario.get("nome"));
  if (!nome) return;
  const supabase = await criarClienteServidor();
  const { data: otica } = await supabase.from("oticas").select("id").maybeSingle();
  await supabase.from("motivos_perda").insert({ otica_id: otica?.id, nome });
  revalidatePath(CAMINHO);
}

export async function alternarMotivo(id: string, ativo: boolean) {
  const supabase = await criarClienteServidor();
  await supabase.from("motivos_perda").update({ ativo }).eq("id", id);
  revalidatePath(CAMINHO);
}
