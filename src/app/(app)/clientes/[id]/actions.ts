"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { textoOuNulo } from "@/lib/formatar";

export async function adicionarAnotacao(clienteId: string, formulario: FormData) {
  const texto = textoOuNulo(formulario.get("texto"));
  if (!texto) return;
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("anotacoes_cliente").insert({ cliente_id: clienteId, texto, autor_id: user?.id ?? null });
  revalidatePath(`/clientes/${clienteId}`);
}

/** O cliente pediu para ser esquecido (LGPD). O banco confere o perfil e o nome digitado. */
export async function anonimizar(clienteId: string, formulario: FormData) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("anonimizar_cliente", { p_cliente: clienteId, p_confirmacao: String(formulario.get("confirmacao") ?? "") });
  if (error) redirect(`/clientes/${clienteId}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/clientes");
  redirect(`/clientes/${clienteId}?ok=${encodeURIComponent("Cliente anonimizado.")}`);
}
