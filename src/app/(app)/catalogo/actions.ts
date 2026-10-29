"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

const CATEGORIAS = ["lente", "tratamento", "armacao", "lente_contato", "acessorio", "servico"];

export async function criarItem(formulario: FormData) {
  const nome = textoOuNulo(formulario.get("nome"));
  const preco = numeroOuNulo(formulario.get("preco"));
  const categoria = String(formulario.get("categoria") ?? "");
  if (!nome || preco === null || preco < 0 || !CATEGORIAS.includes(categoria)) {
    redirect("/catalogo?erro=Preencha nome, categoria e preço");
  }
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("catalogo_itens").insert({ nome, preco, categoria });
  if (error) redirect(`/catalogo?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/catalogo");
  redirect("/catalogo");
}

export async function salvarItem(id: string, formulario: FormData) {
  const preco = numeroOuNulo(formulario.get("preco"));
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("catalogo_itens")
    .update({
      nome: textoOuNulo(formulario.get("nome")) ?? undefined,
      preco: preco ?? undefined,
      ativo: formulario.get("ativo") === "on",
    })
    .eq("id", id);
  if (error) redirect(`/catalogo?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/catalogo");
}
