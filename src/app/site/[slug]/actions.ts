"use server";

import { criarClientePublico } from "@/lib/supabase/publico";

export type Estado = { ok: boolean; mensagem: string } | null;

export async function enviarPedido(slug: string, _anterior: Estado, formulario: FormData): Promise<Estado> {
  // campo escondido: robôs costumam preencher tudo
  if (String(formulario.get("site") ?? "") !== "") return { ok: true, mensagem: "Pedido enviado!" };

  const { error } = await criarClientePublico().rpc("pedido_orcamento_site", {
    p_slug: slug,
    p_nome: String(formulario.get("nome") ?? ""),
    p_telefone: String(formulario.get("telefone") ?? ""),
    p_mensagem: String(formulario.get("mensagem") ?? ""),
    p_aceite_lgpd: formulario.get("aceite") === "on",
  });
  if (error) return { ok: false, mensagem: error.message };
  return { ok: true, mensagem: "Pedido enviado! A ótica vai falar com você pelo WhatsApp." };
}

export async function agendar(slug: string, _anterior: Estado, formulario: FormData): Promise<Estado> {
  if (String(formulario.get("site") ?? "") !== "") return { ok: true, mensagem: "Consulta marcada!" };
  const inicio = String(formulario.get("inicio") ?? "");
  if (!inicio) return { ok: false, mensagem: "Escolha um horário" };

  const { error } = await criarClientePublico().rpc("agendar_pelo_site", {
    p_slug: slug,
    p_inicio: inicio,
    p_nome: String(formulario.get("nome") ?? ""),
    p_telefone: String(formulario.get("telefone") ?? ""),
    p_aceite_lgpd: formulario.get("aceite") === "on",
  });
  if (error) return { ok: false, mensagem: error.message };
  return { ok: true, mensagem: "Consulta marcada! A ótica vai confirmar com você pelo WhatsApp." };
}
