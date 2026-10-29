import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigirArea } from "@/lib/sessao";
import { dataHoraBR, moeda } from "@/lib/formatar";
import { configurarItem, movimentar, transferir } from "../actions";

const TIPOS: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Contagem",
  venda: "Venda",
  devolucao: "Devolução",
  transferencia: "Transferência",
};

type Movimento = {
  id: string;
  tipo: string;
  quantidade: number;
  custo_unitario: number | null;
  motivo: string | null;
  criado_em: string;
  atendimento_id: string | null;
  lojas: { nome: string } | null;
  usuarios: { nome: string } | null;
};

export default async function ProdutoNoEstoque({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const [{ id }, { erro, ok }] = await Promise.all([params, searchParams]);
  const sessao = await exigirArea("loja", "gestao");
  const supabase = await criarClienteServidor();

  const [itemR, lojasR, saldosR, movR] = await Promise.all([
    supabase.from("catalogo_itens").select("id, nome, categoria, marca, codigo, preco, custo, controla_estoque, estoque_minimo").eq("id", id).maybeSingle(),
    supabase.from("lojas").select("id, nome").eq("ativa", true).order("criado_em"),
    supabase.from("estoque_saldos").select("loja_id, quantidade").eq("item_id", id),
    supabase
      .from("estoque_movimentos")
      .select("id, tipo, quantidade, custo_unitario, motivo, criado_em, atendimento_id, lojas(nome), usuarios(nome)")
      .eq("item_id", id)
      .order("criado_em", { ascending: false })
      .limit(100)
      .returns<Movimento[]>(),
  ]);
  const item = itemR.data;
  if (!item) notFound();

  const lojas = lojasR.data ?? [];
  const saldoDa = (lojaId: string) => saldosR.data?.find((s) => s.loja_id === lojaId)?.quantidade ?? 0;
  const total = (saldosR.data ?? []).reduce((s, x) => s + x.quantidade, 0);
  const caminho = `/estoque/${id}`;
  const podeEntrada = sessao.pode("estoque", "criar");
  const podeAjuste = sessao.pode("estoque", "editar");

  return (
    <>
      <div className="topo">
        <div>
          <Link href="/estoque">← Estoque</Link>
          <h1>{item.nome}</h1>
          <p className="subtitulo">
            {[item.marca, item.codigo].filter(Boolean).join(" · ") || "Sem marca e código"} · preço {moeda(item.preco)}
            {podeEntrada && item.custo !== null && <> · último custo {moeda(item.custo)}</>}
          </p>
        </div>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">Salvo.</p>}
      {!item.controla_estoque && <p className="aviso">Este produto não controla estoque: a venda não dá baixa.</p>}

      <div className="resumo">
        <div className="resumo-cartao"><span>Total</span><strong>{total}</strong><small>mínimo {item.estoque_minimo}</small></div>
        {lojas.length > 1 && lojas.map((l) => (
          <div key={l.id} className="resumo-cartao"><span>{l.nome}</span><strong>{saldoDa(l.id)}</strong></div>
        ))}
      </div>

      {(podeEntrada || podeAjuste) && (
        <section className="bloco">
          <h2>Movimentar</h2>
          <form action={movimentar} className="linha">
            <input type="hidden" name="voltar" value={caminho} />
            <input type="hidden" name="item_id" value={id} />
            <label className="rotulo">O quê
              <select className="campo" name="tipo" defaultValue={podeEntrada ? "entrada" : "ajuste"}>
                {podeEntrada && <option value="entrada">Entrada (compra)</option>}
                {podeAjuste && <option value="ajuste">Contagem (corrige o saldo)</option>}
                {podeAjuste && <option value="saida">Saída (perda, quebra)</option>}
              </select>
            </label>
            <label className="rotulo" style={{ flex: "1 1 100px" }}>Quantidade
              <input className="campo" name="quantidade" type="number" min={0} step={1} required />
            </label>
            {podeEntrada && (
              <label className="rotulo" style={{ flex: "1 1 110px" }}>Custo un. (entrada)
                <input className="campo" name="custo" inputMode="decimal" placeholder="R$" />
              </label>
            )}
            {lojas.length > 1 && (
              <label className="rotulo">Loja
                <select className="campo" name="loja_id" defaultValue={lojas[0]?.id}>
                  {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </label>
            )}
            <label className="rotulo" style={{ flex: "2 1 180px" }}>Nota ou motivo
              <input className="campo" name="motivo" />
            </label>
            <button className="botao" type="submit">Lançar</button>
          </form>
        </section>
      )}

      {podeAjuste && lojas.length > 1 && (
        <section className="bloco">
          <h2>Transferir entre lojas</h2>
          <form action={transferir.bind(null, id)} className="linha">
            <label className="rotulo">De
              <select className="campo" name="de" defaultValue={lojas[0]?.id}>
                {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome} ({saldoDa(l.id)})</option>)}
              </select>
            </label>
            <label className="rotulo">Para
              <select className="campo" name="para" defaultValue={lojas[1]?.id}>
                {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </label>
            <label className="rotulo" style={{ flex: "1 1 100px" }}>Quantidade
              <input className="campo" name="quantidade" type="number" min={1} step={1} required />
            </label>
            <button className="botao-secundario" type="submit">Transferir</button>
          </form>
        </section>
      )}

      {sessao.pode("catalogo", "editar") && (
        <section className="bloco">
          <h2>Configuração</h2>
          <form action={configurarItem.bind(null, id)} className="linha">
            <label className="marcar"><input type="checkbox" name="controla_estoque" defaultChecked={item.controla_estoque} /> Controla estoque</label>
            <label className="rotulo" style={{ flex: "0 1 160px" }}>Estoque mínimo
              <input className="campo" name="estoque_minimo" type="number" min={0} step={1} defaultValue={item.estoque_minimo} />
            </label>
            <button className="botao-secundario" type="submit">Salvar</button>
          </form>
        </section>
      )}

      <section className="bloco">
        <h2>Movimentos</h2>
        {(movR.data ?? []).length > 0 ? (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr><th>Quando</th><th>O quê</th><th className="numero">Qtd.</th>{lojas.length > 1 && <th>Loja</th>}<th>Quem</th><th>Nota ou motivo</th></tr>
              </thead>
              <tbody>
                {(movR.data ?? []).map((m) => (
                  <tr key={m.id}>
                    <td>{dataHoraBR(m.criado_em)}</td>
                    <td>{TIPOS[m.tipo] ?? m.tipo}</td>
                    <td className="numero">{m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}</td>
                    {lojas.length > 1 && <td>{m.lojas?.nome ?? "—"}</td>}
                    <td>{m.usuarios?.nome ?? "—"}</td>
                    <td>
                      {m.atendimento_id ? <Link href={`/vendas/${m.atendimento_id}`}>{m.motivo ?? "Venda"}</Link> : (m.motivo ?? "—")}
                      {podeEntrada && m.custo_unitario !== null && <small className="vazio"> · {moeda(m.custo_unitario)} un.</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">Nenhum movimento ainda.</p>
        )}
      </section>
    </>
  );
}
