import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { dataHoraBR, moeda } from "@/lib/formatar";
import { abrirCaixa, fecharCaixa, movimentarCaixa } from "./actions";
import { Venda, type ProdutoPdv } from "./venda";

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

export default async function PaginaCaixa({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { erro, ok } = await searchParams;
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
            <input className="campo" name="valor" inputMode="decimal" placeholder="0,00" autoFocus />
          </label>
          <button className="botao" type="submit">Abrir caixa</button>
        </form>
      </>
    );
  }

  const [produtosR, saldosR, vendasR, movR] = await Promise.all([
    supabase.from("catalogo_itens").select("id, nome, codigo, preco, controla_estoque").eq("ativo", true).order("nome").limit(3000),
    supabase.from("estoque_saldos").select("item_id, quantidade").eq("loja_id", caixa.loja_id),
    supabase
      .from("vendas")
      .select("id, numero, total, cancelada, criado_em, pagamentos(forma, valor), contas_receber(valor)")
      .eq("caixa_id", caixa.id)
      .order("criado_em", { ascending: false })
      .returns<VendaCaixa[]>(),
    supabase.from("caixa_movimentos").select("id, tipo, valor, motivo, criado_em").eq("caixa_id", caixa.id).order("criado_em"),
  ]);

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
  const movimentos = movR.data ?? [];
  const sangrias = movimentos.filter((m) => m.tipo === "sangria").reduce((s, m) => s + Number(m.valor), 0);
  const suprimentos = movimentos.filter((m) => m.tipo === "suprimento").reduce((s, m) => s + Number(m.valor), 0);
  const gaveta = Number(caixa.valor_abertura) + (porForma.dinheiro ?? 0) + suprimentos - sangrias;

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
        <Venda caixaId={caixa.id} produtos={produtos} />

        <aside className="pdv-lado">
          <section className="bloco">
            <h2>Resumo do caixa</h2>
            <div className="linha-valor"><span>Abertura</span><strong>{moeda(caixa.valor_abertura)}</strong></div>
            {Object.entries(FORMAS).map(([f, r]) => (porForma[f] ?? 0) > 0 && (
              <div key={f} className="linha-valor"><span>{r}</span><strong>{moeda(porForma[f])}</strong></div>
            ))}
            {(porForma.crediario ?? 0) > 0 && <div className="linha-valor"><span>Crediário (a receber)</span><strong>{moeda(porForma.crediario)}</strong></div>}
            {suprimentos > 0 && <div className="linha-valor"><span>Suprimentos</span><strong>{moeda(suprimentos)}</strong></div>}
            {sangrias > 0 && <div className="linha-valor"><span>Sangrias</span><strong>−{moeda(sangrias)}</strong></div>}
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
                <input className="campo" name="valor" inputMode="decimal" placeholder="R$" aria-label="Valor" required />
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
                <input className="campo" name="contado" inputMode="decimal" required />
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
