"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type Resultado = { ok: true } | { ok: false; erro: string };

/**
 * Move o card de etapa. A regra do motivo da perda também está no banco
 * (trigger atendimento_mudou), então não dá para burlar por aqui.
 */
export async function moverAtendimento(
  id: string,
  etapaId: string,
  motivoPerdaId: string | null,
  observacao: string | null,
): Promise<Resultado> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("atendimentos")
    .update({
      etapa_id: etapaId,
      motivo_perda_id: motivoPerdaId,
      observacao_perda: observacao,
    })
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, erro: error.message };
  if (!data || data.length === 0) {
    return { ok: false, erro: "Você não tem permissão para mover este card." };
  }

  revalidatePath("/vendas");
  return { ok: true };
}

/** Versão em formulário (celular e tablet, onde não dá para arrastar). */
export async function moverAtendimentoFormulario(id: string, formulario: FormData) {
  const etapaId = String(formulario.get("etapa_id") ?? "");
  const motivo = String(formulario.get("motivo_perda_id") ?? "") || null;
  const obs = String(formulario.get("observacao") ?? "").trim() || null;
  const r = await moverAtendimento(id, etapaId, motivo, obs);
  redirect(r.ok ? `/vendas/${id}` : `/vendas/${id}?erro=${encodeURIComponent(r.erro)}`);
}
