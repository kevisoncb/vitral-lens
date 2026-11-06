"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import type { MotivoChamar } from "@/lib/whatsapp";

const MOTIVOS: MotivoChamar[] = ["receita_vencendo", "aniversario", "oculos_um_ano", "orcamento_perdido"];

/** Marca que o cliente foi chamado por esse motivo: ele sai da lista deste ciclo. */
export async function registrarContato(clienteId: string, motivo: MotivoChamar): Promise<{ ok: boolean; mensagem?: string }> {
  if (!MOTIVOS.includes(motivo)) return { ok: false, mensagem: "Motivo inválido" };
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensagem: "Entre de novo no sistema" };
  const { error } = await supabase.from("cliente_contatos").insert({ cliente_id: clienteId, motivo, usuario_id: user.id });
  if (error) return { ok: false, mensagem: error.message };
  revalidatePath("/clientes/chamar");
  return { ok: true };
}
