"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

export async function pagar(atendimentoId: string, formulario: FormData) {
  const valor = numeroOuNulo(formulario.get("valor"));
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("registrar_pagamento", {
    p_atendimento: atendimentoId,
    p_valor: valor ?? 0,
    p_forma: String(formulario.get("forma") ?? "outro"),
    p_parcelas: Math.max(1, Math.round(numeroOuNulo(formulario.get("parcelas")) ?? 1)),
    p_sinal: formulario.get("sinal") === "on",
    p_data_prometida: textoOuNulo(formulario.get("data_prometida")),
  });
  if (error) redirect(`/vendas/${atendimentoId}?erro=${encodeURIComponent(error.message)}`);
  redirect(`/vendas/${atendimentoId}`);
}
