"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/** Dá código interno (2 + 9 dígitos) aos produtos escolhidos que ainda não têm. */
export async function gerarCodigos(ids: string[]): Promise<{ ok: boolean; mensagem: string }> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("gerar_codigos_catalogo", { p_itens: ids.length ? ids : null });
  if (error) return { ok: false, mensagem: error.message };
  revalidatePath("/catalogo/etiquetas");
  return { ok: true, mensagem: data === 1 ? "1 produto ganhou código." : `${data ?? 0} produtos ganharam código.` };
}
