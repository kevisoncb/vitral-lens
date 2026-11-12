"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

export type ItemOrcamento = { id: string; descricao: string; quantidade: number; preco_unitario: number };
export type PagamentoAtendimento = { id: string; forma: string; valor: number; parcelas: number; sinal: boolean; pago_em: string };
export type DadosAtendimento = { itens: ItemOrcamento[]; total: number; pagamentos: PagamentoAtendimento[]; os: { id: string; numero: number | null } | null };
export type ResultadoAtendimento = { ok: true; dados: DadosAtendimento; fotoDaArmacao?: string } | { ok: false; erro: string };

/** O estado do orçamento e dos pagamentos, lido do banco depois de cada mudança (a tela mostra isto na hora). */
export async function dadosDoAtendimento(supabase: Supabase, atendimentoId: string): Promise<DadosAtendimento> {
  const [aR, itensR, pagR, osR] = await Promise.all([
    supabase.from("atendimentos").select("valor_total").eq("id", atendimentoId).maybeSingle(),
    supabase.from("atendimento_itens").select("id, descricao, quantidade, preco_unitario").eq("atendimento_id", atendimentoId).order("id"),
    supabase.from("pagamentos").select("id, forma, valor, parcelas, sinal, pago_em").eq("atendimento_id", atendimentoId).order("pago_em"),
    supabase.from("ordens_servico").select("id, numero").eq("atendimento_id", atendimentoId).maybeSingle(),
  ]);
  return {
    itens: (itensR.data ?? []).map((i) => ({ ...i, quantidade: Number(i.quantidade), preco_unitario: Number(i.preco_unitario) })),
    total: Number(aR.data?.valor_total ?? 0),
    pagamentos: (pagR.data ?? []).map((p) => ({ ...p, valor: Number(p.valor) })),
    os: osR.data ?? null,
  };
}

function atualizarTelas(atendimentoId: string) {
  revalidatePath(`/vendas/${atendimentoId}`);
  revalidatePath("/vendas");
  revalidatePath("/laboratorio");
}

export async function pagar(atendimentoId: string, formulario: FormData): Promise<ResultadoAtendimento> {
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
  if (error) return { ok: false, erro: error.message };
  atualizarTelas(atendimentoId);
  return { ok: true, dados: await dadosDoAtendimento(supabase, atendimentoId) };
}

const CATEGORIAS = ["lente", "tratamento", "armacao", "lente_contato", "acessorio", "servico"];

/**
 * Acrescenta um item ao orçamento (card que veio do consultório ou do site, ou orçamento a completar).
 * Do catálogo, ou produto novo que entra no catálogo na hora (armação nova pede foto). O banco recusa depois do
 * primeiro pagamento e recalcula o total.
 */
export async function adicionarItem(atendimentoId: string, formulario: FormData): Promise<ResultadoAtendimento> {
  const supabase = await criarClienteServidor();
  const catalogoId = textoOuNulo(formulario.get("catalogo_id"));
  const quantidade = numeroOuNulo(formulario.get("quantidade")) ?? 1;
  if (quantidade <= 0) return { ok: false, erro: "Quantidade inválida" };
  let item: { catalogo_item_id: string | null; descricao: string; preco_unitario: number };
  let armacaoNova: string | undefined;

  if (catalogoId) {
    const { data: c } = await supabase.from("catalogo_itens").select("id, nome, preco").eq("id", catalogoId).maybeSingle();
    if (!c) return { ok: false, erro: "Produto não encontrado" };
    const preco = numeroOuNulo(formulario.get("preco")) ?? Number(c.preco);
    item = { catalogo_item_id: c.id, descricao: c.nome, preco_unitario: preco };
  } else {
    const nome = textoOuNulo(formulario.get("nome"));
    const preco = numeroOuNulo(formulario.get("preco"));
    const categoria = String(formulario.get("categoria") ?? "");
    if (!nome || preco === null || preco < 0) return { ok: false, erro: "Escolha um produto do catálogo ou informe nome e preço do produto novo" };
    let novoId: string | null = null;
    if (CATEGORIAS.includes(categoria)) {
      const { data: novo } = await supabase.from("catalogo_itens").insert({ categoria, nome, preco, criado_na_venda: true }).select("id").maybeSingle();
      novoId = novo?.id ?? null;
      if (novoId && categoria === "armacao") armacaoNova = novoId;
    }
    item = { catalogo_item_id: novoId, descricao: nome, preco_unitario: preco };
  }

  const { error } = await supabase.from("atendimento_itens").insert({ ...item, quantidade, atendimento_id: atendimentoId });
  if (error) return { ok: false, erro: error.message };
  // o card sem descrição ganha o nome do primeiro item
  await supabase.from("atendimentos").update({ descricao: item.descricao }).eq("id", atendimentoId).is("descricao", null);
  atualizarTelas(atendimentoId);
  return { ok: true, dados: await dadosDoAtendimento(supabase, atendimentoId), fotoDaArmacao: armacaoNova };
}

export async function removerItem(atendimentoId: string, itemId: string): Promise<ResultadoAtendimento> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("atendimento_itens").delete().eq("id", itemId).eq("atendimento_id", atendimentoId);
  if (error) return { ok: false, erro: error.message };
  atualizarTelas(atendimentoId);
  return { ok: true, dados: await dadosDoAtendimento(supabase, atendimentoId) };
}
