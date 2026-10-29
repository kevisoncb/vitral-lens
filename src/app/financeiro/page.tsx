import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { mesAnterior, mesDoParametro, moeda, nomeMes, proximoMes } from "@/lib/formatar";
import { pagarComissoesDoMes, salvarAliquota } from "./actions";

const FORMAS: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito", boleto: "Boleto", outro: "Outro" };
const TIPOS: Record<string, string> = { fornecedor: "Fornecedores", fixo: "Custos fixos", imposto: "Impostos", servico: "Serviços", comissao: "Comissões", outro: "Outros" };

type Pagamento = { valor: number; forma: string; atendimento_id: string | null; venda_id: string | null; vendas: { cancelada: boolean } | null };
type ContaPaga = { valor: number; categorias_custo: { nome: string; tipo: string } | null };

/** Fluxo do mês: o que entrou, o que saiu, o que vence, impostos e comissões a pagar. */
export default async function VisaoDoMes({ searchParams }: { searchParams: Promise<{ mes?: string; erro?: string; ok?: string }> }) {
  const { mes: mesParam, erro, ok } = await searchParams;
  const mes = mesDoParametro(mesParam);
  const de = `${mes}-01`;
  const ate = `${proximoMes(mes)}-01`;
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();

  const [pagR, recebidasR, pagasR, abertasPagarR, abertasReceberR, comR, oticaR] = await Promise.all([
    supabase.from("pagamentos").select("valor, forma, atendimento_id, venda_id, vendas(cancelada)")
      .gte("pago_em", `${de}T00:00:00-03:00`).lt("pago_em", `${ate}T00:00:00-03:00`).returns<Pagamento[]>(),
    supabase.from("contas_receber").select("valor, recebido_forma").gte("recebido_em", de).lt("recebido_em", ate),
    supabase.from("contas_pagar").select("valor, categorias_custo(nome, tipo)").gte("pago_em", de).lt("pago_em", ate).returns<ContaPaga[]>(),
    supabase.from("contas_pagar").select("valor, vencimento").is("pago_em", null).lt("vencimento", ate),
    supabase.from("contas_receber").select("valor, vencimento").is("recebido_em", null).lt("vencimento", ate),
    supabase.from("comissoes").select("id, valor, status").eq("competencia", de).neq("status", "cancelada"),
    supabase.from("oticas").select("aliquota_imposto").maybeSingle(),
  ]);

  const pagamentos = (pagR.data ?? []).filter((p) => !p.vendas?.cancelada);
  const vendas = pagamentos.reduce((s, p) => s + Number(p.valor), 0);
  const doFunil = pagamentos.filter((p) => p.atendimento_id).reduce((s, p) => s + Number(p.valor), 0);
  const recebidas = (recebidasR.data ?? []).reduce((s, c) => s + Number(c.valor), 0);
  const entradas = vendas + recebidas;
  const pagas = pagasR.data ?? [];
  const saidas = pagas.reduce((s, c) => s + Number(c.valor), 0);

  const porForma: Record<string, number> = {};
  for (const p of pagamentos) porForma[p.forma] = (porForma[p.forma] ?? 0) + Number(p.valor);
  for (const c of recebidasR.data ?? []) {
    const f = c.recebido_forma ?? "outro";
    porForma[f] = (porForma[f] ?? 0) + Number(c.valor);
  }
  const porTipo: Record<string, number> = {};
  for (const c of pagas) {
    const t = c.categorias_custo?.tipo ?? "outro";
    porTipo[t] = (porTipo[t] ?? 0) + Number(c.valor);
  }

  const soma = (l: { valor: number }[]) => l.reduce((s, x) => s + Number(x.valor), 0);
  const pagarVencidas = (abertasPagarR.data ?? []).filter((c) => c.vencimento < hoje);
  const receberVencidas = (abertasReceberR.data ?? []).filter((c) => c.vencimento < hoje);
  const comissoes = comR.data ?? [];
  const comissoesAbertas = comissoes.filter((c) => c.status === "aberta");
  const aliquota = oticaR.data?.aliquota_imposto !== null && oticaR.data?.aliquota_imposto !== undefined ? Number(oticaR.data.aliquota_imposto) : null;
  const impostoEstimado = aliquota !== null ? entradas * aliquota / 100 : null;
  const podeEditar = sessao?.pode("financeiro", "editar") ?? false;

  return (
    <>
      <div className="topo">
        <div>
          <h1>Financeiro</h1>
          <p className="subtitulo">Regime de caixa: conta o que entrou e saiu de fato no mês.</p>
        </div>
        <nav className="topo-acoes" aria-label="Mês">
          <Link className="botao-secundario" href={`/financeiro?mes=${mesAnterior(mes)}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }} aria-label="Mês anterior">←</Link>
          <strong style={{ textTransform: "capitalize" }}>{nomeMes(mes)}</strong>
          <Link className="botao-secundario" href={`/financeiro?mes=${proximoMes(mes)}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }} aria-label="Próximo mês">→</Link>
          <a className="botao-secundario" href={`/financeiro/exportar?mes=${mes}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Exportar para o contador</a>
        </nav>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}

      <div className="resumo">
        <div className="resumo-cartao"><span>Entradas</span><strong>{moeda(entradas)}</strong><small>vendas {moeda(vendas)} · crediário {moeda(recebidas)}</small></div>
        <div className="resumo-cartao"><span>Saídas</span><strong>{moeda(saidas)}</strong><small>{pagas.length} contas pagas</small></div>
        <div className="resumo-cartao"><span>Resultado do mês</span><strong className={entradas - saidas < 0 ? "erro-texto" : undefined}>{moeda(entradas - saidas)}</strong></div>
        <Link className="resumo-cartao cartao-link" href="/financeiro/pagar">
          <span>A pagar até o fim do mês</span><strong>{moeda(soma(abertasPagarR.data ?? []))}</strong>
          <small className={pagarVencidas.length ? "erro-texto" : undefined}>{pagarVencidas.length} vencidas · {moeda(soma(pagarVencidas))}</small>
        </Link>
        <Link className="resumo-cartao cartao-link" href="/financeiro/receber">
          <span>A receber até o fim do mês</span><strong>{moeda(soma(abertasReceberR.data ?? []))}</strong>
          <small className={receberVencidas.length ? "erro-texto" : undefined}>{receberVencidas.length} atrasadas · {moeda(soma(receberVencidas))}</small>
        </Link>
      </div>

      <div className="duas-colunas">
        <section className="bloco">
          <h2>Entradas por forma</h2>
          {Object.entries(porForma).sort((a, b) => b[1] - a[1]).map(([f, v]) => (
            <div key={f} className="linha-valor"><span>{FORMAS[f] ?? f}</span><strong>{moeda(v)}</strong></div>
          ))}
          {entradas === 0 && <p className="vazio">Nada entrou neste mês.</p>}
          {doFunil > 0 && <small className="vazio">Inclui {moeda(doFunil)} de sinais e saldos das vendas do funil.</small>}
        </section>

        <section className="bloco">
          <h2>Saídas por tipo</h2>
          {Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([t, v]) => (
            <div key={t} className="linha-valor"><span>{TIPOS[t] ?? t}</span><strong>{moeda(v)}</strong></div>
          ))}
          {saidas === 0 && <p className="vazio">Nenhuma conta paga neste mês.</p>}
        </section>
      </div>

      <div className="duas-colunas">
        <section className="bloco">
          <h2>Impostos</h2>
          <div className="linha-valor"><span>Pagos no mês (categorias de imposto)</span><strong>{moeda(porTipo.imposto ?? 0)}</strong></div>
          <div className="linha-valor">
            <span>Estimativa sobre as entradas{aliquota !== null ? ` (${String(aliquota).replace(".", ",")}%)` : ""}</span>
            <strong>{impostoEstimado !== null ? moeda(impostoEstimado) : "—"}</strong>
          </div>
          {sessao?.pode("configuracoes", "editar") ? (
            <form action={salvarAliquota.bind(null, mes)} className="linha">
              <label className="rotulo" style={{ flex: "0 1 200px" }}>Alíquota (Simples Nacional, %)
                <input className="campo" name="aliquota" inputMode="decimal" defaultValue={aliquota !== null ? String(aliquota).replace(".", ",") : ""} placeholder="Ex.: 6" />
              </label>
              <button className="botao-secundario" type="submit">Salvar</button>
            </form>
          ) : (
            <small className="vazio">A alíquota é definida por quem edita as configurações da ótica.</small>
          )}
          <small className="vazio">Estimativa para planejar; o valor oficial vem do contador.</small>
        </section>

        <section className="bloco">
          <h2>Comissões do mês</h2>
          <div className="linha-valor"><span>Total</span><strong>{moeda(soma(comissoes))}</strong></div>
          <div className="linha-valor"><span>A pagar</span><strong>{moeda(soma(comissoesAbertas))}</strong></div>
          {comissoesAbertas.length > 0 && sessao?.pode("comissoes", "editar") && (
            <form action={pagarComissoesDoMes.bind(null, mes, comissoesAbertas.map((c) => c.id))}>
              <button className="botao-secundario" type="submit">Marcar todas como pagas</button>
            </form>
          )}
          {podeEditar && <small className="vazio">Lance o pagamento das comissões em Contas a pagar, na categoria Comissões, para entrar nas saídas.</small>}
        </section>
      </div>
    </>
  );
}
