"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { textoOuNulo } from "@/lib/formatar";

const FUSO = "-03:00"; // Brasil sem horário de verão

export async function marcarConsulta(formulario: FormData) {
  const dia = textoOuNulo(formulario.get("dia")) ?? new Date().toISOString().slice(0, 10);
  const voltar = (msg: string) => redirect(`/agenda?dia=${dia}&erro=${encodeURIComponent(msg)}`);

  const hora = textoOuNulo(formulario.get("hora"));
  if (!hora) return voltar("Informe o horário");
  const minutos = Math.max(15, Number(formulario.get("duracao")) || 30);
  const inicio = new Date(`${dia}T${hora}:00${FUSO}`);
  const fim = new Date(inicio.getTime() + minutos * 60_000);

  const clienteId = textoOuNulo(formulario.get("cliente_id"));
  const nome = textoOuNulo(formulario.get("nome_contato"));
  if (!clienteId && !nome) return voltar("Escolha um cliente ou digite o nome");

  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: loja } = await supabase.from("lojas").select("id").eq("ativa", true).order("criado_em").limit(1).maybeSingle();
  if (!loja) return voltar("Cadastre uma loja primeiro");

  const { error } = await supabase.from("consultas").insert({
    loja_id: loja.id,
    profissional_id: textoOuNulo(formulario.get("profissional_id")) ?? user?.id ?? null,
    cliente_id: clienteId,
    nome_contato: nome,
    telefone_contato: textoOuNulo(formulario.get("telefone_contato")),
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    origem: "loja",
  });
  if (error) {
    return voltar(error.message.includes("consulta_sem_conflito") ? "Esse horário já está ocupado para esse profissional." : error.message);
  }
  revalidatePath("/agenda");
  redirect(`/agenda?dia=${dia}`);
}

const STATUS = ["agendada", "confirmada", "compareceu", "faltou", "cancelada"] as const;

export async function mudarStatus(id: string, dia: string, valor: string) {
  const status = STATUS.find((s) => s === valor);
  if (!status) return;
  const supabase = await criarClienteServidor();
  await supabase.from("consultas").update({ status }).eq("id", id);
  revalidatePath("/agenda");
  redirect(`/agenda?dia=${dia}`);
}
