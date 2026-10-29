import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { dataBR, dataHoraBR, moeda } from "@/lib/formatar";
import { cancelarVenda } from "../actions";

const FORMAS: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito" };

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
  venda_itens: { descricao: string; quantidade: number; preco_unitario: number }[];
  pagamentos: { forma: string; valor: number; parcelas: number }[];
  contas_receber: { valor: number; vencimento: string }[];
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
    .select("id, numero, subtotal, desconto, total, cancelada, motivo_cancelamento, criado_em, clientes(nome), usuarios!vendas_vendedor_id_fkey(nome), venda_itens(descricao, quantidade, preco_unitario), pagamentos(forma, valor, parcelas), contas_receber(valor, vencimento)")
    .gte("criado_em", `${dia}T00:00:00-03:00`)
    .lt("criado_em", `${amanha}T00:00:00-03:00`)
    .order("criado_em", { ascending: false })
    .returns<VendaLista[]>();
  const vendas = data ?? [];
  const total = vendas.filter((v) => !v.cancelada).reduce((s, v) => s + Number(v.total), 0);
  const gerente = sessao?.pode("pdv", "editar") ?? false;

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
          {v.cancelada && v.motivo_cancelamento && <p className="vazio">Motivo do cancelamento: {v.motivo_cancelamento}</p>}
          <a href={`/cupom/${v.id}`} target="_blank" rel="noopener">Ver e imprimir o cupom</a>
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
