import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigirArea } from "@/lib/sessao";
import { moeda } from "@/lib/formatar";
import { movimentar } from "./actions";

type Props = { searchParams: Promise<{ q?: string; loja?: string; baixo?: string; erro?: string; ok?: string }> };

const CATEGORIAS: Record<string, string> = {
  armacao: "Armação",
  lente_contato: "Lente de contato",
  acessorio: "Acessório",
  lente: "Lente",
  tratamento: "Tratamento",
  servico: "Serviço",
};

/** Estoque por loja: saldo de cada produto, o que está abaixo do mínimo e os movimentos. */
export default async function PaginaEstoque({ searchParams }: Props) {
  const { q, loja: lojaParam, baixo, erro, ok } = await searchParams;
  const sessao = await exigirArea("loja", "gestao");
  if (!sessao.pode("estoque")) {
    return (
      <>
        <h1>Estoque</h1>
        <p className="subtitulo">Seu perfil não tem acesso ao estoque.</p>
      </>
    );
  }
  const busca = (q ?? "").trim().replace(/[%,()]/g, "");
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("catalogo_itens")
    .select("id, nome, categoria, marca, codigo, estoque_minimo, custo, preco, ativo")
    .eq("controla_estoque", true)
    .order("nome")
    .limit(500);
  if (busca) consulta = consulta.or(`nome.ilike.%${busca}%,codigo.ilike.%${busca}%,marca.ilike.%${busca}%`);
  const [itensR, lojasR, saldosR] = await Promise.all([
    consulta,
    supabase.from("lojas").select("id, nome").eq("ativa", true).order("criado_em"),
    supabase.from("estoque_saldos").select("loja_id, item_id, quantidade"),
  ]);

  const lojas = lojasR.data ?? [];
  const loja = lojas.find((l) => l.id === lojaParam) ?? null; // null = todas as lojas
  const saldo = new Map<string, number>();
  for (const s of saldosR.data ?? []) {
    if (loja && s.loja_id !== loja.id) continue;
    saldo.set(s.item_id, (saldo.get(s.item_id) ?? 0) + s.quantidade);
  }

  const todos = (itensR.data ?? []).map((i) => ({ ...i, saldo: saldo.get(i.id) ?? 0 }));
  const abaixo = todos.filter((i) => i.ativo && i.saldo <= i.estoque_minimo);
  const lista = baixo ? abaixo : todos;
  const podeEntrada = sessao.pode("estoque", "criar");
  const podeAjuste = sessao.pode("estoque", "editar");
  const valorEmEstoque = todos.reduce((s, i) => s + Math.max(0, i.saldo) * Number(i.custo ?? 0), 0);
  const filtro = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: busca || undefined, loja: loja?.id, baixo, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/estoque?${s}` : "/estoque";
  };

  return (
    <>
      <div className="topo">
        <div>
          <h1>Estoque</h1>
          <p className="subtitulo">Armações, lentes de contato e acessórios. A venda dá baixa sozinha no primeiro pagamento.</p>
        </div>
        <div className="topo-acoes">
          <form action="/estoque" method="get" className="linha">
            {loja && <input type="hidden" name="loja" value={loja.id} />}
            <input className="campo" type="search" name="q" defaultValue={busca} placeholder="Buscar nome, marca ou código" aria-label="Buscar produto" />
          </form>
        </div>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">Estoque atualizado.</p>}

      <div className="resumo">
        <div className="resumo-cartao"><span>Produtos com estoque</span><strong>{todos.length}</strong></div>
        <Link className="resumo-cartao cartao-link" href={filtro({ baixo: baixo ? undefined : "1" })}>
          <span>Abaixo do mínimo</span><strong>{abaixo.length}</strong>
        </Link>
        {podeEntrada && <div className="resumo-cartao"><span>Valor em estoque (custo)</span><strong>{moeda(valorEmEstoque)}</strong></div>}
      </div>

      {lojas.length > 1 && (
        <nav className="abas" aria-label="Loja">
          <Link href={filtro({ loja: undefined })} aria-current={!loja ? "page" : undefined}>Todas as lojas</Link>
          {lojas.map((l) => (
            <Link key={l.id} href={filtro({ loja: l.id })} aria-current={loja?.id === l.id ? "page" : undefined}>{l.nome}</Link>
          ))}
        </nav>
      )}

      {(podeEntrada || podeAjuste) && todos.length > 0 && (
        <section className="bloco">
          <h2>Movimentar</h2>
          <form action={movimentar} className="linha">
            <input type="hidden" name="voltar" value={filtro({})} />
            <label className="rotulo" style={{ flex: "3 1 220px" }}>Produto
              <select className="campo" name="item_id" required defaultValue="">
                <option value="" disabled>Escolha</option>
                {todos.map((i) => <option key={i.id} value={i.id}>{i.nome}{i.codigo ? ` (${i.codigo})` : ""}</option>)}
              </select>
            </label>
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
                <select className="campo" name="loja_id" defaultValue={loja?.id ?? lojas[0]?.id}>
                  {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </label>
            )}
            <label className="rotulo" style={{ flex: "2 1 180px" }}>Nota ou motivo
              <input className="campo" name="motivo" placeholder="NF 1234, quebrou na vitrine…" />
            </label>
            <button className="botao" type="submit">Lançar</button>
          </form>
          <small className="vazio">Na contagem, informe quantas unidades existem de fato: o sistema lança a diferença.</small>
        </section>
      )}

      <section className="bloco">
        <h2>{baixo ? "Abaixo do mínimo" : "Produtos"}{loja ? ` · ${loja.nome}` : ""}</h2>
        {lista.length > 0 ? (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Produto</th><th>Categoria</th><th>Código</th>
                  <th className="numero">Saldo</th><th className="numero">Mínimo</th><th className="numero">Preço</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/estoque/${i.id}`}>{i.nome}</Link>
                      {i.marca && <small className="vazio"> · {i.marca}</small>}
                      {!i.ativo && <small className="vazio"> (inativo)</small>}
                    </td>
                    <td>{CATEGORIAS[i.categoria] ?? i.categoria}</td>
                    <td>{i.codigo ?? "—"}</td>
                    <td className="numero">
                      {i.saldo <= 0 ? <span className="etiqueta etiqueta-erro">{i.saldo}</span>
                        : i.saldo <= i.estoque_minimo ? <span className="etiqueta">{i.saldo}</span> : i.saldo}
                    </td>
                    <td className="numero">{i.estoque_minimo}</td>
                    <td className="numero">{moeda(i.preco)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">
            {baixo ? "Nada abaixo do mínimo." : busca ? "Nenhum produto encontrado." : "Nenhum produto controla estoque ainda. Armações, lentes de contato e acessórios cadastrados no catálogo aparecem aqui."}
          </p>
        )}
      </section>
    </>
  );
}
