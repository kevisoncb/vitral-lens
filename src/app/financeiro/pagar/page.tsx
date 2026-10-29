import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { dataBR, mesDoParametro, moeda, nomeMes, proximoMes } from "@/lib/formatar";
import { criarContaPagar, desfazerPagamento, excluirContaPagar, pagarConta } from "../actions";

type Conta = {
  id: string;
  descricao: string;
  fornecedor: string | null;
  valor: number;
  vencimento: string;
  pago_em: string | null;
  observacao: string | null;
  categorias_custo: { nome: string } | null;
};

type Props = { searchParams: Promise<{ ver?: string; mes?: string; erro?: string; ok?: string }> };

export default async function ContasAPagar({ searchParams }: Props) {
  const { ver, mes: mesParam, erro, ok } = await searchParams;
  const mostrarPagas = ver === "pagas";
  const mes = mesDoParametro(mesParam);
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("contas_pagar")
    .select("id, descricao, fornecedor, valor, vencimento, pago_em, observacao, categorias_custo(nome)")
    .limit(300);
  consulta = mostrarPagas
    ? consulta.gte("pago_em", `${mes}-01`).lt("pago_em", `${proximoMes(mes)}-01`).order("pago_em", { ascending: false })
    : consulta.is("pago_em", null).order("vencimento");
  const [contasR, categoriasR] = await Promise.all([
    consulta.returns<Conta[]>(),
    supabase.from("categorias_custo").select("id, nome").order("nome"),
  ]);
  const contas = contasR.data ?? [];
  const podeCriar = sessao?.pode("financeiro", "criar") ?? false;
  const podeEditar = sessao?.pode("financeiro", "editar") ?? false;
  const podeExcluir = sessao?.pode("financeiro", "excluir") ?? false;

  return (
    <>
      <div className="topo">
        <div>
          <h1>Contas a pagar</h1>
          <p className="subtitulo">{mostrarPagas ? `Pagas em ${nomeMes(mes)}` : "Em aberto, da mais antiga para a mais nova"} · {moeda(contas.reduce((s, c) => s + Number(c.valor), 0))}</p>
        </div>
      </div>
      <nav className="abas" aria-label="Filtro">
        <Link href="/financeiro/pagar" aria-current={!mostrarPagas ? "page" : undefined}>Em aberto</Link>
        <Link href={`/financeiro/pagar?ver=pagas&mes=${mes}`} aria-current={mostrarPagas ? "page" : undefined}>Pagas no mês</Link>
      </nav>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}

      {podeCriar && !mostrarPagas && (
        <details className="bloco">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>+ Lançar conta</summary>
          <form action={criarContaPagar} className="formulario formulario-largo">
            <div className="linha">
              <label className="rotulo" style={{ flex: "3 1 240px" }}>Descrição
                <input className="campo" name="descricao" required placeholder="Aluguel, boleto do fornecedor…" />
              </label>
              <label className="rotulo">Fornecedor
                <input className="campo" name="fornecedor" />
              </label>
            </div>
            <div className="linha">
              <label className="rotulo">Categoria
                <select className="campo" name="categoria_id" defaultValue="">
                  <option value="">Sem categoria</option>
                  {(categoriasR.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </label>
              <label className="rotulo">Valor (R$)
                <input className="campo" name="valor" inputMode="decimal" required />
              </label>
              <label className="rotulo">Vencimento
                <input className="campo" name="vencimento" type="date" required defaultValue={hoje} />
              </label>
              <label className="rotulo" style={{ flex: "0 1 140px" }}>Repetir (meses)
                <input className="campo" name="repetir" type="number" min={1} max={24} defaultValue={1} />
              </label>
            </div>
            <label className="rotulo">Observação
              <input className="campo" name="observacao" placeholder="Número do boleto, nota fiscal…" />
            </label>
            <div className="janela-botoes"><button className="botao" type="submit">Lançar</button></div>
          </form>
        </details>
      )}

      <section className="bloco">
        {contas.length > 0 ? (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th className="numero">Valor</th>{mostrarPagas && <th>Pago em</th>}<th /></tr>
              </thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.id} title={c.observacao ?? undefined}>
                    <td>{!c.pago_em && c.vencimento < hoje ? <span className="etiqueta etiqueta-erro">{dataBR(c.vencimento)}</span> : dataBR(c.vencimento)}</td>
                    <td>{c.descricao}{c.fornecedor && <small className="vazio"> · {c.fornecedor}</small>}</td>
                    <td>{c.categorias_custo?.nome ?? "—"}</td>
                    <td className="numero">{moeda(c.valor)}</td>
                    {mostrarPagas && <td>{dataBR(c.pago_em)}</td>}
                    <td>
                      <div className="linha" style={{ flexWrap: "nowrap", justifyContent: "flex-end" }}>
                        {podeEditar && !c.pago_em && (
                          <form action={pagarConta.bind(null, c.id)} className="linha" style={{ flexWrap: "nowrap" }}>
                            <input className="campo" type="date" name="pago_em" defaultValue={hoje} aria-label="Pago em" style={{ width: 150 }} />
                            <button className="botao-secundario" type="submit">Pagar</button>
                          </form>
                        )}
                        {podeEditar && c.pago_em && (
                          <form action={desfazerPagamento.bind(null, c.id)}><button className="botao-link" type="submit">Desfazer</button></form>
                        )}
                        {podeExcluir && !c.pago_em && (
                          <form action={excluirContaPagar.bind(null, c.id)}><button className="botao-link" type="submit">Excluir</button></form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">{mostrarPagas ? "Nenhuma conta paga neste mês." : "Nenhuma conta em aberto."}</p>
        )}
      </section>
    </>
  );
}
