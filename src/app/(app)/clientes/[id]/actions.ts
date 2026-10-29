"use server";

import { revalidatePath } from "next/cache";
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
