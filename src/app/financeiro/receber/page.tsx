import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { dataBR, mesDoParametro, moeda, nomeMes, proximoMes } from "@/lib/formatar";
import { linkWhatsApp, mensagemLembreteParcela } from "@/lib/whatsapp";
import { criarContaReceber, desfazerRecebimento, excluirContaReceber, receberConta } from "../actions";

const FORMAS: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito", boleto: "Boleto", outro: "Outro" };

type Conta = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  recebido_em: string | null;
  recebido_forma: string | null;
  venda_id: string | null;
  clientes: { nome: string; telefone: string | null } | null;
};

type Props = { searchParams: Promise<{ ver?: string; mes?: string; erro?: string; ok?: string }> };

/** Crediário do PDV e outras contas a receber. O lembrete é um link do WhatsApp com a mensagem pronta. */
export default async function ContasAReceber({ searchParams }: Props) {
  const { ver, mes: mesParam, erro, ok } = await searchParams;
  const mostrarRecebidas = ver === "recebidas";
  const mes = mesDoParametro(mesParam);
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("contas_receber")
    .select("id, descricao, valor, vencimento, recebido_em, recebido_forma, venda_id, clientes(nome, telefone)")
    .limit(300);
  consulta = mostrarRecebidas
    ? consulta.gte("recebido_em", `${mes}-01`).lt("recebido_em", `${proximoMes(mes)}-01`).order("recebido_em", { ascending: false })
    : consulta.is("recebido_em", null).order("vencimento");
  const { data } = await consulta.returns<Conta[]>();
  const contas = data ?? [];
  const podeCriar = sessao?.pode("financeiro", "criar") ?? false;
  const podeEditar = sessao?.pode("financeiro", "editar") ?? false;
  const podeExcluir = sessao?.pode("financeiro", "excluir") ?? false;
  const podeClientes = sessao?.pode("clientes") ?? false;
  const { data: clientes } = podeCriar && podeClientes && !mostrarRecebidas
    ? await supabase.from("clientes").select("id, nome").order("nome").limit(1000)
    : { data: [] as { id: string; nome: string }[] };

  return (
    <>
      <div className="topo">
        <div>
          <h1>Contas a receber</h1>
          <p className="subtitulo">{mostrarRecebidas ? `Recebidas em ${nomeMes(mes)}` : "Em aberto, da mais antiga para a mais nova"} · {moeda(contas.reduce((s, c) => s + Number(c.valor), 0))}</p>
        </div>
      </div>
      <nav className="abas" aria-label="Filtro">
        <Link href="/financeiro/receber" aria-current={!mostrarRecebidas ? "page" : undefined}>Em aberto</Link>
        <Link href={`/financeiro/receber?ver=recebidas&mes=${mes}`} aria-current={mostrarRecebidas ? "page" : undefined}>Recebidas no mês</Link>
      </nav>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}

      {podeCriar && !mostrarRecebidas && (
        <details className="bloco">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>+ Lançar conta a receber</summary>
          <form action={criarContaReceber} className="formulario formulario-largo">
            <div className="linha">
              <label className="rotulo" style={{ flex: "3 1 240px" }}>Descrição
                <input className="campo" name="descricao" required placeholder="Parcelamento combinado, cheque…" />
              </label>
              {(clientes ?? []).length > 0 && (
                <label className="rotulo">Cliente
                  <select className="campo" name="cliente_id" defaultValue="">
                    <option value="">Sem cliente</option>
                    {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="linha">
              <label className="rotulo">Valor total (R$)
                <input className="campo" name="valor" inputMode="decimal" required />
              </label>
              <label className="rotulo">Primeiro vencimento
                <input className="campo" name="vencimento" type="date" required defaultValue={hoje} />
              </label>
              <label className="rotulo" style={{ flex: "0 1 140px" }}>Parcelas
                <input className="campo" name="parcelas" type="number" min={1} max={24} defaultValue={1} />
              </label>
            </div>
            <div className="janela-botoes"><button className="botao" type="submit">Lançar</button></div>
          </form>
        </details>
      )}

      <section className="bloco">
        {contas.length > 0 ? (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr><th>Vencimento</th><th>Descrição</th><th>Cliente</th><th className="numero">Valor</th>{mostrarRecebidas && <th>Recebido</th>}<th /></tr>
              </thead>
              <tbody>
                {contas.map((c) => {
                  const zap = !c.recebido_em && c.clientes
                    ? linkWhatsApp(c.clientes.telefone, mensagemLembreteParcela(c.clientes.nome, sessao?.oticaNome ?? "ótica", moeda(c.valor), dataBR(c.vencimento)))
                    : null;
                  return (
                    <tr key={c.id}>
                      <td>{!c.recebido_em && c.vencimento < hoje ? <span className="etiqueta etiqueta-erro">{dataBR(c.vencimento)}</span> : dataBR(c.vencimento)}</td>
                      <td>{c.descricao}</td>
                      <td>{c.clientes?.nome ?? "—"}</td>
                      <td className="numero">{moeda(c.valor)}</td>
                      {mostrarRecebidas && <td>{dataBR(c.recebido_em)} · {FORMAS[c.recebido_forma ?? ""] ?? "—"}</td>}
                      <td>
                        <div className="linha" style={{ flexWrap: "nowrap", justifyContent: "flex-end" }}>
                          {zap && <a href={zap} target="_blank" rel="noreferrer">Lembrar no WhatsApp</a>}
                          {podeEditar && !c.recebido_em && (
                            <form action={receberConta.bind(null, c.id)} className="linha" style={{ flexWrap: "nowrap" }}>
                              <select className="campo" name="forma" defaultValue="pix" aria-label="Forma" style={{ width: 120 }}>
                                {Object.entries(FORMAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                              </select>
                              <button className="botao-secundario" type="submit">Recebido</button>
                            </form>
                          )}
                          {podeEditar && c.recebido_em && (
                            <form action={desfazerRecebimento.bind(null, c.id)}><button className="botao-link" type="submit">Desfazer</button></form>
                          )}
                          {podeExcluir && !c.recebido_em && !c.venda_id && (
                            <form action={excluirContaReceber.bind(null, c.id)}><button className="botao-link" type="submit">Excluir</button></form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">{mostrarRecebidas ? "Nada recebido neste mês." : "Nenhuma conta em aberto."}</p>
        )}
      </section>
    </>
  );
}
