"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { MODULOS_CONFIGURAVEIS, ACOES } from "./modulos";
import { textoOuNulo } from "@/lib/formatar";

export async function salvarPerfil(id: string, formulario: FormData) {
  const supabase = await criarClienteServidor();
  const { data: perfil } = await supabase.from("perfis").select("chave").eq("id", id).maybeSingle();
  if (!perfil) return;
  if (perfil.chave === "dono") redirect("/configuracoes/perfis?erro=O perfil Dono sempre tem acesso total");

  const permissoes: Record<string, string[]> = {};
  for (const { modulo } of MODULOS_CONFIGURAVEIS) {
    const acoes = ACOES.filter((a) => formulario.get(`${modulo}:${a}`) === "on");
    // quem pode criar/editar/excluir precisa poder ver
    if (acoes.length > 0 && !acoes.includes("ver")) acoes.unshift("ver");
    if (acoes.length > 0) permissoes[modulo] = acoes;
  }
  const { error } = await supabase
    .from("perfis")
    .update({ permissoes, nome: textoOuNulo(formulario.get("nome")) ?? undefined })
    .eq("id", id);
  if (error) redirect(`/configuracoes/perfis?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect("/configuracoes/perfis?ok=1");
}

export async function criarPerfil(formulario: FormData) {
  const nome = textoOuNulo(formulario.get("nome"));
  if (!nome) return;
  const supabase = await criarClienteServidor();
  const { data: otica } = await supabase.from("oticas").select("id").maybeSingle();
  const chave = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30) + "_" + Date.now().toString(36);
  const { error } = await supabase.from("perfis").insert({ otica_id: otica?.id, chave, nome, permissoes: {} });
  if (error) redirect(`/configuracoes/perfis?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/configuracoes/perfis");
}
