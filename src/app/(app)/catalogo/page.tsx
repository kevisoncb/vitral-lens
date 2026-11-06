import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { moeda } from "@/lib/formatar";
import { criarItem } from "./actions";
import { CampoMascara } from "@/components/campo-mascara";

const CATEGORIAS: Record<string, string> = {
  lente: "Lentes",
  tratamento: "Tratamentos",
  armacao: "Armações",
  lente_contato: "Lentes de contato",
  acessorio: "Acessórios",
  servico: "Serviços",
};

/**
 * Lista de produtos: só para achar e abrir. Preço, custo, impostos e situação mudam na página
 * do produto (/catalogo/[id]), para a conta da margem nunca ficar para trás.
 */
export default async function PaginaProdutos({ searchParams }: { searchParams: Promise<{ erro?: string; q?: string; categoria?: string; situacao?: string }> }) {
  const { erro, q, categoria, situacao } = await searchParams;
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();
  const busca = (q ?? "").trim().replace(/[%,()]/g, "");
  const cat = categoria && categoria in CATEGORIAS ? categoria : undefined;
  const foraDaVenda = situacao === "fora";

  let consulta = supabase.from("catalogo_itens").select("id, categoria, nome, codigo, marca, preco, ativo, foto_path, criado_na_venda").order("nome").limit(500);
  if (busca) consulta = consulta.or(`nome.ilike.%${busca}%,codigo.ilike.%${busca}%,marca.ilike.%${busca}%`);
  if (cat) consulta = consulta.eq("categoria", cat);
  if (foraDaVenda) consulta = consulta.eq("ativo", false);
  const [{ data: itens }, { count: qtdFora }, { data: armacoesSemFoto }] = await Promise.all([
    consulta,
    supabase.from("catalogo_itens").select("id", { count: "exact", head: true }).eq("ativo", false),
    supabase.from("catalogo_itens").select("id").eq("categoria", "armacao").eq("ativo", true).is("foto_path", null).limit(10),
  ]);
  const podeCriar = sessao?.pode("catalogo", "criar") ?? false;

  const filtro = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: busca || undefined, categoria: cat, situacao: foraDaVenda ? "fora" : undefined, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/catalogo?${s}` : "/catalogo";
  };
  const lista = itens ?? [];

  return (
    <>
      <div className="topo">
        <div>
          <h1>Produtos</h1>
          <p className="subtitulo">Tudo o que a ótica vende. Clique no produto para ver e mudar preço, custo, impostos e foto.</p>
        </div>
        <div className="topo-acoes">
          <form action="/catalogo" method="get" className="linha">
            {cat && <input type="hidden" name="categoria" value={cat} />}
            {foraDaVenda && <input type="hidden" name="situacao" value="fora" />}
            <input className="campo" type="search" name="q" defaultValue={busca} placeholder="Buscar nome, marca ou código" aria-label="Buscar produto" />
          </form>
        </div>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      {(armacoesSemFoto ?? []).length > 0 && (
        <div className="aviso">
          Há armações sem foto.{" "}
          <Link href={`/catalogo/fotos?itens=${(armacoesSemFoto ?? []).map((i) => i.id).join(",")}`}>Fotografar agora</Link>
        </div>
      )}
      {(qtdFora ?? 0) > 0 && !foraDaVenda && (
        <div className="aviso">
          {qtdFora} {qtdFora === 1 ? "produto está fora da venda" : "produtos estão fora da venda"} (sem preço ou desativados).{" "}
          <Link href={filtro({ situacao: "fora" })}>Ver quais</Link>
        </div>
      )}

      {podeCriar && (
        <details className="bloco">
          <summary className="resumo-abrir">+ Novo produto</summary>
          <form action={criarItem} className="grade-campos" style={{ marginTop: 12 }}>
            <label className="rotulo">Categoria
              <select className="campo" name="categoria" defaultValue="armacao">
                {Object.entries(CATEGORIAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
            <label className="rotulo">Nome
              <input className="campo" name="nome" required placeholder="Ex.: Lente multifocal 1.67" />
            </label>
            <label className="rotulo">Preço de venda
              <CampoMascara mascara="moeda" name="preco" />
              <small className="ajuda-campo">vazio: fica fora da venda até ter preço</small>
            </label>
            <div className="rotulo" style={{ justifyContent: "flex-start" }}>
              <span aria-hidden>&nbsp;</span>
              <button className="botao" type="submit">Cadastrar e abrir</button>
            </div>
          </form>
        </details>
      )}

      <nav className="abas" aria-label="Categoria">
        <Link href={filtro({ categoria: undefined })} aria-current={!cat ? "page" : undefined}>Todos</Link>
        {Object.entries(CATEGORIAS).map(([v, r]) => (
          <Link key={v} href={filtro({ categoria: v })} aria-current={cat === v ? "page" : undefined}>{r}</Link>
        ))}
      </nav>
      {foraDaVenda && <p className="vazio">Mostrando só os produtos fora da venda. <Link href={filtro({ situacao: undefined })}>Mostrar todos</Link></p>}

      {lista.length > 0 ? (
        <section className="bloco">
          <div className="tabela-rolagem">
            <table className="tabela tabela-produtos">
              <thead>
                <tr>
                  <th style={{ width: 56 }}><span className="so-leitor">Foto</span></th>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Código</th>
                  <th className="numero">Preço</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.foto_path ? (
                        <img className="miniatura" src={supabase.storage.from("produtos").getPublicUrl(i.foto_path).data.publicUrl} alt="" />
                      ) : (
                        <span className="miniatura miniatura-vazia" aria-hidden />
                      )}
                    </td>
                    <td>
                      <Link href={`/catalogo/${i.id}`} style={{ fontWeight: 600 }}>{i.nome}</Link>
                      <span className="produto-selos">
                        {!i.ativo && <span className="etiqueta etiqueta-erro">fora da venda</span>}
                        {i.criado_na_venda && <span className="etiqueta">criado na venda</span>}
                        {i.marca && <small className="vazio">{i.marca}</small>}
                      </span>
                    </td>
                    <td>{CATEGORIAS[i.categoria] ?? i.categoria}</td>
                    <td><small>{i.codigo ?? "—"}</small></td>
                    <td className="numero">{i.ativo || Number(i.preco) > 0 ? moeda(i.preco) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lista.length === 500 && <small className="vazio">Mostrando os 500 primeiros. Use a busca para achar outros.</small>}
        </section>
      ) : (
        <p className="vazio">{busca || cat || foraDaVenda ? "Nenhum produto encontrado." : "Nenhum produto cadastrado ainda."}</p>
      )}
    </>
  );
}
