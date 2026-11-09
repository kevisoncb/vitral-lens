import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigirArea } from "@/lib/sessao";
import { dataHoraBR, moeda } from "@/lib/formatar";
import { EntradaPorNota, type ProdutoExistente } from "./entrada";

type Nota = { id: string; numero: string; fornecedor: string; valor_total: number | null; unidades: number; criado_em: string; usuarios: { nome: string } | null };

/** Entrada de mercadoria pelo XML da NF-e: cadastra o que falta, dá entrada e lança as parcelas. */
export default async function EntradaPelaNota() {
  const sessao = await exigirArea("loja", "gestao");
  if (!sessao.pode("estoque", "criar")) {
    return (
      <>
        <h1>Entrada pela nota</h1>
        <p className="subtitulo">Seu perfil não dá entrada no estoque.</p>
      </>
    );
  }
  const supabase = await criarClienteServidor();
  const { data: contratado } = await supabase.rpc("recurso_ativo", { r: "nota_fiscal" });
  if (!contratado) {
    return (
      <>
        <div>
          <Link href="/estoque">← Estoque</Link>
          <h1>Entrada pela nota do fornecedor</h1>
        </div>
        <section className="bloco">
          <span className="etiqueta" style={{ alignSelf: "flex-start" }}>Plano Especial</span>
          <h2>Dê entrada na mercadoria subindo o XML da nota</h2>
          <p>
            Com o <strong>Plano Especial</strong> (ou as notas fiscais avulsas), você sobe o arquivo XML que o fornecedor manda e o sistema dá entrada em
            todos os produtos de uma vez, com o custo de compra, cadastra os que faltam e lança os boletos em contas a pagar.
            O Plano Especial também traz o PDV com o caixa e a emissão de NFC-e.
          </p>
          <p className="vazio">Para contratar, fale com o suporte do Vitral. Sem o adicional, a entrada continua pelo Estoque, produto a produto.</p>
          <Link className="botao-secundario" href="/estoque" style={{ alignSelf: "flex-start", textDecoration: "none" }}>Ir para o Estoque</Link>
        </section>
      </>
    );
  }
  const podeFinanceiro = sessao.pode("financeiro", "criar");
  const [catalogoR, lojasR, categoriasR, notasR] = await Promise.all([
    supabase.from("catalogo_itens").select("codigo, nome").not("codigo", "is", null).limit(10000),
    supabase.from("lojas").select("id, nome").eq("ativa", true).order("criado_em"),
    podeFinanceiro ? supabase.from("categorias_custo").select("id, nome").order("nome") : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    supabase.from("notas_entrada").select("id, numero, fornecedor, valor_total, unidades, criado_em, usuarios(nome)").order("criado_em", { ascending: false }).limit(10).returns<Nota[]>(),
  ]);
  const catalogo: Record<string, ProdutoExistente> = Object.fromEntries((catalogoR.data ?? []).map((c) => [
    c.codigo as string,
    { nome: c.nome },
  ]));

  return (
    <>
      <div>
        <Link href="/estoque">← Estoque</Link>
        <h1>Entrada pela nota do fornecedor</h1>
        <p className="subtitulo">Suba o XML da NF-e: os produtos entram no estoque com o custo de compra e o que não existe é cadastrado em Produtos. Impostos, margem e preço ficam na página do produto.</p>
      </div>
      <EntradaPorNota catalogo={catalogo} lojas={lojasR.data ?? []} categoriasCusto={categoriasR.data ?? []} podeFinanceiro={podeFinanceiro} />
      {(notasR.data ?? []).length > 0 && (
        <section className="bloco">
          <h2>Últimas notas lançadas</h2>
          {(notasR.data ?? []).map((n) => (
            <div key={n.id} className="linha-valor">
              <span>NF {n.numero} · {n.fornecedor} · {n.unidades} un. · {dataHoraBR(n.criado_em)}{n.usuarios ? ` · ${n.usuarios.nome}` : ""}</span>
              <strong>{n.valor_total !== null ? moeda(n.valor_total) : "—"}</strong>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
