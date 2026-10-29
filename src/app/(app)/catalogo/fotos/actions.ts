"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoFoto = { ok: boolean; mensagem: string; url?: string } | null;

/** Guarda a foto (já reduzida no navegador) em produtos/<otica>/<item>/foto.jpg. */
export async function enviarFoto(itemId: string, _anterior: EstadoFoto, formulario: FormData): Promise<EstadoFoto> {
  const foto = formulario.get("foto");
  if (!(foto instanceof File) || foto.size === 0) return { ok: false, mensagem: "Escolha ou tire uma foto." };
  if (foto.size > 5 * 1024 * 1024) return { ok: false, mensagem: "Foto muito grande." };
  if (!foto.type.startsWith("image/")) return { ok: false, mensagem: "O arquivo precisa ser uma imagem." };

  const supabase = await criarClienteServidor();
  const { data: item } = await supabase.from("catalogo_itens").select("id, otica_id").eq("id", itemId).maybeSingle();
  if (!item) return { ok: false, mensagem: "Produto não encontrado." };

  const caminho = `${item.otica_id}/${item.id}/foto-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("produtos").upload(caminho, foto, { contentType: foto.type, upsert: true });
  if (error) return { ok: false, mensagem: error.message };
  // função do banco: quem cadastrou na venda põe a primeira foto; trocar é do gerente
  const { error: erroItem } = await supabase.rpc("definir_foto_produto", { p_item: item.id, p_caminho: caminho });
  if (erroItem) {
    await supabase.storage.from("produtos").remove([caminho]);
    return { ok: false, mensagem: erroItem.message };
  }

  revalidatePath("/catalogo");
  const { data } = supabase.storage.from("produtos").getPublicUrl(caminho);
  return { ok: true, mensagem: "Foto salva.", url: data.publicUrl };
}
