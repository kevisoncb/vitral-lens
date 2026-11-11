import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { dataHoraBR, moeda } from "@/lib/formatar";
import { linkWhatsApp, mensagemCobrarRetorno } from "@/lib/whatsapp";
import { adicionarItem, pagar, removerItem } from "./actions";
import { moverAtendimentoFormulario } from "../actions";
import { CampoMascara } from "@/components/campo-mascara";

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
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { id } = await params;
  const { erro, ok } = await searchParams;
  const supabase = await criarClienteServidor();

  const [aR, itensR, pagR, osR, oticaR, etapasR, motivosR] = await Promise.all([
    supabase
      .from("atendimentos")
      .select("id, descricao, valor_total, clientes(id, nome, telefone), funil_etapas(nome)")
      .eq("id", id)
      .maybeSingle<Atendimento>(),
    supabase.from("atendimento_itens").select("id, descricao, quantidade, preco_unitario").eq("atendimento_id", id),
    supabase.from("pagamentos").select("id, forma, valor, parcelas, sinal, pago_em").eq("atendimento_id", id).order("pago_em"),
    supabase.from("ordens_servico").select("id, numero").eq("atendimento_id", id).maybeSingle(),
    supabase.from("oticas").select("nome").maybeSingle(),
    supabase.from("funil_etapas").select("id, nome, tipo").eq("visivel", true).order("ordem"),
    supabase.from("motivos_perda").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const { data: catalogo } = await supabase.from("catalogo_itens").select("id, nome, preco, categoria").eq("ativo", true).order("nome").limit(2000);

  const a = aR.data;
  if (!a) notFound();

  const pago = (pagR.data ?? []).reduce((s, p) => s + Number(p.valor), 0);
  const saldo = Math.max(Number(a.valor_total) - pago, 0);
  const zap = a.clientes
    ? linkWhatsApp(a.clientes.telefone, mensagemCobrarRetorno(a.clientes.nome, oticaR.data?.nome ?? "ótica"))
    : null;
  const registrar = pagar.bind(null, id);
  // o orçamento muda até o primeiro pagamento (o banco também confere)
  const orcamentoAberto = (pagR.data ?? []).length === 0;

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

      {ok && <p className="ok" role="status">{ok}</p>}

      <section className="bloco">
        <h2>Orçamento</h2>
        {(itensR.data ?? []).map((i) => (
          <div key={i.id} className="linha-valor">
            <span>{Number(i.quantidade)}× {i.descricao}</span>
            <span className="linha" style={{ gap: 12, flexWrap: "nowrap" }}>
              <strong>{moeda(Number(i.quantidade) * Number(i.preco_unitario))}</strong>
              {orcamentoAberto && (
                <form action={removerItem.bind(null, id, i.id)}>
                  <button type="submit" className="botao-link" aria-label={`Remover ${i.descricao}`}>remover</button>
                </form>
              )}
            </span>
          </div>
        ))}
        {(itensR.data ?? []).length === 0 && <p className="vazio">Sem itens no orçamento. Acrescente abaixo o que o cliente vai levar.</p>}
        <div className="linha-valor total"><span>Total</span><strong>{moeda(a.valor_total)}</strong></div>
        {orcamentoAberto ? (
          <details className="acrescentar-item" open={(itensR.data ?? []).length === 0}>
            <summary className="resumo-abrir">+ Acrescentar item</summary>
            <form action={adicionarItem.bind(null, id)} className="formulario" style={{ marginTop: 10 }}>
              <label className="rotulo">Do catálogo
                <select className="campo" name="catalogo_id" defaultValue="">
                  <option value="">— não está no catálogo (produto novo abaixo) —</option>
                  {(catalogo ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome} ({moeda(c.preco)})</option>)}
                </select>
              </label>
              <div className="grade-campos">
                <label className="rotulo">Ou produto novo<input className="campo" name="nome" placeholder="Ex.: Lente multifocal 1.67" /></label>
                <label className="rotulo">Categoria
                  <select className="campo" name="categoria" defaultValue="lente">
                    <option value="lente">Lente</option>
                    <option value="tratamento">Tratamento</option>
                    <option value="armacao">Armação</option>
                    <option value="lente_contato">Lente de contato</option>
                    <option value="acessorio">Acessório</option>
                    <option value="servico">Serviço</option>
                  </select>
                </label>
                <label className="rotulo">Quantidade<input className="campo" name="quantidade" inputMode="numeric" defaultValue="1" /></label>
                <label className="rotulo">Preço (R$)
                  <CampoMascara mascara="moeda" name="preco" placeholder="do catálogo" />
                </label>
              </div>
              <button className="botao-secundario" type="submit" style={{ alignSelf: "flex-start" }}>Acrescentar ao orçamento</button>
            </form>
          </details>
        ) : (
          <small className="vazio">Orçamento fechado: já tem pagamento.</small>
        )}
      </section>

      <section className="bloco">
        <h2>Pagamentos</h2>
        {(pagR.data ?? []).map((p) => (
          <div key={p.id} className="linha-valor">
            <span>{p.sinal ? "Sinal" : "Pagamento"} · {p.forma}{p.parcelas > 1 ? ` ${p.parcelas}x` : ""} · {dataHoraBR(p.pago_em)}</span>
            <strong>{moeda(p.valor)}</strong>
          </div>
        ))}
        <div className="linha-valor total"><span>Falta pagar</span><strong>{moeda(saldo)}</strong></div>

        {saldo > 0 && (
          <form action={registrar} className="linha">
            {erro && <p className="erro" role="alert">{erro}</p>}
            <label className="rotulo">Valor (R$)
              <CampoMascara mascara="moeda" name="valor" defaultValue={saldo} required />
            </label>
            <label className="rotulo">Forma
              <select className="campo" name="forma" defaultValue="pix">
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="credito">Cartão de crédito</option>
                <option value="debito">Cartão de débito</option>
                <option value="boleto">Boleto</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label className="rotulo">Parcelas
              <input className="campo" name="parcelas" inputMode="numeric" defaultValue="1" />
            </label>
            {!osR.data && (
              <label className="rotulo">Entrega prometida
                <input className="campo" type="date" name="data_prometida" />
              </label>
            )}
            <label className="marcar"><input type="checkbox" name="sinal" /> É sinal</label>
            <button className="botao" type="submit">Registrar pagamento</button>
          </form>
        )}
        <small className="vazio">No primeiro pagamento o atendimento vira “Recuperado/ganho” e a ordem de serviço é criada no laboratório.</small>
      </section>
    </>
  );
}
