"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export async function entrar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    redirect("/login?erro=campos");
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    // a tela diz só "credenciais"; o motivo real fica no registro do servidor (sem a senha)
    console.error(`login recusado: ${error.status ?? ""} ${error.code ?? ""} ${error.message}`);
    redirect("/login?erro=credenciais");
  }

  redirect("/inicio");
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
