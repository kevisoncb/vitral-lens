"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

export async function pagar(atendimentoId: string, formulario: FormData) {
  const valor = numeroOuNulo(formulario.get("valor"));
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("registrar_pagamento", {
    p_atendimento: atendimentoId,
    p_valor: valor ?? 0,
    p_forma: String(formulario.get("forma") ?? "outro"),
    p_parcelas: Math.max(1, Math.round(numeroOuNulo(formulario.get("parcelas")) ?? 1)),
    p_sinal: formulario.get("sinal") === "on",
    p_data_prometida: textoOuNulo(formulario.get("data_prometida")),
  });
  if (error) redirect(`/vendas/${atendimentoId}?erro=${encodeURIComponent(error.message)}`);
  redirect(`/vendas/${atendimentoId}`);
}

const CATEGORIAS = ["lente", "tratamento", "armacao", "lente_contato", "acessorio", "servico"];

/**
 * Acrescenta um item ao orçamento (card que veio do consultório ou do site, ou orçamento a completar).
 * Do catálogo, ou produto novo que entra no catálogo na hora (armação nova pede foto). O banco recusa depois do
 * primeiro pagamento e recalcula o total.
 */
export async function adicionarItem(atendimentoId: string, formulario: FormData) {
  const voltar = (msg: string) => redirect(`/vendas/${atendimentoId}?erro=${encodeURIComponent(msg)}`);
  const supabase = await criarClienteServidor();
  const catalogoId = textoOuNulo(formulario.get("catalogo_id"));
  const quantidade = numeroOuNulo(formulario.get("quantidade")) ?? 1;
  if (quantidade <= 0) return voltar("Quantidade inválida");
  let item: { catalogo_item_id: string | null; descricao: string; preco_unitario: number };
  let armacaoNova: string | null = null;

  if (catalogoId) {
    const { data: c } = await supabase.from("catalogo_itens").select("id, nome, preco").eq("id", catalogoId).maybeSingle();
    if (!c) return voltar("Produto não encontrado");
    const preco = numeroOuNulo(formulario.get("preco")) ?? Number(c.preco);
    item = { catalogo_item_id: c.id, descricao: c.nome, preco_unitario: preco };
  } else {
    const nome = textoOuNulo(formulario.get("nome"));
    const preco = numeroOuNulo(formulario.get("preco"));
    const categoria = String(formulario.get("categoria") ?? "");
    if (!nome || preco === null || preco < 0) return voltar("Escolha um produto do catálogo ou informe nome e preço do produto novo");
    let novoId: string | null = null;
    if (CATEGORIAS.includes(categoria)) {
      const { data: novo } = await supabase.from("catalogo_itens").insert({ categoria, nome, preco, criado_na_venda: true }).select("id").maybeSingle();
      novoId = novo?.id ?? null;
      if (novoId && categoria === "armacao") armacaoNova = novoId;
    }
    item = { catalogo_item_id: novoId, descricao: nome, preco_unitario: preco };
  }

  const { error } = await supabase.from("atendimento_itens").insert({ ...item, quantidade, atendimento_id: atendimentoId });
  if (error) return voltar(error.message);
  // o card sem descrição ganha o nome do primeiro item
  await supabase.from("atendimentos").update({ descricao: item.descricao }).eq("id", atendimentoId).is("descricao", null);
  revalidatePath(`/vendas/${atendimentoId}`);
  if (armacaoNova) redirect(`/catalogo/fotos?itens=${armacaoNova}&voltar=/vendas/${atendimentoId}`);
  redirect(`/vendas/${atendimentoId}`);
}

export async function removerItem(atendimentoId: string, itemId: string) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("atendimento_itens").delete().eq("id", itemId).eq("atendimento_id", atendimentoId);
  if (error) redirect(`/vendas/${atendimentoId}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(`/vendas/${atendimentoId}`);
  redirect(`/vendas/${atendimentoId}`);
}
