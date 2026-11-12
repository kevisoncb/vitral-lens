"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { textoOuNulo } from "@/lib/formatar";

const CAMINHO = "/configuracoes/agenda";
const FUSO = "-03:00";

export async function criarHorario(formulario: FormData) {
  const supabase = await criarClienteServidor();
  const dias = formulario.getAll("dia_semana").map(Number).filter((d) => d >= 0 && d <= 6);
  const inicio = textoOuNulo(formulario.get("inicio"));
  const fim = textoOuNulo(formulario.get("fim"));
  const loja = textoOuNulo(formulario.get("loja_id"));
  if (dias.length === 0 || !inicio || !fim || !loja) redirect(`${CAMINHO}?erro=Escolha a loja, os dias e o horário`);
  const linhas = dias.map((d) => ({
    loja_id: loja,
    profissional_id: textoOuNulo(formulario.get("profissional_id")),
    dia_semana: d,
    inicio,
    fim,
    duracao_min: Math.max(10, Number(formulario.get("duracao_min")) || 30),
  }));
  const { error } = await supabase.from("horarios_trabalho").insert(linhas);
  if (error) redirect(`${CAMINHO}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(CAMINHO);
}

export async function excluirHorario(id: string) {
  const supabase = await criarClienteServidor();
  await supabase.from("horarios_trabalho").delete().eq("id", id);
  revalidatePath(CAMINHO);
}

export async function criarBloqueio(formulario: FormData) {
  const de = textoOuNulo(formulario.get("de"));
  const ate = textoOuNulo(formulario.get("ate")) ?? de;
  const loja = textoOuNulo(formulario.get("loja_id"));
  if (!de || !ate || !loja) redirect(`${CAMINHO}?erro=Informe a loja e as datas`);
  const horaIni = textoOuNulo(formulario.get("hora_inicio")) ?? "00:00";
  const horaFim = textoOuNulo(formulario.get("hora_fim"));
  const inicio = new Date(`${de}T${horaIni}:00${FUSO}`);
  // sem hora final = bloqueia até o fim do último dia
  const fim = horaFim ? new Date(`${ate}T${horaFim}:00${FUSO}`) : new Date(new Date(`${ate}T00:00:00${FUSO}`).getTime() + 86_400_000);
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("bloqueios_agenda").insert({
    loja_id: loja,
    profissional_id: textoOuNulo(formulario.get("profissional_id")),
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    motivo: textoOuNulo(formulario.get("motivo")),
  });
  if (error) redirect(`${CAMINHO}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(CAMINHO);
}

export async function excluirBloqueio(id: string) {
  const supabase = await criarClienteServidor();
  await supabase.from("bloqueios_agenda").delete().eq("id", id);
  revalidatePath(CAMINHO);
}
