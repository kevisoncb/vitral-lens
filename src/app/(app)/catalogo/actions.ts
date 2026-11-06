"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

const CATEGORIAS = ["lente", "tratamento", "armacao", "lente_contato", "acessorio", "servico"];

/** Cadastra o básico e abre a página do produto para completar custo, impostos e foto. Sem preço, fica fora da venda. */
export async function criarItem(formulario: FormData) {
  const nome = textoOuNulo(formulario.get("nome"));
  const preco = numeroOuNulo(formulario.get("preco"));
  const categoria = String(formulario.get("categoria") ?? "");
  if (!nome || (preco !== null && preco < 0) || !CATEGORIAS.includes(categoria)) {
    redirect("/catalogo?erro=Preencha nome e categoria");
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("catalogo_itens")
    .insert({ nome, preco: preco ?? 0, ativo: preco !== null && preco > 0, categoria })
    .select("id")
    .single();
  if (error || !data) redirect(`/catalogo?erro=${encodeURIComponent(error?.message ?? "Não foi possível cadastrar")}`);
  revalidatePath("/catalogo");
  redirect(`/catalogo/${data.id}`);
}
