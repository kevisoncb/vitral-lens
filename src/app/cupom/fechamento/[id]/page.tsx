import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigirArea } from "@/lib/sessao";
import { Comprovante, type Resumo } from "./comprovante";

/** Comprovante do fechamento do caixa (80 mm), para conferir e arquivar. Mesma conta do fechamento (resumo_caixa). */
export default async function ComprovanteFechamento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const [{ id }, { ok }] = await Promise.all([params, searchParams]);
  await exigirArea("pdv", "financeiro");
  const supabase = await criarClienteServidor();
  const [{ data, error }, oticaR] = await Promise.all([
    supabase.rpc("resumo_caixa", { p_caixa: id }),
    supabase.from("oticas").select("nome, cnpj").maybeSingle(),
  ]);
  if (error || !data) notFound();
  const r = data as unknown as Resumo;
  return <Comprovante r={r} otica={oticaR.data} ok={ok} />;
}
