import { criarClienteServidor } from "@/lib/supabase/servidor";
import { QuadroLab, type EtapaOS, type CartaoOS } from "./quadro-lab";

type Linha = {
  id: string;
  numero: number;
  etapa_id: string;
  descricao: string;
  laboratorio_nome: string | null;
  data_prometida: string | null;
  garantia_ate: string | null;
  etapa_desde: string;
  clientes: { nome: string; telefone: string | null } | null;
};

export default async function PaginaLaboratorio() {
  const supabase = await criarClienteServidor();
  const [etapasR, osR, oticaR] = await Promise.all([
    supabase.from("os_etapas").select("id, nome, final, avisa_cliente").order("ordem"),
    supabase
      .from("ordens_servico")
      .select("id, numero, etapa_id, descricao, laboratorio_nome, data_prometida, garantia_ate, etapa_desde, clientes(nome, telefone)")
      .order("data_prometida", { ascending: true, nullsFirst: false })
      .returns<Linha[]>(),
    supabase.from("oticas").select("nome").maybeSingle(),
  ]);

  const etapas = (etapasR.data ?? []).map((e) => ({
    id: e.id as string,
    nome: e.nome as string,
    final: e.final as boolean,
    avisaCliente: e.avisa_cliente as boolean,
  })) satisfies EtapaOS[];

  const cartoes: CartaoOS[] = (osR.data ?? []).map((o) => ({
    id: o.id,
    numero: o.numero,
    etapaId: o.etapa_id,
    cliente: o.clientes?.nome ?? "Cliente",
    telefone: o.clientes?.telefone ?? null,
    descricao: o.descricao,
    laboratorio: o.laboratorio_nome,
    prometida: o.data_prometida,
    garantiaAte: o.garantia_ate,
    desde: o.etapa_desde,
  }));

  return (
    <>
      <div>
        <h1>Ordens de serviço</h1>
        <p className="subtitulo">
          Ao mover para “Chegou na loja”, aparece o botão que abre o WhatsApp com a mensagem pronta.
        </p>
      </div>
      <QuadroLab etapas={etapas} cartoesIniciais={cartoes} nomeOtica={oticaR.data?.nome ?? "ótica"} />
    </>
  );
}
