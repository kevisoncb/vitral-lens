"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type ItemEntrada = {
  codigo: string;
  nome: string;
  categoria: string;
  quantidade: number;
  custo: number;
  /** frete/desconto e IPI/ICMS-ST da nota, em reais por unidade: só usados como ponto de partida do produto novo */
  insumos_valor: number;
  impostos_valor: number;
  ncm: string | null;
  cest: string | null;
  origem: number | null;
  unidade: string | null;
};
export type ResultadoEntrada = { ok: boolean; mensagem: string; novos?: { id: string; nome: string }[] };

export async function lancarNota(dados: {
  nota: { chave: string | null; numero: string; fornecedor: string; cnpj: string | null; emissao: string | null; valor_total: number };
  lojaId: string | null;
  itens: ItemEntrada[];
  duplicatas: { vencimento: string; valor: number }[];
  categoriaCusto: string | null;
}): Promise<ResultadoEntrada> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("registrar_entrada_nfe", {
    p_nota: dados.nota,
    p_loja: dados.lojaId,
    p_itens: dados.itens,
    p_duplicatas: dados.duplicatas,
    p_categoria_custo: dados.categoriaCusto,
  });
  if (error) return { ok: false, mensagem: error.message };
  const r = data as { produtos_novos: number; novos: { id: string; nome: string }[]; unidades: number; contas: number; contas_sem_permissao: boolean };
  revalidatePath("/estoque");
  revalidatePath("/catalogo");
  revalidatePath("/financeiro");
  const partes = [
    `${r.unidades} ${r.unidades === 1 ? "unidade entrou" : "unidades entraram"} no estoque`,
    r.produtos_novos ? `${r.produtos_novos} ${r.produtos_novos === 1 ? "produto novo" : "produtos novos"} cadastrados (fora da venda até ter preço)` : null,
    r.contas ? `${r.contas} ${r.contas === 1 ? "parcela lançada" : "parcelas lançadas"} em contas a pagar` : null,
    r.contas_sem_permissao ? "as parcelas não foram lançadas (seu perfil não lança no financeiro)" : null,
  ].filter(Boolean);
  return { ok: true, mensagem: `Nota lançada: ${partes.join("; ")}.`, novos: r.novos ?? [] };
}
