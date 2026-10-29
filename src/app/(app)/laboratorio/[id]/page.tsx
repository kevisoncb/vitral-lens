import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao";
import { PainelOS } from "@/components/os/painel-os";

export default async function OSDaLoja({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  return <PainelOS id={id} sessao={sessao} modo="loja" voltar="/laboratorio" />;
}
