"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { textoOuNulo } from "@/lib/formatar";

function voltar(caminho: string, erro?: string): never {
  redirect(erro ? `${caminho}?erro=${encodeURIComponent(erro)}` : `${caminho}?ok=1`);
}

export async function salvarOtica(formulario: FormData) {
  const supabase = await criarClienteServidor();
  const { data: otica } = await supabase.from("oticas").select("id").maybeSingle();
  if (!otica) voltar("/configuracoes", "Ótica não encontrada");
  const cor = textoOuNulo(formulario.get("site_cor"));
  const { error } = await supabase
    .from("oticas")
    .update({
      nome: textoOuNulo(formulario.get("nome")) ?? undefined,
      cnpj: textoOuNulo(formulario.get("cnpj")),
      telefone: textoOuNulo(formulario.get("telefone")),
      site_publicado: formulario.get("site_publicado") === "on",
      site_titulo: textoOuNulo(formulario.get("site_titulo")),
      site_sobre: textoOuNulo(formulario.get("site_sobre")),
      site_endereco: textoOuNulo(formulario.get("site_endereco")),
      site_whatsapp: textoOuNulo(formulario.get("site_whatsapp")),
      site_horario: textoOuNulo(formulario.get("site_horario")),
      site_instagram: textoOuNulo(formulario.get("site_instagram")),
      site_cor: cor && /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : null,
    })
    .eq("id", otica.id);
  if (error) voltar("/configuracoes", error.message);
  revalidatePath("/", "layout");
  voltar("/configuracoes");
}

export async function criarLoja(formulario: FormData) {
  const nome = textoOuNulo(formulario.get("nome"));
  if (!nome) voltar("/configuracoes", "Informe o nome da loja");
  const supabase = await criarClienteServidor();
  const { data: otica } = await supabase.from("oticas").select("id").maybeSingle();
  const { error } = await supabase.from("lojas").insert({
    otica_id: otica?.id,
    nome,
    telefone: textoOuNulo(formulario.get("telefone")),
    endereco: textoOuNulo(formulario.get("endereco")),
  });
  if (error) voltar("/configuracoes", error.message);
  voltar("/configuracoes");
}
