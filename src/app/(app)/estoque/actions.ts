"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

function voltar(caminho: string, msg: string): never {
  redirect(`${caminho}${caminho.includes("?") ? "&" : "?"}erro=${encodeURIComponent(msg)}`);
}

/** Entrada (compra), saída (perda) ou ajuste de contagem. O banco confere a permissão de cada tipo. */
export async function movimentar(formulario: FormData) {
  const caminho = textoOuNulo(formulario.get("voltar")) ?? "/estoque";
  const item = textoOuNulo(formulario.get("item_id"));
  const tipo = String(formulario.get("tipo") ?? "");
  const quantidade = numeroOuNulo(formulario.get("quantidade"));
  if (!item) voltar(caminho, "Escolha o produto");
  if (quantidade === null || !Number.isInteger(quantidade)) voltar(caminho, "Informe a quantidade em unidades");

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("movimentar_estoque", {
    p_item: item,
    p_loja: textoOuNulo(formulario.get("loja_id")),
    p_tipo: tipo,
    p_quantidade: quantidade,
    p_custo: tipo === "entrada" ? numeroOuNulo(formulario.get("custo")) : null,
    p_motivo: textoOuNulo(formulario.get("motivo")),
  });
  if (error) voltar(caminho, error.message);
  revalidatePath("/estoque");
  redirect(`${caminho}${caminho.includes("?") ? "&" : "?"}ok=1`);
}

export async function transferir(itemId: string, formulario: FormData) {
  const caminho = `/estoque/${itemId}`;
  const quantidade = numeroOuNulo(formulario.get("quantidade"));
  if (quantidade === null || !Number.isInteger(quantidade)) voltar(caminho, "Informe a quantidade em unidades");
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("transferir_estoque", {
    p_item: itemId,
    p_de: textoOuNulo(formulario.get("de")),
    p_para: textoOuNulo(formulario.get("para")),
    p_quantidade: quantidade,
  });
  if (error) voltar(caminho, error.message);
  revalidatePath("/estoque");
  redirect(`${caminho}?ok=1`);
}

/** Liga/desliga o controle de estoque do produto e define o mínimo (precisa de catalogo:editar). */
export async function configurarItem(itemId: string, formulario: FormData) {
  const caminho = `/estoque/${itemId}`;
  const minimo = numeroOuNulo(formulario.get("estoque_minimo")) ?? 0;
  if (!Number.isInteger(minimo) || minimo < 0) voltar(caminho, "Estoque mínimo inválido");
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("catalogo_itens")
    .update({ controla_estoque: formulario.get("controla_estoque") === "on", estoque_minimo: minimo })
    .eq("id", itemId)
    .select("id");
  if (error) voltar(caminho, error.message);
  if (!data?.length) voltar(caminho, "Seu perfil não pode alterar o catálogo");
  revalidatePath("/estoque");
  redirect(`${caminho}?ok=1`);
}
