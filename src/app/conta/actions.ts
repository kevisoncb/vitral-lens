"use server";

import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoSenha = { ok: boolean; mensagem: string } | null;

export async function trocarSenha(_anterior: EstadoSenha, formulario: FormData): Promise<EstadoSenha> {
  const senha = String(formulario.get("senha") ?? "");
  if (senha.length < 8) return { ok: false, mensagem: "A senha precisa ter pelo menos 8 caracteres." };
  if (senha !== String(formulario.get("confirmar") ?? "")) return { ok: false, mensagem: "As senhas não conferem." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { ok: false, mensagem: error.message };
  return { ok: true, mensagem: "Senha alterada." };
}
