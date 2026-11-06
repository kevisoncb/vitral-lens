"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

export type ItemVenda = { item_id: string; quantidade: number };
export type PagamentoVenda = { forma: string; valor: number; parcelas?: number; vencimento?: string | null };
export type ResultadoVenda = { ok: boolean; mensagem: string; vendaId?: string } | null;

function voltar(caminho: string, msg: string): never {
  redirect(`${caminho}?erro=${encodeURIComponent(msg)}`);
}

export async function abrirCaixa(formulario: FormData) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("abrir_caixa", {
    p_loja: textoOuNulo(formulario.get("loja_id")),
    p_valor: numeroOuNulo(formulario.get("valor")) ?? 0,
  });
  if (error) voltar("/pdv", error.message);
  revalidatePath("/pdv");
  redirect("/pdv");
}

export async function registrarVenda(
  caixaId: string,
  venda: { clienteId: string | null; itens: ItemVenda[]; desconto: number; pagamentos: PagamentoVenda[]; observacao: string | null },
): Promise<ResultadoVenda> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("registrar_venda", {
    p_caixa: caixaId,
    p_cliente: venda.clienteId,
    p_itens: venda.itens,
    p_desconto: venda.desconto,
    p_pagamentos: venda.pagamentos,
    p_observacao: venda.observacao,
  });
  if (error) return { ok: false, mensagem: error.message };
  revalidatePath("/pdv");
  const { data: v } = await supabase.from("vendas").select("numero").eq("id", data as string).maybeSingle();
  return { ok: true, mensagem: `Venda ${v?.numero ?? ""} registrada.`, vendaId: data as string };
}

/** Busca de cliente para identificar a venda (crediário exige). */
export async function buscarClientes(busca: string): Promise<{ id: string; nome: string; telefone: string | null }[]> {
  const q = busca.trim().replace(/[%,()]/g, "");
  if (q.length < 2) return [];
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("clientes")
    .select("id, nome, telefone")
    .or(`nome.ilike.%${q}%,telefone.ilike.%${q}%,cpf.ilike.%${q}%`)
    .order("nome")
    .limit(8);
  return data ?? [];
}

export async function movimentarCaixa(caixaId: string, formulario: FormData) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("movimentar_caixa", {
    p_caixa: caixaId,
    p_tipo: String(formulario.get("tipo") ?? ""),
    p_valor: numeroOuNulo(formulario.get("valor")),
    p_motivo: textoOuNulo(formulario.get("motivo")),
  });
  if (error) voltar("/pdv", error.message);
  revalidatePath("/pdv");
  redirect("/pdv?ok=Lançado");
}

export async function fecharCaixa(caixaId: string, formulario: FormData) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("fechar_caixa", {
    p_caixa: caixaId,
    p_contado: numeroOuNulo(formulario.get("contado")),
    p_observacao: textoOuNulo(formulario.get("observacao")),
  });
  if (error) voltar("/pdv", error.message);
  revalidatePath("/pdv");
  const r = data as { diferenca: number };
  const dif = Number(r.diferenca);
  const msg = dif === 0 ? "Caixa fechado e conferido." : `Caixa fechado com diferença de R$ ${dif.toFixed(2).replace(".", ",")}.`;
  redirect(`/pdv/caixas?ok=${encodeURIComponent(msg)}`);
}

export async function cancelarVenda(vendaId: string, formulario: FormData) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("cancelar_venda", { p_venda: vendaId, p_motivo: textoOuNulo(formulario.get("motivo")) });
  if (error) voltar("/pdv/vendas", error.message);
  revalidatePath("/pdv");
  redirect("/pdv/vendas?ok=Venda cancelada e itens devolvidos ao estoque");
}
