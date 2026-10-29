"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { textoOuNulo } from "@/lib/formatar";
import type { Database } from "@/lib/supabase/tipos";

export type EstadoNovaOtica = { ok: boolean; mensagem: string; senha?: string } | null;

/**
 * Ótica nova com o login do dono. Confere no banco que quem pede é da equipe do Vitra ANTES de usar
 * a service role, que serve só para criar o login no Auth; os dados entram por painel_criar_otica().
 */
export async function criarOtica(_anterior: EstadoNovaOtica, formulario: FormData): Promise<EstadoNovaOtica> {
  const nome = textoOuNulo(formulario.get("nome"));
  const slug = textoOuNulo(formulario.get("slug"))?.toLowerCase() ?? null;
  const donoNome = textoOuNulo(formulario.get("dono_nome"));
  const email = textoOuNulo(formulario.get("dono_email"))?.toLowerCase();
  if (!nome || !donoNome || !email) return { ok: false, mensagem: "Preencha o nome da ótica, o nome e o e-mail do dono." };

  const supabase = await criarClienteServidor();
  const { data: admin } = await supabase.rpc("sou_admin_vitra");
  if (!admin) return { ok: false, mensagem: "Só a equipe do Vitra cria óticas." };

  const senha = randomBytes(9).toString("base64url");
  const auth = criarClienteAdmin();
  const { data: criado, error: erroAuth } = await auth.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: donoNome },
  });
  if (erroAuth || !criado.user) {
    return { ok: false, mensagem: erroAuth?.message.includes("already") ? "Esse e-mail já tem login no Vitra." : (erroAuth?.message ?? "Erro ao criar o login") };
  }

  const { error } = await supabase.rpc("painel_criar_otica", {
    p_nome: nome,
    p_slug: slug,
    p_dono_id: criado.user.id,
    p_dono_nome: donoNome,
    p_dono_email: email,
  });
  if (error) {
    await auth.auth.admin.deleteUser(criado.user.id); // desfaz o login órfão
    return { ok: false, mensagem: error.message };
  }
  revalidatePath("/painel");
  return { ok: true, mensagem: `${nome} criada em teste. Passe o e-mail e a senha temporária para ${donoNome}; a senha aparece só agora.`, senha };
}

function voltar(msg: string, erro = true): never {
  redirect(`/painel?${erro ? "erro" : "ok"}=${encodeURIComponent(msg)}`);
}

const STATUS: Database["public"]["Enums"]["otica_status"][] = ["teste", "ativa", "suspensa", "cancelada"];

export async function mudarStatus(oticaId: string, formulario: FormData) {
  const status = STATUS.find((s) => s === formulario.get("status"));
  if (!status) voltar("Situação inválida");
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("painel_mudar_status", { p_otica: oticaId, p_status: status });
  if (error) voltar(error.message);
  revalidatePath("/painel");
  voltar("Situação atualizada", false);
}

export async function salvarAdicionais(oticaId: string, formulario: FormData) {
  const supabase = await criarClienteServidor();
  const lojasExtras = Math.max(0, Math.floor(Number(formulario.get("multiloja")) || 0));
  for (const [recurso, quantidade] of [
    ["nota_fiscal", formulario.get("nota_fiscal") === "on" ? 1 : 0],
    ["multiloja", lojasExtras],
  ] as const) {
    const { error } = await supabase.rpc("painel_definir_adicional", { p_otica: oticaId, p_recurso: recurso, p_quantidade: quantidade });
    if (error) voltar(error.message);
  }
  revalidatePath("/painel");
  voltar("Adicionais salvos", false);
}
