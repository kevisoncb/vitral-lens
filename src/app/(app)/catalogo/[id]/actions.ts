"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

const CATEGORIAS = ["lente", "tratamento", "armacao", "lente_contato", "acessorio", "servico"];

/** Só os números de um campo fiscal; vazio vira null. Confere o tamanho exato. */
function codigoFiscal(valor: FormDataEntryValue | null, tamanho: number, nome: string, voltar: (m: string) => never): string | null {
  const t = String(valor ?? "").replace(/\D/g, "");
  if (!t) return null;
  if (t.length !== tamanho) voltar(`${nome} tem ${tamanho} números (veio com ${t.length})`);
  return t;
}

export async function salvarProduto(id: string, formulario: FormData) {
  const caminho = `/catalogo/${id}`;
  const voltar = (m: string): never => redirect(`${caminho}?erro=${encodeURIComponent(m)}`);

  const nome = textoOuNulo(formulario.get("nome"));
  const categoria = String(formulario.get("categoria") ?? "");
  const preco = numeroOuNulo(formulario.get("preco"));
  if (!nome || !CATEGORIAS.includes(categoria) || preco === null || preco < 0) return voltar("Preencha nome, categoria e preço de venda");

  const custo = numeroOuNulo(formulario.get("custo"));
  const insumos = numeroOuNulo(formulario.get("custo_insumos")) ?? 0;
  const impostos = numeroOuNulo(formulario.get("custo_impostos")) ?? 0;
  if ((custo !== null && custo < 0) || impostos < 0) return voltar("Custo e impostos não podem ser negativos");

  const origem = textoOuNulo(formulario.get("origem"));
  const aliquota = numeroOuNulo(formulario.get("aliquota_icms"));
  if (aliquota !== null && (aliquota < 0 || aliquota > 100)) voltar("Alíquota de ICMS entre 0 e 100");
  const unidade = (textoOuNulo(formulario.get("unidade")) ?? "UN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "UN";

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("catalogo_itens")
    .update({
      nome,
      categoria,
      preco,
      marca: textoOuNulo(formulario.get("marca")),
      codigo: textoOuNulo(formulario.get("codigo")),
      ativo: formulario.get("ativo") === "on",
      unidade,
      custo,
      custo_insumos: insumos,
      custo_impostos: impostos,
      ncm: codigoFiscal(formulario.get("ncm"), 8, "O NCM", voltar),
      cest: codigoFiscal(formulario.get("cest"), 7, "O CEST", voltar),
      cfop: codigoFiscal(formulario.get("cfop"), 4, "O CFOP", voltar),
      csosn: codigoFiscal(formulario.get("csosn"), 3, "O CSOSN", voltar),
      cst_icms: codigoFiscal(formulario.get("cst_icms"), 2, "O CST do ICMS", voltar),
      cclass_trib: codigoFiscal(formulario.get("cclass_trib"), 6, "A classificação do IBS/CBS", voltar),
      origem: origem === null ? null : Number(origem),
      aliquota_icms: aliquota,
    })
    .eq("id", id)
    .select("id");
  if (error) voltar(error.message.includes("catalogo_itens_codigo") ? "Esse código já é de outro produto" : error.message);
  if (!data?.length) voltar("Seu perfil não pode alterar o catálogo");
  revalidatePath("/catalogo");
  revalidatePath(caminho);
  redirect(`${caminho}?ok=1`);
}
