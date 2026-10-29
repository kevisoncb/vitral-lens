import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { dataBR, dataHoraBR, grau, moeda } from "@/lib/formatar";
import { linkWhatsApp } from "@/lib/whatsapp";
import { adicionarAnotacao } from "./actions";

type Olho = {
  olho: "OD" | "OE";
  distancia: "longe" | "perto";
  esferico: number | null;
  cilindrico: number | null;
  eixo: number | null;
  adicao: number | null;
  dnp: number | null;
  altura: number | null;
};
type Receita = {
  id: string;
  data_receita: string;
  tipo: string;
  medico: string | null;
  validade: string | null;
  receita_olhos: Olho[];
};

export default async function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await criarClienteServidor();

  const [clienteR, receitasR, anotacoesR, atendimentosR, oticaR] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("receitas")
      .select("id, data_receita, tipo, medico, validade, receita_olhos(olho, distancia, esferico, cilindrico, eixo, adicao, dnp, altura)")
      .eq("cliente_id", id)
      .order("data_receita", { ascending: false })
      .returns<Receita[]>(),
    supabase
      .from("anotacoes_cliente")
      .select("id, texto, criado_em, usuarios(nome)")
      .eq("cliente_id", id)
      .order("criado_em", { ascending: false })
      .returns<{ id: string; texto: string; criado_em: string; usuarios: { nome: string } | null }[]>(),
    supabase
      .from("atendimentos")
      .select("id, descricao, valor_total, criado_em, funil_etapas(nome)")
      .eq("cliente_id", id)
      .order("criado_em", { ascending: false })
      .returns<{ id: string; descricao: string | null; valor_total: number; criado_em: string; funil_etapas: { nome: string } | null }[]>(),
    supabase.from("oticas").select("nome").maybeSingle(),
  ]);

  const cliente = clienteR.data;
  if (!cliente) notFound();
  const zap = linkWhatsApp(cliente.telefone, `Olá ${cliente.nome.split(" ")[0]}, tudo bem? Aqui é da ${oticaR.data?.nome ?? "ótica"}.`);
  const adicionar = adicionarAnotacao.bind(null, id);

  return (
    <>
      <div className="topo">
        <div>
          <h1>{cliente.nome}</h1>
          <p className="subtitulo">
            {cliente.telefone ?? "sem telefone"}
            {cliente.nascimento ? ` · nasc. ${dataBR(cliente.nascimento)}` : ""}
            {cliente.consentimento_lgpd_em ? " · LGPD ok" : " · sem consentimento LGPD"}
          </p>
        </div>
        <div className="topo-acoes">
          {zap && <a className="botao-secundario" href={zap} target="_blank" rel="noreferrer">WhatsApp</a>}
          <Link className="botao-secundario" href={`/vendas/novo?cliente=${id}`}>+ Atendimento</Link>
          <Link className="botao" href={`/clientes/${id}/receita/nova`}>+ Nova receita</Link>
        </div>
      </div>

      <section className="bloco">
        <h2>Receitas</h2>
        {(receitasR.data ?? []).length === 0 && <p className="vazio">Nenhuma receita cadastrada.</p>}
        {(receitasR.data ?? []).map((r) => (
          <article key={r.id} className="receita">
            <header>
              <strong>{dataBR(r.data_receita)}</strong>
              <span>{r.tipo === "contato" ? "Lente de contato" : "Óculos"}</span>
              {r.medico && <span>{r.medico}</span>}
              {r.validade && <span>validade {dataBR(r.validade)}</span>}
            </header>
            <div className="tabela-receita" role="table" aria-label="Grau">
              {["", "Esf.", "Cil.", "Eixo", "Adição", "DNP", "Altura"].map((t) => (
                <span key={t} className="th" role="columnheader">{t}</span>
              ))}
              {[...r.receita_olhos]
                .sort((a, b) => (a.olho === b.olho ? a.distancia.localeCompare(b.distancia) : a.olho === "OD" ? -1 : 1))
                .map((o) => (
                  <Linha key={o.olho + o.distancia} o={o} />
                ))}
            </div>
          </article>
        ))}
      </section>

      <section className="bloco">
        <h2>Atendimentos</h2>
        {(atendimentosR.data ?? []).length === 0 && <p className="vazio">Nenhum atendimento.</p>}
        {(atendimentosR.data ?? []).map((a) => (
          <Link key={a.id} className="lista-item" href={`/vendas/${a.id}`}>
            <strong>{a.descricao ?? "Atendimento"}</strong>
            <span>{a.funil_etapas?.nome} · {moeda(a.valor_total)}</span>
            <small>{dataBR(a.criado_em)}</small>
          </Link>
        ))}
      </section>

      <section className="bloco">
        <h2>Anotações</h2>
        <form action={adicionar} className="linha">
          <input className="campo" name="texto" placeholder="Ex.: prefere armação leve, alérgico a níquel" required aria-label="Nova anotação" />
          <button className="botao" type="submit">Adicionar</button>
        </form>
        {(anotacoesR.data ?? []).map((n) => (
          <p key={n.id} className="anotacao">
            {n.texto}
            <small> — {n.usuarios?.nome ?? "?"}, {dataHoraBR(n.criado_em)}</small>
          </p>
        ))}
      </section>
    </>
  );
}

function Linha({ o }: { o: Olho }) {
  return (
    <>
      <span className="td"><strong>{o.olho}</strong> {o.distancia === "perto" ? "(perto)" : ""}</span>
      <span className="td">{grau(o.esferico)}</span>
      <span className="td">{grau(o.cilindrico)}</span>
      <span className="td">{o.eixo ?? "—"}°</span>
      <span className="td">{grau(o.adicao)}</span>
      <span className="td">{o.dnp ?? "—"}</span>
      <span className="td">{o.altura ?? "—"}</span>
    </>
  );
}
