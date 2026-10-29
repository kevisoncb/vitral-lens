"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

/** Abre um exame a partir da consulta da agenda (cadastra o paciente se veio só com nome). */
export async function iniciarExameDaConsulta(consultaId: string) {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: c } = await supabase
    .from("consultas")
    .select("id, cliente_id, nome_contato, telefone_contato")
    .eq("id", consultaId)
    .maybeSingle();
  if (!c) redirect("/consultorio?erro=Consulta não encontrada");

  const { data: aberto } = await supabase.from("exames").select("id").eq("consulta_id", consultaId).maybeSingle();
  if (aberto) redirect(`/consultorio/exame/${aberto.id}`);

  let clienteId = c.cliente_id as string | null;
  if (!clienteId) {
    const { data: novo, error } = await supabase
      .from("clientes")
      .insert({ nome: c.nome_contato ?? "Paciente", telefone: c.telefone_contato, criado_por: user?.id })
      .select("id")
      .single();
    if (error || !novo) redirect(`/consultorio?erro=${encodeURIComponent(error?.message ?? "Não foi possível cadastrar o paciente")}`);
    clienteId = novo.id;
    await supabase.from("consultas").update({ cliente_id: clienteId }).eq("id", consultaId);
  }
  return abrirExame(clienteId!, consultaId);
}

export async function iniciarExameDoPaciente(clienteId: string) {
  return abrirExame(clienteId, null);
}

/** Paciente que chegou sem cadastro e sem agenda. */
export async function novoPaciente(formulario: FormData) {
  const nome = textoOuNulo(formulario.get("nome"));
  if (!nome) redirect("/consultorio?erro=Informe o nome");
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nome,
      telefone: textoOuNulo(formulario.get("telefone")),
      nascimento: textoOuNulo(formulario.get("nascimento")),
      consentimento_lgpd_em: formulario.get("lgpd") ? new Date().toISOString() : null,
      criado_por: user?.id,
    })
    .select("id")
    .single();
  if (error || !data) redirect(`/consultorio?erro=${encodeURIComponent(error?.message ?? "Erro ao cadastrar")}`);
  return abrirExame(data.id, null);
}

async function abrirExame(clienteId: string, consultaId: string | null): Promise<never> {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  // registro profissional: o do último exame dessa pessoa, para não digitar de novo
  const { data: ultimo } = await supabase
    .from("exames")
    .select("registro_profissional")
    .eq("profissional_id", user?.id ?? "")
    .not("registro_profissional", "is", null)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("exames")
    .insert({ cliente_id: clienteId, consulta_id: consultaId, profissional_id: user?.id, registro_profissional: ultimo?.registro_profissional ?? null })
    .select("id")
    .single();
  if (error || !data) redirect(`/consultorio?erro=${encodeURIComponent(error?.message ?? "Erro ao abrir o exame")}`);
  redirect(`/consultorio/exame/${data.id}`);
}

/** Salva o rascunho do exame; com "concluir", gera a receita e manda o card para a loja. */
export async function salvarExame(exameId: string, formulario: FormData) {
  const supabase = await criarClienteServidor();
  const voltar = (msg: string) => redirect(`/consultorio/exame/${exameId}?erro=${encodeURIComponent(msg)}`);
  const sim = (k: string) => (formulario.get(k) === "sim" ? true : formulario.get(k) === "nao" ? false : null);

  const { error } = await supabase
    .from("exames")
    .update({
      registro_profissional: textoOuNulo(formulario.get("registro_profissional")),
      queixa: textoOuNulo(formulario.get("queixa")),
      historico: textoOuNulo(formulario.get("historico")),
      usa_oculos: sim("usa_oculos"),
      usa_lente_contato: sim("usa_lente_contato"),
      observacoes: textoOuNulo(formulario.get("observacoes")),
      conduta: textoOuNulo(formulario.get("conduta")),
      retorno_em: textoOuNulo(formulario.get("retorno_em")),
    })
    .eq("id", exameId);
  if (error) return voltar(error.message);

  const olhos = (["OD", "OE"] as const).map((olho) => ({
    exame_id: exameId,
    olho,
    av_sc: textoOuNulo(formulario.get(`${olho}_av_sc`)),
    av_cc: textoOuNulo(formulario.get(`${olho}_av_cc`)),
    esferico: numeroOuNulo(formulario.get(`${olho}_esferico`)),
    cilindrico: numeroOuNulo(formulario.get(`${olho}_cilindrico`)),
    eixo: numeroOuNulo(formulario.get(`${olho}_eixo`)),
    adicao: numeroOuNulo(formulario.get(`${olho}_adicao`)),
    dnp: numeroOuNulo(formulario.get(`${olho}_dnp`)),
    altura: numeroOuNulo(formulario.get(`${olho}_altura`)),
  }));
  const { error: erroOlhos } = await supabase.from("exame_olhos").upsert(olhos, { onConflict: "exame_id,olho" });
  if (erroOlhos) return voltar(erroOlhos.message);

  if (formulario.get("acao") === "concluir") {
    const { error: erroConcluir } = await supabase.rpc("concluir_exame", { p_exame: exameId });
    if (erroConcluir) return voltar(erroConcluir.message);
    revalidatePath("/consultorio");
    redirect(`/consultorio/exame/${exameId}?concluido=1`);
  }
  revalidatePath(`/consultorio/exame/${exameId}`);
  redirect(`/consultorio/exame/${exameId}?salvo=1`);
}
