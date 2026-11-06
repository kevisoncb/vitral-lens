"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

const CATEGORIAS = ["lente", "tratamento", "armacao", "lente_contato", "acessorio", "servico"];

function voltar(mes: string, extra: string): never {
  redirect(`/comissoes?mes=${mes}&${extra}`);
}

export async function pagarComissoes(mes: string, ids: string[]) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("marcar_comissoes_pagas", { p_ids: ids });
  if (error) voltar(mes, `erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/comissoes");
  voltar(mes, "ok=1");
}

/** Regra nova (ou troca o percentual da regra igual que já existe). */
export async function salvarRegra(mes: string, formulario: FormData) {
  const percentual = numeroOuNulo(formulario.get("percentual"));
  const categoria = textoOuNulo(formulario.get("categoria"));
  const usuario = textoOuNulo(formulario.get("usuario_id"));
  if (percentual === null || percentual < 0 || percentual > 100) voltar(mes, "erro=Percentual entre 0 e 100");
  if (categoria && !CATEGORIAS.includes(categoria)) voltar(mes, "erro=Categoria inválida");

  const supabase = await criarClienteServidor();
  let existente = supabase.from("comissao_regras").select("id");
  existente = usuario ? existente.eq("usuario_id", usuario) : existente.is("usuario_id", null);
  existente = categoria ? existente.eq("categoria", categoria) : existente.is("categoria", null);
  const { data: achou } = await existente.maybeSingle();

  const { error } = achou
    ? await supabase.from("comissao_regras").update({ percentual }).eq("id", achou.id)
    : await supabase.from("comissao_regras").insert({ usuario_id: usuario, categoria, percentual });
  if (error) voltar(mes, `erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/comissoes");
  voltar(mes, "ok=1");
}

export async function apagarRegra(mes: string, id: string) {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("comissao_regras").delete().eq("id", id);
  if (error) voltar(mes, `erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/comissoes");
  voltar(mes, "ok=1");
}
