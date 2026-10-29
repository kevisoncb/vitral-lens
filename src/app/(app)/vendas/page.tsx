import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { QuadroVendas, type Cartao, type Etapa, type Motivo } from "./quadro-vendas";

type LinhaAtendimento = {
  id: string;
  etapa_id: string;
  descricao: string | null;
  valor_total: number;
  etapa_desde: string;
  clientes: { nome: string; telefone: string | null } | null;
};

export default async function PaginaVendas() {
  const supabase = await criarClienteServidor();

  const [etapasResp, motivosResp, atendimentosResp, oticaResp] = await Promise.all([
    supabase.from("funil_etapas").select("id, nome, tipo").eq("visivel", true).order("ordem"),
    supabase.from("motivos_perda").select("id, nome").eq("ativo", true).order("nome"),
    supabase
      .from("atendimentos")
      .select("id, etapa_id, descricao, valor_total, etapa_desde, clientes(nome, telefone)")
      .order("etapa_desde", { ascending: false })
      .returns<LinhaAtendimento[]>(),
    supabase.from("oticas").select("nome").maybeSingle(),
  ]);

  const etapas = (etapasResp.data ?? []) as Etapa[];
  const motivos = (motivosResp.data ?? []) as Motivo[];
  const cartoes: Cartao[] = (atendimentosResp.data ?? []).map((a) => ({
    id: a.id,
    etapaId: a.etapa_id,
    cliente: a.clientes?.nome ?? "Cliente",
    telefone: a.clientes?.telefone ?? null,
    descricao: a.descricao,
    valor: Number(a.valor_total),
    desde: a.etapa_desde,
  }));

  return (
    <>
      <div className="topo">
        <div>
          <h1>Funil de vendas</h1>
          <p className="subtitulo">
            Arraste o card para mudar de etapa. Ao mover para Perdido, o sistema pede o motivo.
          </p>
        </div>
        <Link className="botao" href="/vendas/novo">
          + Novo atendimento
        </Link>
      </div>
      <QuadroVendas
        etapas={etapas}
        motivos={motivos}
        cartoesIniciais={cartoes}
        nomeOtica={oticaResp.data?.nome ?? "ótica"}
      />
    </>
  );
}
