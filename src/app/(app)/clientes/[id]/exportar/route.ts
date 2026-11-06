import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/** Baixa tudo o que a ótica tem do cliente (LGPD). O banco confere o perfil e registra quem baixou. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("exportar_cliente", { p_cliente: id });
  if (error || !data) {
    return NextResponse.json({ erro: error?.message ?? "Não foi possível exportar" }, { status: 403 });
  }
  const dia = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dados-do-cliente-${dia}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
