import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { dataBR, dataHoraBR, grau, moeda } from "@/lib/formatar";
import { linkWhatsApp } from "@/lib/whatsapp";
import { adicionarAnotacao, anonimizar } from "./actions";
import { obterSessao } from "@/lib/sessao";
import { registrarAcessoSaude, ROTULO_ACESSO } from "@/lib/lgpd";
import { LinhaDoTempo } from "@/components/linha-do-tempo";

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

export default async function FichaCliente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { id } = await params;
  const { erro, ok } = await searchParams;
  const sessao = await obterSessao();
  const donoDosDados = sessao?.pode("clientes", "excluir") ?? false;
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
  if ((receitasR.data ?? []).length > 0) await registrarAcessoSaude(supabase, id, "viu_receita", "ficha do cliente");
  const acessos = donoDosDados
    ? (await supabase
        .from("acessos_dados_cliente")
        .select("id, acao, origem, criado_em, usuarios(nome)")
        .eq("cliente_id", id)
        .order("criado_em", { ascending: false })
        .limit(20)
        .returns<{ id: string; acao: string; origem: string | null; criado_em: string; usuarios: { nome: string } | null }[]>()).data ?? []
    : [];
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

      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}
      {cliente.anonimizado_em && (
        <p className="aviso" role="status">
          Cliente anonimizado em {dataBR(cliente.anonimizado_em)} a pedido dele (LGPD). Receitas, exames e vendas ficam guardados sem o nome, pelo prazo da lei.
        </p>
      )}

      <LinhaDoTempo clienteId={id} />

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

      {donoDosDados && (
        <section className="bloco">
          <h2>Dados do cliente (LGPD)</h2>
          <p className="vazio">Só o dono e o gerente veem esta parte. O cliente tem direito de pedir uma cópia dos dados dele e de pedir para ser esquecido.</p>
          <div className="linha" style={{ gap: 12 }}>
            <a className="botao-secundario" href={`/clientes/${id}/exportar`} download>Baixar todos os dados do cliente</a>
          </div>
          {!cliente.anonimizado_em && (
            <details>
              <summary className="resumo-abrir" style={{ color: "var(--erro-texto)" }}>Anonimizar (o cliente pediu para ser esquecido)</summary>
              <form action={anonimizar.bind(null, id)} className="formulario" style={{ marginTop: 12, maxWidth: 460 }}>
                <p>
                  Apaga nome, telefone, e-mail, CPF, nascimento, endereço e anotações. Receitas, exames e vendas continuam, sem o nome,
                  porque a lei manda guardar. <strong>Não tem como desfazer.</strong> Baixe os dados antes, se o cliente pediu uma cópia.
                </p>
                <label className="rotulo">Para confirmar, digite o nome do cliente: <em>{cliente.nome}</em>
                  <input className="campo" name="confirmacao" required autoComplete="off" />
                </label>
                <button className="botao-perigo" type="submit">Anonimizar para sempre</button>
              </form>
            </details>
          )}
          <h3 style={{ marginTop: 8 }}>Quem acessou os dados de saúde</h3>
          {acessos.length === 0 ? (
            <p className="vazio">Ninguém registrado ainda.</p>
          ) : (
            acessos.map((a) => (
              <div key={a.id} className="linha-valor">
                <span>{a.usuarios?.nome ?? "?"} {ROTULO_ACESSO[a.acao] ?? a.acao}{a.origem ? ` (${a.origem})` : ""}</span>
                <small>{dataHoraBR(a.criado_em)}</small>
              </div>
            ))
          )}
        </section>
      )}
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
