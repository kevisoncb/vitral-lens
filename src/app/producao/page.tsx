import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigirArea } from "@/lib/sessao";
import { carregarQuadroOS } from "@/lib/os";
import { AoVivo } from "@/components/ao-vivo";
import { QuadroOS } from "@/components/os/quadro-os";

/**
 * Quadro do laboratório. "Pago" é a entrada: a OS aparece aqui assim que a loja registra o
 * pagamento. O laboratório puxa, produz e manda para "Chegou na loja"; dali em diante é com a loja.
 */
export default async function QuadroProducao() {
  const sessao = await exigirArea("laboratorio");
  const supabase = await criarClienteServidor();
  const { etapas, cartoes } = await carregarQuadroOS(
    supabase,
    false,
    (e) => e.area === "laboratorio" || e.nome === "Pago",
  );
  const novas = cartoes.filter((c) => etapas[0] && c.etapaId === etapas[0].id).length;

  return (
    <>
      <div>
        <h1>Produção</h1>
        <p className="subtitulo">
          {novas > 0 ? `${novas} ${novas === 1 ? "OS nova" : "OS novas"} esperando. ` : ""}
          Arraste para puxar a OS e avançar; abra o card para a ficha técnica e as etapas.
        </p>
      </div>
      <AoVivo tabelas={["ordens_servico", "os_mensagens"]} />
      <QuadroOS etapas={etapas} cartoesIniciais={cartoes} nomeOtica={sessao.oticaNome} area={sessao.area} linkBase="/producao/os" />
    </>
  );
}
