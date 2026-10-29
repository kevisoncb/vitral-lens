import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { carregarQuadroOS } from "@/lib/os";
import { AoVivo } from "@/components/ao-vivo";
import { QuadroOS } from "@/components/os/quadro-os";

/** Visão da loja: acompanha as OS, recebe o que "Chegou na loja", avisa e entrega. */
export default async function OrdensDaLoja() {
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();
  const { etapas, cartoes } = await carregarQuadroOS(supabase, sessao?.pode("clientes") ?? false);

  return (
    <>
      <div>
        <h1>Ordens de serviço</h1>
        <p className="subtitulo">
          O laboratório move até “Chegou na loja”. Daqui a loja avisa o cliente pelo WhatsApp e marca a entrega.
        </p>
      </div>
      <AoVivo tabelas={["ordens_servico", "os_mensagens"]} />
      <QuadroOS etapas={etapas} cartoesIniciais={cartoes} nomeOtica={sessao?.oticaNome ?? "ótica"} area={sessao?.area ?? "loja"} linkBase="/laboratorio" />
    </>
  );
}
