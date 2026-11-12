import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { dataBR, dataHoraBR, moeda } from "@/lib/formatar";
import { cancelarVenda, devolverItens } from "../actions";
import { BotaoNota, type NotaDaVenda } from "../botao-nota";
import { urlArquivo } from "@/lib/focus-nfe";

const FORMAS: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito" };
const REEMBOLSO: Record<string, string> = { dinheiro: "dinheiro", pix: "Pix", estorno_cartao: "estorno no cartão", abater_crediario: "abatido do crediário" };
const devolvido = (i: { devolucao_itens: { quantidade: number }[] }) => i.devolucao_itens.reduce((s, d) => s + d.quantidade, 0);

type VendaLista = {
  id: string;
  numero: number;
  subtotal: number;
  desconto: number;
  total: number;
  cancelada: boolean;
  motivo_cancelamento: string | null;
  criado_em: string;
  clientes: { nome: string } | null;
  usuarios: { nome: string } | null;
  venda_itens: { id: string; descricao: string; quantidade: number; preco_unitario: number; devolucao_itens: { quantidade: number }[] }[];
  devolucoes: { valor: number; forma: string; motivo: string; criado_em: string }[];
  pagamentos: { forma: string; valor: number; parcelas: number }[];
  contas_receber: { valor: number; vencimento: string; recebido_em: string | null }[];
  notas_fiscais: { id: string; status: NotaDaVenda["status"]; numero: string | null; mensagem: string | null; caminho_danfe: string | null; ambiente: "homologacao" | "producao"; autorizada_em: string | null; criado_em: string }[];
};

/** Vendas do PDV por dia. O gerente (pdv:editar) cancela, e os itens voltam ao estoque. */
export default async function VendasPdv({ searchParams }: { searchParams: Promise<{ dia?: string; erro?: string; ok?: string }> }) {
  const { dia: diaParam, erro, ok } = await searchParams;
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(diaParam ?? "") ? (diaParam as string) : hoje;
  const amanha = new Date(Date.parse(`${dia}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10);
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("vendas")
    .select("id, numero, subtotal, desconto, total, cancelada, motivo_cancelamento, criado_em, clientes(nome), usuarios!vendas_vendedor_id_fkey(nome), venda_itens(id, descricao, quantidade, preco_unitario, devolucao_itens(quantidade)), devolucoes(valor, forma, motivo, criado_em), pagamentos(forma, valor, parcelas), contas_receber(valor, vencimento, recebido_em), notas_fiscais(id, status, numero, mensagem, caminho_danfe, ambiente, autorizada_em, criado_em)")
    .gte("criado_em", `${dia}T00:00:00-03:00`)
    .lt("criado_em", `${amanha}T00:00:00-03:00`)
    .order("criado_em", { ascending: false })
    .returns<VendaLista[]>();
  const vendas = data ?? [];
  const total = vendas.filter((v) => !v.cancelada).reduce((s, v) => s + Number(v.total), 0);
  const gerente = sessao?.pode("pdv", "editar") ?? false;
  const { data: notaAtiva } = await supabase.rpc("recurso_ativo", { r: "nota_fiscal" });
  const agora = Date.now();
  /** a nota mais recente da venda, no formato do botão */
  function notaDa(v: VendaLista): NotaDaVenda | null {
    const n = [...v.notas_fiscais].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
    if (!n) return null;
    return {
      id: n.id,
      status: n.status,
      numero: n.numero,
      mensagem: n.mensagem,
      danfe: urlArquivo(n.ambiente, n.caminho_danfe),
      homologacao: n.ambiente === "homologacao",
      cancelavel: gerente && n.status === "autorizada" && !!n.autorizada_em && agora - Date.parse(n.autorizada_em) < 30 * 60_000,
    };
  }

  return (
    <>
      <div className="topo">
        <div>
          <h1>Vendas do PDV</h1>
          <p className="subtitulo">{dataBR(dia)} · {vendas.filter((v) => !v.cancelada).length} vendas · {moeda(total)}</p>
        </div>
        <form className="topo-acoes" method="get">
          <input className="campo" type="date" name="dia" defaultValue={dia} aria-label="Dia" />
          <button className="botao-secundario" type="submit">Ver</button>
        </form>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}

      {vendas.map((v) => (
        <details key={v.id} className="bloco">
          <summary className="linha-valor" style={{ cursor: "pointer" }}>
            <span>
              <strong>Nº {v.numero}</strong> · {dataHoraBR(v.criado_em).slice(-5)} · {v.usuarios?.nome ?? "—"}
              {v.clientes && <> · {v.clientes.nome}</>}
              {v.cancelada && <span className="etiqueta etiqueta-erro" style={{ marginLeft: 8 }}>cancelada</span>}
            </span>
            <strong style={v.cancelada ? { textDecoration: "line-through" } : undefined}>{moeda(v.total)}</strong>
          </summary>
          <div className="tabela-rolagem">
            <table className="tabela">
              <tbody>
                {v.venda_itens.map((i, n) => (
                  <tr key={n}><td>{i.quantidade}× {i.descricao}</td><td className="numero">{moeda(i.quantidade * i.preco_unitario)}</td></tr>
                ))}
                {Number(v.desconto) > 0 && <tr><td>Desconto</td><td className="numero">−{moeda(v.desconto)}</td></tr>}
                {v.pagamentos.map((p, n) => (
                  <tr key={`p${n}`}><td>{FORMAS[p.forma] ?? p.forma}{p.parcelas > 1 ? ` em ${p.parcelas}x` : ""}</td><td className="numero">{moeda(p.valor)}</td></tr>
                ))}
                {v.contas_receber.map((c, n) => (
                  <tr key={`c${n}`}><td>Crediário, vence {dataBR(c.vencimento)}</td><td className="numero">{moeda(c.valor)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {v.devolucoes.map((d, n) => (
            <p key={`d${n}`} className="aviso">Devolução de {moeda(d.valor)} ({REEMBOLSO[d.forma] ?? d.forma}) em {dataHoraBR(d.criado_em)}: {d.motivo}</p>
          ))}
          {v.cancelada && v.motivo_cancelamento && <p className="vazio">Motivo do cancelamento: {v.motivo_cancelamento}</p>}
          <a href={`/cupom/${v.id}`} target="_blank" rel="noopener">Ver e imprimir o cupom</a>
          {(notaAtiva || v.notas_fiscais.length > 0) && !v.cancelada && <BotaoNota vendaId={v.id} nota={notaDa(v)} />}
          {gerente && !v.cancelada && v.venda_itens.some((i) => i.quantidade > devolvido(i)) && (
            <details>
              <summary className="resumo-abrir">Devolver parte da venda</summary>
              <form action={devolverItens.bind(null, v.id)} className="formulario" style={{ marginTop: 10 }}>
                {v.venda_itens.filter((i) => i.quantidade > devolvido(i)).map((i) => (
                  <label key={i.id} className="linha-valor">
                    <span>{i.descricao} <small className="vazio">(pode devolver até {i.quantidade - devolvido(i)})</small></span>
                    <input className="campo" type="number" name={`qtd_${i.id}`} min={0} max={i.quantidade - devolvido(i)} defaultValue={0} style={{ width: 90 }} aria-label={`Quantidade de ${i.descricao} a devolver`} />
                  </label>
                ))}
                <div className="linha">
                  <label className="rotulo">Reembolso
                    <select className="campo" name="forma" defaultValue="dinheiro">
                      <option value="dinheiro">Dinheiro (sai do caixa aberto)</option>
                      <option value="pix">Pix</option>
                      <option value="estorno_cartao">Estorno no cartão</option>
                      {v.contas_receber.some((c) => !c.recebido_em) && <option value="abater_crediario">Abater do crediário</option>}
                    </select>
                  </label>
                  <label className="rotulo" style={{ flex: "2 1 220px" }}>Motivo
                    <input className="campo" name="motivo" required minLength={3} placeholder="Ex.: não serviu, defeito" />
                  </label>
                </div>
                <small className="vazio">
                  O valor segue o desconto da venda. Os itens voltam ao estoque e a comissão ainda não paga diminui.
                  {v.notas_fiscais.some((n) => n.status === "autorizada") && " Esta venda tem NFC-e: a devolução fiscal (NF-e de devolução) é feita com o contador."}
                </small>
                <button className="botao-secundario" type="submit">Registrar devolução</button>
              </form>
            </details>
          )}
          {gerente && !v.cancelada && (
            <form action={cancelarVenda.bind(null, v.id)} className="linha">
              <input className="campo" name="motivo" placeholder="Motivo do cancelamento" aria-label="Motivo do cancelamento" required minLength={3} />
              <button className="botao-secundario" type="submit">Cancelar venda</button>
            </form>
          )}
        </details>
      ))}
      {vendas.length === 0 && <p className="vazio">Nenhuma venda neste dia.</p>}
    </>
  );
}
