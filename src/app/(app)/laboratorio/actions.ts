"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type Resultado = { ok: true } | { ok: false; erro: string };

/** Move a OS de etapa. Histórico, data de entrega e garantia são feitos pelo banco (trigger os_mudou). */
export async function moverOS(id: string, etapaId: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("ordens_servico").update({ etapa_id: etapaId }).eq("id", id).select("id");
  if (error) return { ok: false, erro: error.message };
  if (!data || data.length === 0) return { ok: false, erro: "Você não tem permissão para mover esta ordem." };
  revalidatePath("/laboratorio");
  return { ok: true };
}
