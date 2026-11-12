"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import type { LinhaCliente, LinhaProduto, TipoImportacao } from "@/lib/planilha";

export type ResultadoImportacao = {
  ok: boolean;
  mensagem?: string;
  inseridos: number;
  repetidos: number;
  erros: { linha: number; motivo: string }[];
};

/** Manda um pedaço da planilha (até 1.000 linhas) para o banco. O banco confere permissão e repetidos. */
export async function importarLote(
  tipo: TipoImportacao,
  linhas: LinhaCliente[] | LinhaProduto[],
): Promise<ResultadoImportacao> {
  if (!Array.isArray(linhas) || linhas.length === 0 || linhas.length > 1000) {
    return { ok: false, mensagem: "Lote inválido", inseridos: 0, repetidos: 0, erros: [] };
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc(tipo === "clientes" ? "importar_clientes" : "importar_produtos", {
    p_linhas: linhas,
  });
  if (error) return { ok: false, mensagem: error.message, inseridos: 0, repetidos: 0, erros: [] };
  const r = data as { inseridos: number; repetidos: number; erros: { linha: number; motivo: string }[] };
  revalidatePath(tipo === "clientes" ? "/clientes" : "/catalogo");
  return { ok: true, inseridos: r.inseridos, repetidos: r.repetidos, erros: r.erros };
}
