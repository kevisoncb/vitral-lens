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
  revalidatePath("/pdv"); // a resposta já traz o caixa atualizado (sem redirecionar para a mesma tela)
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
  // abre o comprovante do fechamento para imprimir e arquivar
  redirect(`/cupom/fechamento/${caixaId}?ok=${encodeURIComponent(msg)}`);
}

export async function cancelarVenda(vendaId: string, formulario: FormData) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("cancelar_venda", { p_venda: vendaId, p_motivo: textoOuNulo(formulario.get("motivo")) });
  if (error) voltar("/pdv/vendas", error.message);
  revalidatePath("/pdv");
  redirect("/pdv/vendas?ok=Venda cancelada e itens devolvidos ao estoque");
}

/** Recebe no caixa o sinal/saldo dos óculos ou uma parcela do crediário. */
export async function receberNoCaixa(caixaId: string, tipo: "oculos" | "parcela", id: string, busca: string, formulario: FormData) {
  const supabase = await criarClienteServidor();
  const valor = numeroOuNulo(formulario.get("valor"));
  const forma = String(formulario.get("forma") ?? "");
  const parcelas = Math.max(1, Math.min(24, Math.floor(Number(formulario.get("parcelas")) || 1)));
  const { error } = await supabase.rpc("receber_no_caixa", {
    p_caixa: caixaId,
    p_tipo: tipo,
    p_id: id,
    p_valor: valor ?? 0,
    p_forma: forma,
    p_parcelas: parcelas,
    p_data_prometida: textoOuNulo(formulario.get("data_prometida")),
  });
  const volta = `/pdv?receber=${encodeURIComponent(busca)}`;
  if (error) redirect(`${volta}&erro=${encodeURIComponent(error.message)}`);
  // a resposta já traz o caixa atualizado: o recebido sai da lista e entra no resumo
  revalidatePath("/pdv");
}

/** Devolução de parte da venda (gerente). Em dinheiro, sai do caixa da venda (se aberto) ou do caixa aberto do gerente. */
export async function devolverItens(vendaId: string, formulario: FormData) {
  const supabase = await criarClienteServidor();
  const itens: { venda_item_id: string; quantidade: number }[] = [];
  for (const [chave, valor] of formulario.entries()) {
    if (!chave.startsWith("qtd_")) continue;
    const quantidade = Math.floor(Number(valor) || 0);
    if (quantidade > 0) itens.push({ venda_item_id: chave.slice(4), quantidade });
  }
  if (itens.length === 0) voltar("/pdv/vendas", "Escolha a quantidade do que vai ser devolvido");
  const forma = String(formulario.get("forma") ?? "");
  let caixa: string | null = null;
  if (forma === "dinheiro") {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: v } = await supabase.from("vendas").select("caixa_id, caixas(fechado_em)").eq("id", vendaId)
      .returns<{ caixa_id: string | null; caixas: { fechado_em: string | null } | null }[]>().maybeSingle();
    if (v?.caixa_id && v.caixas && !v.caixas.fechado_em) caixa = v.caixa_id;
    else {
      const { data: meu } = await supabase.from("caixas").select("id").eq("operador_id", user?.id ?? "").is("fechado_em", null).maybeSingle();
      caixa = meu?.id ?? null;
    }
  }
  const { data, error } = await supabase.rpc("devolver_itens", {
    p_venda: vendaId,
    p_itens: itens,
    p_forma: forma,
    p_motivo: String(formulario.get("motivo") ?? ""),
    p_caixa: caixa,
  });
  if (error) voltar("/pdv/vendas", error.message);
  revalidatePath("/pdv");
  const valor = Number((data as { valor: number }).valor).toFixed(2).replace(".", ",");
  redirect(`/pdv/vendas?ok=${encodeURIComponent(`Devolução de R$ ${valor} registrada; itens de volta ao estoque.`)}`);
}
