import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigirArea } from "@/lib/sessao";
import { dataHoraBR, moeda } from "@/lib/formatar";
import { EntradaPorNota } from "./entrada";

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
  const podeFinanceiro = sessao.pode("financeiro", "criar");
  const [catalogoR, lojasR, categoriasR, notasR] = await Promise.all([
    supabase.from("catalogo_itens").select("codigo, nome").not("codigo", "is", null).limit(10000),
    supabase.from("lojas").select("id, nome").eq("ativa", true).order("criado_em"),
    podeFinanceiro ? supabase.from("categorias_custo").select("id, nome").order("nome") : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    supabase.from("notas_entrada").select("id, numero, fornecedor, valor_total, unidades, criado_em, usuarios(nome)").order("criado_em", { ascending: false }).limit(10).returns<Nota[]>(),
  ]);
  const catalogo = Object.fromEntries((catalogoR.data ?? []).map((c) => [c.codigo as string, c.nome]));

  return (
    <>
      <div>
        <Link href="/estoque">← Estoque</Link>
        <h1>Entrada pela nota do fornecedor</h1>
        <p className="subtitulo">Suba o XML da NF-e: os produtos entram no estoque com o custo, o que não existe vai para o catálogo e as parcelas vão para contas a pagar.</p>
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
