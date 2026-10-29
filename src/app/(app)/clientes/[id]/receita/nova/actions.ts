"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { numeroOuNulo, textoOuNulo } from "@/lib/formatar";

export async function criarReceita(clienteId: string, formulario: FormData) {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  const voltar = (msg: string) => redirect(`/clientes/${clienteId}/receita/nova?erro=${encodeURIComponent(msg)}`);

  const { data: receita, error } = await supabase
    .from("receitas")
    .insert({
      cliente_id: clienteId,
      data_receita: textoOuNulo(formulario.get("data_receita")) ?? new Date().toISOString().slice(0, 10),
      tipo: formulario.get("tipo") === "contato" ? "contato" : "oculos",
      medico: textoOuNulo(formulario.get("medico")),
      crm: textoOuNulo(formulario.get("crm")),
      validade: textoOuNulo(formulario.get("validade")),
      externa: formulario.get("externa") === "on",
      observacao: textoOuNulo(formulario.get("observacao")),
      criado_por: user?.id ?? null,
    })
    .select("id, otica_id")
    .single();
  if (error || !receita) return voltar(error?.message ?? "Não foi possível salvar a receita");

  // um registro por olho; ignora o olho em que nada foi preenchido
  const olhos = (["OD", "OE"] as const)
    .map((olho) => ({
      receita_id: receita.id,
      olho,
      distancia: "longe" as const,
      esferico: numeroOuNulo(formulario.get(`${olho}_esferico`)),
      cilindrico: numeroOuNulo(formulario.get(`${olho}_cilindrico`)),
      eixo: numeroOuNulo(formulario.get(`${olho}_eixo`)),
      adicao: numeroOuNulo(formulario.get(`${olho}_adicao`)),
      dnp: numeroOuNulo(formulario.get(`${olho}_dnp`)),
      altura: numeroOuNulo(formulario.get(`${olho}_altura`)),
      prisma: numeroOuNulo(formulario.get(`${olho}_prisma`)),
      base: textoOuNulo(formulario.get(`${olho}_base`)),
      curva_base: numeroOuNulo(formulario.get(`${olho}_curva_base`)),
      diametro: numeroOuNulo(formulario.get(`${olho}_diametro`)),
    }))
    .filter((o) => [o.esferico, o.cilindrico, o.eixo, o.adicao, o.dnp, o.altura, o.prisma, o.curva_base, o.diametro].some((v) => v !== null));

  if (olhos.length > 0) {
    const { error: erroOlhos } = await supabase.from("receita_olhos").insert(olhos);
    if (erroOlhos) return voltar(erroOlhos.message);
  }

  // anexo (foto/PDF) no Storage, pasta por ótica: <otica_id>/<receita_id>/<arquivo>
  const anexo = formulario.get("anexo");
  if (anexo instanceof File && anexo.size > 0) {
    const nome = anexo.name.replace(/[^\w.\-]/g, "_");
    const caminho = `${receita.otica_id}/${receita.id}/${nome}`;
    const { error: erroUpload } = await supabase.storage.from("receitas").upload(caminho, anexo);
    if (!erroUpload) await supabase.from("receitas").update({ anexo_path: caminho }).eq("id", receita.id);
  }

  redirect(`/clientes/${clienteId}`);
}
