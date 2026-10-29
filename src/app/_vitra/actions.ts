"use server";

import { criarClientePublico } from "@/lib/supabase/publico";

export type EstadoLista = { ok: boolean; mensagem: string } | null;

/** Inscrição na lista de espera do Vitra (site do produto, sem login). */
export async function entrarNaLista(_anterior: EstadoLista, formulario: FormData): Promise<EstadoLista> {
  // campo escondido: robôs costumam preencher tudo
  if (String(formulario.get("site") ?? "") !== "") return { ok: true, mensagem: "Pronto!" };

  const lojas = Number(formulario.get("lojas") ?? "");
  const { error } = await criarClientePublico().rpc("entrar_lista_espera", {
    p_nome: String(formulario.get("nome") ?? ""),
    p_otica: String(formulario.get("otica") ?? ""),
    p_cidade: String(formulario.get("cidade") ?? ""),
    p_uf: String(formulario.get("uf") ?? ""),
    p_telefone: String(formulario.get("telefone") ?? ""),
    p_email: String(formulario.get("email") ?? ""),
    p_lojas: Number.isInteger(lojas) && lojas > 0 ? lojas : null,
    p_aceite_lgpd: formulario.get("aceite") === "on",
  });
  if (error) return { ok: false, mensagem: error.message };
  return { ok: true, mensagem: "Você está na lista! Vamos chamar no WhatsApp quando abrir uma vaga para a sua ótica." };
}
