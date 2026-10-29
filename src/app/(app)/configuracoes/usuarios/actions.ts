"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { textoOuNulo } from "@/lib/formatar";

export type EstadoConvite = { ok: boolean; mensagem: string; senha?: string } | null;

/** Cria o login (Auth, via service role) e o vínculo com a ótica (via RLS do próprio gerente). */
export async function criarUsuario(_anterior: EstadoConvite, formulario: FormData): Promise<EstadoConvite> {
  const nome = textoOuNulo(formulario.get("nome"));
  const email = textoOuNulo(formulario.get("email"))?.toLowerCase();
  const perfilId = textoOuNulo(formulario.get("perfil_id"));
  if (!nome || !email || !perfilId) return { ok: false, mensagem: "Preencha nome, e-mail e perfil." };

  const supabase = await criarClienteServidor();
  // confere a permissão ANTES de usar a service role
  const { data: pode } = await supabase.rpc("acesso", { modulo: "usuarios", acao: "criar" });
  if (!pode) return { ok: false, mensagem: "Você não tem permissão para criar usuários." };
  const { data: otica } = await supabase.from("oticas").select("id").maybeSingle();
  const { data: perfil } = await supabase.from("perfis").select("id").eq("id", perfilId).maybeSingle();
  if (!otica || !perfil) return { ok: false, mensagem: "Perfil inválido." };

  const senha = randomBytes(9).toString("base64url");
  const admin = criarClienteAdmin();
  const { data: criado, error: erroAuth } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (erroAuth || !criado.user) {
    return { ok: false, mensagem: erroAuth?.message.includes("already") ? "Esse e-mail já tem login no Vitral." : (erroAuth?.message ?? "Erro ao criar login") };
  }

  const { error } = await supabase.from("usuarios").insert({
    id: criado.user.id,
    otica_id: otica.id,
    perfil_id: perfil.id,
    nome,
    email,
    loja_id: textoOuNulo(formulario.get("loja_id")),
  });
  if (error) {
    await admin.auth.admin.deleteUser(criado.user.id); // desfaz o login órfão
    return { ok: false, mensagem: error.message };
  }

  revalidatePath("/configuracoes/usuarios");
  return {
    ok: true,
    mensagem: `Login criado para ${nome}. Passe a senha temporária abaixo; ela aparece só agora. A pessoa troca em "Minha conta".`,
    senha,
  };
}

export async function atualizarUsuario(id: string, formulario: FormData) {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase
    .from("usuarios")
    .update({
      perfil_id: textoOuNulo(formulario.get("perfil_id")) ?? undefined,
      // ninguém se desativa sozinho (evita a ótica ficar sem dono)
      ativo: id === user?.id ? true : formulario.get("ativo") === "on",
    })
    .eq("id", id);
  revalidatePath("/configuracoes/usuarios");
}
