import { exigirArea } from "@/lib/sessao";
import { PainelOS } from "@/components/os/painel-os";

export default async function OSNoLaboratorio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await exigirArea("laboratorio");
  return <PainelOS id={id} sessao={sessao} modo="laboratorio" voltar="/producao" />;
}
