"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

const FORMAS = ["dinheiro", "pix", "credito", "debito", "boleto", "outro"];

function voltar(caminho: string, msg: string, erro = true): never {
  redirect(`${caminho}${caminho.includes("?") ? "&" : "?"}${erro ? "erro" : "ok"}=${encodeURIComponent(msg)}`);
}

function hoje(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** "2026-01-31" + 1 mês = "2026-02-28" (o dia não passa do fim do mês). */
function somarMeses(data: string, meses: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Contas a pagar
// ---------------------------------------------------------------------------
export async function criarContaPagar(formulario: FormData) {
  const caminho = "/financeiro/pagar";
  const descricao = textoOuNulo(formulario.get("descricao"));
  const valor = numeroOuNulo(formulario.get("valor"));
  const vencimento = textoOuNulo(formulario.get("vencimento"));
  const repetir = Math.min(24, Math.max(1, Math.floor(numeroOuNulo(formulario.get("repetir")) ?? 1)));
  if (!descricao || !valor || valor <= 0 || !vencimento) voltar(caminho, "Preencha descrição, valor e vencimento");

  const grupo = repetir > 1 ? randomUUID() : null;
  const linhas = Array.from({ length: repetir }, (_, i) => ({
    descricao: repetir > 1 ? `${descricao} (${i + 1}/${repetir})` : descricao,
    valor,
    vencimento: somarMeses(vencimento, i),
    fornecedor: textoOuNulo(formulario.get("fornecedor")),
    categoria_id: textoOuNulo(formulario.get("categoria_id")),
    observacao: textoOuNulo(formulario.get("observacao")),
    recorrencia_id: grupo,
  }));
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("contas_pagar").insert(linhas);
  if (error) voltar(caminho, error.message);
  revalidatePath("/financeiro");
  voltar(caminho, repetir > 1 ? `${repetir} contas lançadas` : "Conta lançada", false);
}

export async function pagarConta(id: string, formulario: FormData) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("contas_pagar")
    .update({ pago_em: textoOuNulo(formulario.get("pago_em")) ?? hoje() })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) voltar("/financeiro/pagar", error?.message ?? "Seu perfil não pode alterar contas");
  revalidatePath("/financeiro");
  voltar("/financeiro/pagar", "Pagamento registrado", false);
}

export async function desfazerPagamento(id: string) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("contas_pagar").update({ pago_em: null }).eq("id", id);
  if (error) voltar("/financeiro/pagar", error.message);
  revalidatePath("/financeiro");
  voltar("/financeiro/pagar?ver=pagas", "Pagamento desfeito", false);
}

export async function excluirContaPagar(id: string) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("contas_pagar").delete().eq("id", id).select("id");
  if (error || !data?.length) voltar("/financeiro/pagar", error?.message ?? "Seu perfil não pode excluir contas");
  revalidatePath("/financeiro");
  voltar("/financeiro/pagar", "Conta excluída", false);
}

// ---------------------------------------------------------------------------
// Contas a receber
// ---------------------------------------------------------------------------
export async function criarContaReceber(formulario: FormData) {
  const caminho = "/financeiro/receber";
  const descricao = textoOuNulo(formulario.get("descricao"));
  const valor = numeroOuNulo(formulario.get("valor"));
  const vencimento = textoOuNulo(formulario.get("vencimento"));
  const parcelas = Math.min(24, Math.max(1, Math.floor(numeroOuNulo(formulario.get("parcelas")) ?? 1)));
  if (!descricao || !valor || valor <= 0 || !vencimento) voltar(caminho, "Preencha descrição, valor e vencimento");

  // valor total dividido nas parcelas; os centavos que sobram vão na primeira
  const parcela = Math.floor((valor / parcelas) * 100) / 100;
  const sobra = Math.round((valor - parcela * parcelas) * 100) / 100;
  const linhas = Array.from({ length: parcelas }, (_, i) => ({
    descricao: parcelas > 1 ? `${descricao} (${i + 1}/${parcelas})` : descricao,
    valor: i === 0 ? Math.round((parcela + sobra) * 100) / 100 : parcela,
    vencimento: somarMeses(vencimento, i),
    cliente_id: textoOuNulo(formulario.get("cliente_id")),
    observacao: textoOuNulo(formulario.get("observacao")),
  }));
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("contas_receber").insert(linhas);
  if (error) voltar(caminho, error.message);
  revalidatePath("/financeiro");
  voltar(caminho, parcelas > 1 ? `${parcelas} parcelas lançadas` : "Conta lançada", false);
}

export async function receberConta(id: string, formulario: FormData) {
  const forma = String(formulario.get("forma") ?? "");
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("contas_receber")
    .update({ recebido_em: textoOuNulo(formulario.get("recebido_em")) ?? hoje(), recebido_forma: FORMAS.includes(forma) ? forma : null })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) voltar("/financeiro/receber", error?.message ?? "Seu perfil não pode alterar contas");
  revalidatePath("/financeiro");
  voltar("/financeiro/receber", "Recebimento registrado", false);
}

export async function desfazerRecebimento(id: string) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("contas_receber").update({ recebido_em: null, recebido_forma: null }).eq("id", id);
  if (error) voltar("/financeiro/receber", error.message);
  revalidatePath("/financeiro");
  voltar("/financeiro/receber?ver=recebidas", "Recebimento desfeito", false);
}

export async function excluirContaReceber(id: string) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("contas_receber").delete().eq("id", id).select("id");
  if (error || !data?.length) voltar("/financeiro/receber", error?.message ?? "Seu perfil não pode excluir contas");
  revalidatePath("/financeiro");
  voltar("/financeiro/receber", "Conta excluída", false);
}

// ---------------------------------------------------------------------------
// Categorias, alíquota e comissões
// ---------------------------------------------------------------------------
const TIPOS = ["fornecedor", "fixo", "imposto", "servico", "comissao", "outro"];

export async function criarCategoria(formulario: FormData) {
  const nome = textoOuNulo(formulario.get("nome"));
  const tipo = String(formulario.get("tipo") ?? "");
  if (!nome || !TIPOS.includes(tipo)) voltar("/financeiro/categorias", "Informe nome e tipo");
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("categorias_custo").insert({ nome, tipo });
  if (error) voltar("/financeiro/categorias", error.message);
  revalidatePath("/financeiro/categorias");
  voltar("/financeiro/categorias", "Categoria criada", false);
}

export async function salvarCategoria(id: string, formulario: FormData) {
  const nome = textoOuNulo(formulario.get("nome"));
  const tipo = String(formulario.get("tipo") ?? "");
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("categorias_custo")
    .update({ nome: nome ?? undefined, tipo: TIPOS.includes(tipo) ? tipo : undefined })
    .eq("id", id);
  if (error) voltar("/financeiro/categorias", error.message);
  revalidatePath("/financeiro/categorias");
  voltar("/financeiro/categorias", "Salvo", false);
}

export async function excluirCategoria(id: string) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("categorias_custo").delete().eq("id", id);
  // conta usando a categoria impede excluir (chave estrangeira)
  if (error) voltar("/financeiro/categorias", error.code === "23503" ? "Há contas nesta categoria: troque a categoria delas antes" : error.message);
  revalidatePath("/financeiro/categorias");
  voltar("/financeiro/categorias", "Categoria excluída", false);
}

export async function salvarAliquota(mes: string, formulario: FormData) {
  const aliquota = numeroOuNulo(formulario.get("aliquota"));
  if (aliquota !== null && (aliquota < 0 || aliquota > 100)) voltar(`/financeiro?mes=${mes}`, "Alíquota entre 0 e 100");
  const supabase = await criarClienteServidor();
  const { data: otica } = await supabase.from("oticas").select("id").maybeSingle();
  const { data, error } = await supabase.from("oticas").update({ aliquota_imposto: aliquota }).eq("id", otica?.id ?? "").select("id");
  if (error || !data?.length) voltar(`/financeiro?mes=${mes}`, error?.message ?? "Só quem edita as configurações muda a alíquota");
  revalidatePath("/financeiro");
  voltar(`/financeiro?mes=${mes}`, "Alíquota salva", false);
}

export async function pagarComissoesDoMes(mes: string, ids: string[]) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("marcar_comissoes_pagas", { p_ids: ids });
  if (error) voltar(`/financeiro?mes=${mes}`, error.message);
  revalidatePath("/financeiro");
  voltar(`/financeiro?mes=${mes}`, `${data} comissões marcadas como pagas`, false);
}
