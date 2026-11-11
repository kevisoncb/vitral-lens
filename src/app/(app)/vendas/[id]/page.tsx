import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { linkWhatsApp, mensagemCobrarRetorno } from "@/lib/whatsapp";
import { dadosDoAtendimento } from "./actions";
import { OrcamentoAtendimento } from "./orcamento";
import { moverAtendimentoFormulario } from "../actions";

type Atendimento = {
  id: string;
  descricao: string | null;
  valor_total: number;
  clientes: { id: string; nome: string; telefone: string | null } | null;
  funil_etapas: { nome: string } | null;
};

export default async function DetalheAtendimento({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const supabase = await criarClienteServidor();

  const [aR, osR, oticaR, etapasR, motivosR] = await Promise.all([
    supabase
      .from("atendimentos")
      .select("id, descricao, valor_total, clientes(id, nome, telefone), funil_etapas(nome)")
      .eq("id", id)
      .maybeSingle<Atendimento>(),
    supabase.from("ordens_servico").select("id, numero").eq("atendimento_id", id).maybeSingle(),
    supabase.from("oticas").select("nome").maybeSingle(),
    supabase.from("funil_etapas").select("id, nome, tipo").eq("visivel", true).order("ordem"),
    supabase.from("motivos_perda").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const { data: catalogo } = await supabase.from("catalogo_itens").select("id, nome, preco, categoria").eq("ativo", true).order("nome").limit(2000);

  const a = aR.data;
  if (!a) notFound();

  const zap = a.clientes
    ? linkWhatsApp(a.clientes.telefone, mensagemCobrarRetorno(a.clientes.nome, oticaR.data?.nome ?? "ótica"))
    : null;

  return (
    <>
      <div className="topo">
        <div>
          <h1>{a.descricao ?? "Atendimento"}</h1>
          <p className="subtitulo">
            <Link href={`/clientes/${a.clientes?.id}`}>{a.clientes?.nome}</Link> · etapa: {a.funil_etapas?.nome}
            {osR.data ? ` · OS ${osR.data.numero}` : ""}
          </p>
        </div>
        <div className="topo-acoes">
          {zap && <a className="botao-secundario" href={zap} target="_blank" rel="noreferrer">Cobrar retorno no WhatsApp</a>}
          <Link className="botao-secundario" href="/vendas">Voltar ao funil</Link>
        </div>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}

      <form action={moverAtendimentoFormulario.bind(null, id)} className="bloco linha">
        <label className="rotulo">Mover para
          <select className="campo" name="etapa_id" defaultValue="">
            <option value="" disabled>Escolha a etapa</option>
            {(etapasR.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </label>
        <label className="rotulo">Motivo (se for perdido)
          <select className="campo" name="motivo_perda_id" defaultValue="">
            <option value="">—</option>
            {(motivosR.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </label>
        <label className="rotulo">Observação<input className="campo" name="observacao" /></label>
        <button className="botao-secundario" type="submit">Mover</button>
      </form>

      <OrcamentoAtendimento
        atendimentoId={id}
        inicial={await dadosDoAtendimento(supabase, id)}
        catalogo={(catalogo ?? []).map((c) => ({ id: c.id, nome: c.nome, preco: Number(c.preco) }))}
      />
    </>
  );
}
