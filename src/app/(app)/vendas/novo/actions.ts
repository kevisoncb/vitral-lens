"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

const CATEGORIAS = ["lente", "tratamento", "armacao", "lente_contato", "acessorio", "servico"];

export async function criarAtendimento(formulario: FormData) {
  const clienteId = textoOuNulo(formulario.get("cliente_id"));
  const voltar = (msg: string) => redirect(`/vendas/novo?erro=${encodeURIComponent(msg)}${clienteId ? `&cliente=${clienteId}` : ""}`);
  if (!clienteId) return voltar("Escolha o cliente");

  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  // todo atendimento novo entra na primeira etapa do funil
  const { data: etapa } = await supabase.from("funil_etapas").select("id").order("ordem").limit(1).maybeSingle();
  if (!etapa) return voltar("O funil desta ótica não tem etapas");
  const { data: loja } = await supabase.from("lojas").select("id").eq("ativa", true).order("criado_em").limit(1).maybeSingle();

  const salvarNovos = formulario.get("salvar_novos") === "on";
  const { data: catalogo } = await supabase.from("catalogo_itens").select("id, nome, preco, categoria");
  const armacoesNovas: string[] = [];
  const itens: { catalogo_item_id: string | null; descricao: string; quantidade: number; preco_unitario: number }[] = [];

  for (let i = 0; i < 5; i++) {
    const doCatalogo = catalogo?.find((c) => c.id === textoOuNulo(formulario.get(`catalogo_${i}`)));
    const nomeNovo = textoOuNulo(formulario.get(`descricao_${i}`));
    const preco = numeroOuNulo(formulario.get(`preco_${i}`)) ?? (doCatalogo ? Number(doCatalogo.preco) : null);
    const quantidade = numeroOuNulo(formulario.get(`qtd_${i}`)) ?? 1;

    if (doCatalogo) {
      if (preco === null) continue;
      itens.push({ catalogo_item_id: doCatalogo.id, descricao: nomeNovo ?? doCatalogo.nome, quantidade, preco_unitario: preco });
      continue;
    }
    if (!nomeNovo || preco === null) continue;

    // produto que não estava no catálogo: entra nele agora (se a pessoa puder criar)
    let novoId: string | null = null;
    const categoria = String(formulario.get(`categoria_${i}`) ?? "");
    if (salvarNovos && CATEGORIAS.includes(categoria)) {
      const { data: novo } = await supabase
        .from("catalogo_itens")
        .insert({ categoria, nome: nomeNovo, preco, criado_na_venda: true })
        .select("id")
        .maybeSingle();
      novoId = novo?.id ?? null;
      if (novoId && categoria === "armacao") armacoesNovas.push(novoId);
    }
    itens.push({ catalogo_item_id: novoId, descricao: nomeNovo, quantidade, preco_unitario: preco });
  }

  const { data: atendimento, error } = await supabase
    .from("atendimentos")
    .insert({
      cliente_id: clienteId,
      etapa_id: etapa.id,
      loja_id: loja?.id ?? null,
      receita_id: textoOuNulo(formulario.get("receita_id")),
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

  // armação nova: pede a foto antes de seguir
  if (armacoesNovas.length > 0) {
    redirect(`/catalogo/fotos?itens=${armacoesNovas.join(",")}&voltar=/vendas/${atendimento.id}`);
  }
  redirect(`/vendas/${atendimento.id}`);
}
