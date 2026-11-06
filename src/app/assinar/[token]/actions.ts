"use server";

import { headers } from "next/headers";
import { criarClientePublico } from "@/lib/supabase/publico";

/** O cliente assina pelo link (sem login). O banco confere o código, o prazo, o nome e o traço. */
export async function assinarOS(token: string, nome: string, imagem: string): Promise<{ ok: boolean; mensagem?: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const { error } = await criarClientePublico().rpc("assinar_os", {
    p_token: token,
    p_nome: nome,
    p_assinatura: imagem,
    p_ip: ip,
    p_navegador: h.get("user-agent"),
  });
  if (error) return { ok: false, mensagem: error.message };
  return { ok: true };
}
