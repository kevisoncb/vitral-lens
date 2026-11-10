import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { dataBR, dataHoraBR, moeda } from "@/lib/formatar";
import { abrirCaixa, fecharCaixa, movimentarCaixa, receberNoCaixa } from "./actions";
import { Venda, type ProdutoPdv } from "./venda";
import { CampoMascara } from "@/components/campo-mascara";

const FORMAS: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito" };

type VendaCaixa = {
  id: string;
  numero: number;
  total: number;
  cancelada: boolean;
  criado_em: string;
  pagamentos: { forma: string; valor: number }[];
  contas_receber: { valor: number }[];
};

export default async function PaginaCaixa({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; receber?: string }> }) {
  const { erro, ok, receber } = await searchParams;
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();

  const { data: caixa } = await supabase
    .from("caixas")
    .select("id, loja_id, aberto_em, valor_abertura, lojas(nome)")
    .eq("operador_id", sessao?.usuarioId ?? "")
    .is("fechado_em", null)
    .returns<{ id: string; loja_id: string; aberto_em: string; valor_abertura: number; lojas: { nome: string } | null }[]>()
    .maybeSingle();

  if (!caixa) {
    // sem o Plano Especial não abre caixa (o banco recusa); com caixa aberto, segue até fechar
    const { data: planoEspecial } = await supabase.rpc("recurso_ativo", { r: "plano_especial" });
    if (!planoEspecial) {
      return (
        <>
          <h1>Caixa</h1>
          <section className="bloco">
            <span className="etiqueta" style={{ alignSelf: "flex-start" }}>Plano Especial</span>
            <h2>PDV e caixa fazem parte do Plano Especial</h2>
            <p>
              Com o Plano Especial a ótica tem o caixa completo: abrir com o troco, venda rápida pelo código de barras, várias formas
              de pagamento e crediário, sangria e suprimento, fechamento com conferência da gaveta e cupom.
            </p>
            <p className="vazio">Para contratar, fale com o suporte do Vitral. O histórico de vendas e caixas continua aberto para consulta.</p>
          </section>
        </>
      );
    }
    const { data: lojas } = await supabase.from("lojas").select("id, nome").eq("ativa", true).order("criado_em");
    return (
      <>
        <h1>Caixa</h1>
        {erro && <p className="erro" role="alert">{erro}</p>}
        {ok && <p className="ok" role="status">{ok}</p>}
        <form action={abrirCaixa} className="bloco formulario">
          <h2>Abrir o caixa</h2>
          <p className="vazio">Conte o dinheiro da gaveta (o troco) antes de começar.</p>
          {(lojas ?? []).length > 1 && (
            <label className="rotulo">Loja
              <select className="campo" name="loja_id" defaultValue={lojas?.[0]?.id}>
                {(lojas ?? []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </label>
          )}
          <label className="rotulo">Dinheiro na gaveta (R$)
            <CampoMascara mascara="moeda" name="valor" defaultValue={100} autoFocus />
          </label>
          <button className="botao" type="submit">Abrir caixa</button>
        </form>
      </>
    );
  }

  const [produtosR, saldosR, vendasR, notaR] = await Promise.all([
    supabase.from("catalogo_itens").select("id, nome, codigo, preco, controla_estoque").eq("ativo", true).order("nome").limit(3000),
    supabase.from("estoque_saldos").select("item_id, quantidade").eq("loja_id", caixa.loja_id),
    supabase
      .from("vendas")
      .select("id, numero, total, cancelada, criado_em, pagamentos(forma, valor), contas_receber(valor)")
      .eq("caixa_id", caixa.id)
      .order("criado_em", { ascending: false })
      .returns<VendaCaixa[]>(),
    supabase.rpc("recurso_ativo", { r: "nota_fiscal" }),
  ]);
  // os números do caixa vêm do banco (a mesma conta do fechamento e do comprovante)
  const { data: resumoR } = await supabase.rpc("resumo_caixa", { p_caixa: caixa.id });
  const resumo = (resumoR ?? {}) as { recebimentos_por_forma?: Record<string, number>; sangrias?: number; suprimentos?: number; devolucoes_dinheiro?: number; esperado?: number };
  const busca = (receber ?? "").trim();
  const { data: pendenciasR } = busca.length >= 2 ? await supabase.rpc("pendencias_para_receber", { p_busca: busca }) : { data: null };
  const pendencias = (pendenciasR ?? []) as { tipo: "oculos" | "parcela"; id: string; cliente: string; descricao: string; total: number; pago: number; saldo: number; vencimento: string | null }[];
  const notaFiscal = notaR.data === true;

  const saldo = new Map((saldosR.data ?? []).map((s) => [s.item_id, s.quantidade]));
  const produtos: ProdutoPdv[] = (produtosR.data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    codigo: p.codigo,
    preco: Number(p.preco),
    saldo: p.controla_estoque ? (saldo.get(p.id) ?? 0) : null,
  }));

  const vendas = vendasR.data ?? [];
  const validas = vendas.filter((v) => !v.cancelada);
  const porForma: Record<string, number> = {};
  for (const v of validas) {
    for (const p of v.pagamentos) porForma[p.forma] = (porForma[p.forma] ?? 0) + Number(p.valor);
    for (const c of v.contas_receber) porForma.crediario = (porForma.crediario ?? 0) + Number(c.valor);
  }
  const sangrias = Number(resumo.sangrias ?? 0);
  const suprimentos = Number(resumo.suprimentos ?? 0);
  const devolucoes = Number(resumo.devolucoes_dinheiro ?? 0);
  const recebimentos = resumo.recebimentos_por_forma ?? {};
  const gaveta = Number(resumo.esperado ?? caixa.valor_abertura);

  return (
    <>
      <div className="topo">
        <div>
          <h1>Caixa</h1>
          <p className="subtitulo">
            Aberto em {dataHoraBR(caixa.aberto_em)}{caixa.lojas ? ` · ${caixa.lojas.nome}` : ""} · {validas.length} {validas.length === 1 ? "venda" : "vendas"}
          </p>
        </div>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}

      <div className="pdv-grade">
        <Venda caixaId={caixa.id} produtos={produtos} notaFiscal={notaFiscal} />

        <aside className="pdv-lado">
          <section className="bloco">
            <h2>Receber óculos ou crediário</h2>
            <form action="/pdv" method="get" className="linha">
              <input className="campo" type="search" name="receber" defaultValue={busca} placeholder="Nome ou telefone do cliente" aria-label="Buscar cliente para receber" />
              <button className="botao-secundario" type="submit">Buscar</button>
            </form>
            {busca.length >= 2 && pendencias.length === 0 && <p className="vazio">Nada para receber de “{busca}”.</p>}
            {pendencias.map((p) => (
              <form key={p.id} action={receberNoCaixa.bind(null, caixa.id, p.tipo, p.id, busca)} className="receber-item">
                <span>
                  <strong>{p.cliente}</strong>
                  <small className="vazio" style={{ display: "block" }}>
                    {p.tipo === "oculos" ? `${p.descricao} · total ${moeda(p.total)} · pago ${moeda(p.pago)}` : `${p.descricao}${p.vencimento ? ` · vence ${dataBR(p.vencimento)}` : ""}`}
                  </small>
                </span>
                <div className="linha" style={{ gap: 8 }}>
                  <CampoMascara mascara="moeda" name="valor" defaultValue={Number(p.saldo)} aria-label="Valor recebido" readOnly={p.tipo === "parcela"} />
                  <select className="campo" name="forma" defaultValue="dinheiro" aria-label="Forma">
                    {Object.entries(FORMAS).map(([f, r]) => <option key={f} value={f}>{r}</option>)}
                  </select>
                  {p.tipo === "oculos" && Number(p.pago) === 0 && (
                    <input className="campo" type="date" name="data_prometida" aria-label="Entrega prometida" title="Entrega prometida (vai para a OS)" />
                  )}
                  <button className="botao" type="submit">Receber</button>
                </div>
              </form>
            ))}
          </section>

          <section className="bloco">
            <h2>Resumo do caixa</h2>
            <div className="linha-valor"><span>Abertura</span><strong>{moeda(caixa.valor_abertura)}</strong></div>
            {Object.entries(FORMAS).map(([f, r]) => (porForma[f] ?? 0) > 0 && (
              <div key={f} className="linha-valor"><span>{r}</span><strong>{moeda(porForma[f])}</strong></div>
            ))}
            {(porForma.crediario ?? 0) > 0 && <div className="linha-valor"><span>Crediário (a receber)</span><strong>{moeda(porForma.crediario)}</strong></div>}
            {Object.entries(FORMAS).map(([f, r]) => Number(recebimentos[f] ?? 0) > 0 && (
              <div key={`r${f}`} className="linha-valor"><span>Recebido (óculos/crediário) · {r}</span><strong>{moeda(recebimentos[f])}</strong></div>
            ))}
            {suprimentos > 0 && <div className="linha-valor"><span>Suprimentos</span><strong>{moeda(suprimentos)}</strong></div>}
            {sangrias > 0 && <div className="linha-valor"><span>Sangrias</span><strong>−{moeda(sangrias)}</strong></div>}
            {devolucoes > 0 && <div className="linha-valor"><span>Devoluções em dinheiro</span><strong>−{moeda(devolucoes)}</strong></div>}
            <div className="linha-valor"><span>Dinheiro na gaveta</span><strong>{moeda(gaveta)}</strong></div>
          </section>

          <section className="bloco">
            <h2>Sangria ou suprimento</h2>
            <form action={movimentarCaixa.bind(null, caixa.id)} className="formulario">
              <div className="linha">
                <select className="campo" name="tipo" defaultValue="sangria" aria-label="Tipo">
                  <option value="sangria">Sangria (tirar)</option>
                  <option value="suprimento">Suprimento (pôr)</option>
                </select>
                <CampoMascara mascara="moeda" name="valor" aria-label="Valor" required />
              </div>
              <input className="campo" name="motivo" placeholder="Motivo (depósito, troco…)" aria-label="Motivo" />
              <button className="botao-secundario" type="submit">Lançar</button>
            </form>
          </section>

          <section className="bloco">
            <h2>Últimas vendas</h2>
            {vendas.slice(0, 8).map((v) => (
              <div key={v.id} className="linha-valor">
                <span>Nº {v.numero} · {dataHoraBR(v.criado_em).slice(-5)}{v.cancelada && " · cancelada"}</span>
                <strong style={v.cancelada ? { textDecoration: "line-through" } : undefined}>{moeda(v.total)}</strong>
              </div>
            ))}
            {vendas.length === 0 && <p className="vazio">Nenhuma venda neste caixa ainda.</p>}
          </section>

          <section className="bloco">
            <h2>Fechar o caixa</h2>
            <form action={fecharCaixa.bind(null, caixa.id)} className="formulario">
              <label className="rotulo">Dinheiro contado na gaveta (R$)
                <CampoMascara mascara="moeda" name="contado" required />
              </label>
              <input className="campo" name="observacao" placeholder="Observação (opcional)" aria-label="Observação" />
              <button className="botao-secundario" type="submit">Fechar caixa</button>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}
