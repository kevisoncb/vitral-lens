"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

export async function criarAtendimento(formulario: FormData) {
  const clienteId = textoOuNulo(formulario.get("cliente_id"));
  const voltar = (msg: string) => redirect(`/vendas/novo?erro=${encodeURIComponent(msg)}`);
  if (!clienteId) return voltar("Escolha o cliente");

  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  // todo atendimento novo entra na primeira etapa do funil
  const { data: etapa } = await supabase.from("funil_etapas").select("id").order("ordem").limit(1).maybeSingle();
  if (!etapa) return voltar("O funil desta ótica não tem etapas");

  const { data: loja } = await supabase.from("lojas").select("id").eq("ativa", true).order("criado_em").limit(1).maybeSingle();

  // itens: catálogo (traz nome e preço) ou descrição livre
  const { data: catalogo } = await supabase.from("catalogo_itens").select("id, nome, preco");
  const itens: { catalogo_item_id: string | null; descricao: string; quantidade: number; preco_unitario: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const catId = textoOuNulo(formulario.get(`catalogo_${i}`));
    const doCatalogo = catalogo?.find((c) => c.id === catId);
    const descricao = textoOuNulo(formulario.get(`descricao_${i}`)) ?? doCatalogo?.nome;
    const preco = numeroOuNulo(formulario.get(`preco_${i}`)) ?? (doCatalogo ? Number(doCatalogo.preco) : null);
    if (!descricao || preco === null) continue;
    itens.push({
      catalogo_item_id: doCatalogo?.id ?? null,
      descricao,
      quantidade: numeroOuNulo(formulario.get(`qtd_${i}`)) ?? 1,
      preco_unitario: preco,
    });
  }

  const { data: atendimento, error } = await supabase
    .from("atendimentos")
    .insert({
      cliente_id: clienteId,
      etapa_id: etapa.id,
      loja_id: loja?.id ?? null,
      responsavel_id: user?.id ?? null,
      descricao: textoOuNulo(formulario.get("descricao")) ?? itens[0]?.descricao ?? null,
    })
    .select("id")
    .single();
  if (error || !atendimento) return voltar(error?.message ?? "Não foi possível criar");

  if (itens.length > 0) {
    // o banco recalcula o valor_total (trigger recalcular_total)
    const { error: erroItens } = await supabase
      .from("atendimento_itens")
      .insert(itens.map((it) => ({ ...it, atendimento_id: atendimento.id })));
    if (erroItens) return voltar(erroItens.message);
  }

  redirect(`/vendas/${atendimento.id}`);
}
