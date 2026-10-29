import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { dataHoraBR, moeda } from "@/lib/formatar";
import { linkWhatsApp, mensagemCobrarRetorno } from "@/lib/whatsapp";
import { pagar } from "./actions";

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

  const [aR, itensR, pagR, osR, oticaR] = await Promise.all([
    supabase
      .from("atendimentos")
      .select("id, descricao, valor_total, clientes(id, nome, telefone), funil_etapas(nome)")
      .eq("id", id)
      .maybeSingle<Atendimento>(),
    supabase.from("atendimento_itens").select("id, descricao, quantidade, preco_unitario").eq("atendimento_id", id),
    supabase.from("pagamentos").select("id, forma, valor, parcelas, sinal, pago_em").eq("atendimento_id", id).order("pago_em"),
    supabase.from("ordens_servico").select("id, numero").eq("atendimento_id", id).maybeSingle(),
    supabase.from("oticas").select("nome").maybeSingle(),
  ]);

  const a = aR.data;
  if (!a) notFound();

  const pago = (pagR.data ?? []).reduce((s, p) => s + Number(p.valor), 0);
  const saldo = Math.max(Number(a.valor_total) - pago, 0);
  const zap = a.clientes
    ? linkWhatsApp(a.clientes.telefone, mensagemCobrarRetorno(a.clientes.nome, oticaR.data?.nome ?? "ótica"))
    : null;
  const registrar = pagar.bind(null, id);

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

      <section className="bloco">
        <h2>Orçamento</h2>
        {(itensR.data ?? []).map((i) => (
          <div key={i.id} className="linha-valor">
            <span>{Number(i.quantidade)}× {i.descricao}</span>
            <strong>{moeda(Number(i.quantidade) * Number(i.preco_unitario))}</strong>
          </div>
        ))}
        {(itensR.data ?? []).length === 0 && <p className="vazio">Sem itens no orçamento.</p>}
        <div className="linha-valor total"><span>Total</span><strong>{moeda(a.valor_total)}</strong></div>
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
              <input className="campo" name="valor" inputMode="decimal" defaultValue={saldo.toFixed(2).replace(".", ",")} required />
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
