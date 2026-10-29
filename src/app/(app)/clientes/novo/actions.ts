"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { textoOuNulo } from "@/lib/formatar";

export async function criarCliente(formulario: FormData) {
  const nome = textoOuNulo(formulario.get("nome"));
  if (!nome) redirect("/clientes/novo?erro=Informe o nome");

  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nome,
      telefone: textoOuNulo(formulario.get("telefone")),
      email: textoOuNulo(formulario.get("email")),
      cpf: textoOuNulo(formulario.get("cpf")),
      nascimento: textoOuNulo(formulario.get("nascimento")),
      endereco: textoOuNulo(formulario.get("endereco")),
      consentimento_lgpd_em: formulario.get("lgpd") ? new Date().toISOString() : null,
      criado_por: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/clientes/novo?erro=${encodeURIComponent(error?.message ?? "Não foi possível salvar")}`);
  }
  redirect(`/clientes/${data.id}`);
}
