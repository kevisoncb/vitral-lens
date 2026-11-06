"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { lerNfe, type NotaFiscal } from "@/lib/nfe";
import { dataBR, moeda } from "@/lib/formatar";
import { lancarNota, type ResultadoEntrada } from "./actions";

const CATEGORIAS: Record<string, string> = {
  armacao: "Armação",
  lente_contato: "Lente de contato",
  lente: "Lente",
  acessorio: "Acessório",
  tratamento: "Tratamento",
};

export type ProdutoExistente = { nome: string };

type Linha = NotaFiscal["itens"][number] & { quantidade: number; existente: ProdutoExistente | null };
type Pagamento = "boleto" | "a_vista";

/**
 * Entrada de mercadoria pela nota: só dá entrada (quantidade e custo de compra). Impostos, margem e preço
 * ficam na página do produto; produto novo entra fora da venda até ter preço.
 */
export function EntradaPorNota({
  catalogo,
  lojas,
  categoriasCusto,
  podeFinanceiro,
}: {
  catalogo: Record<string, ProdutoExistente>; // código -> produto que já existe
  lojas: { id: string; nome: string }[];
  categoriasCusto: { id: string; nome: string }[];
  podeFinanceiro: boolean;
}) {
  const [nota, setNota] = useState<NotaFiscal | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loja, setLoja] = useState(lojas[0]?.id ?? "");
  const [categoriaCusto, setCategoriaCusto] = useState(categoriasCusto.find((c) => /fornecedor/i.test(c.nome))?.id ?? "");
  const [pagamento, setPagamento] = useState<Pagamento>("boleto");
  const [resultado, setResultado] = useState<ResultadoEntrada | null>(null);
  const [enviando, iniciar] = useTransition();

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setResultado(null);
    if (!f) return;
    try {
      const n = lerNfe(await f.text());
      setNota(n);
      // boleto gera parcelas a pagar; cartão, Pix ou dinheiro a ótica já pagou na hora
      setPagamento(n.pagamento ?? (n.duplicatas.length > 0 ? "boleto" : "a_vista"));
      setLinhas(n.itens.map((i) => ({ ...i, quantidade: Math.max(1, Math.round(i.quantidade)), existente: catalogo[i.codigo] ?? null })));
    } catch (erro) {
      setNota(null);
      setLinhas([]);
      setResultado({ ok: false, mensagem: erro instanceof Error ? erro.message : "Não consegui ler o XML." });
    }
  }

  function mudar(i: number, campo: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...campo } : l)));
  }

  function lancar() {
    if (!nota) return;
    iniciar(async () => {
      const r = await lancarNota({
        nota: { chave: nota.chave, numero: nota.numero, fornecedor: nota.fornecedor, cnpj: nota.cnpj, emissao: nota.emissao, valor_total: nota.valorTotal },
        lojaId: loja || null,
        itens: linhas.map((l) => ({
          codigo: l.codigo,
          nome: l.nome,
          categoria: l.categoria,
          quantidade: l.quantidade,
          custo: l.custo,
          // frete e impostos da nota: só servem de ponto de partida para produto novo
          insumos_valor: l.insumos,
          impostos_valor: Math.max(0, l.impostos),
          ncm: l.ncm,
          cest: l.cest,
          origem: l.origem,
          unidade: l.unidade,
        })),
        duplicatas: pagamento === "boleto" && podeFinanceiro ? nota.duplicatas.map((d) => ({ vencimento: d.vencimento, valor: d.valor })) : [],
        categoriaCusto: categoriaCusto || null,
      });
      setResultado(r);
      if (r.ok) {
        setNota(null);
        setLinhas([]);
      }
    });
  }

  const unidades = linhas.reduce((s, l) => s + l.quantidade, 0);
  const novos = linhas.filter((l) => !l.existente).length;

  return (
    <>
      <section className="bloco">
        <h2>1. Arquivo XML da nota</h2>
        <input className="campo" type="file" accept=".xml,text/xml,application/xml" onChange={aoEscolher} aria-label="XML da NF-e" />
        <small className="vazio">É o arquivo .xml que o fornecedor manda por e-mail junto com o DANFE (o PDF). A mesma nota não entra duas vezes.</small>
        {resultado && (
          <div role="status">
            <p className={resultado.ok ? "ok" : "erro"}>{resultado.mensagem}</p>
            {resultado.novos && resultado.novos.length > 0 && (
              <div className="bloco" style={{ marginTop: 8 }}>
                <strong>Produtos novos ficam fora da venda até ter preço.</strong>
                <small className="vazio">Abra cada um e preencha impostos, margem e preço de venda: depois é só marcar “Ativo”.</small>
                {resultado.novos.map((p) => (
                  <div key={p.id} className="linha-valor"><span>{p.nome}</span><Link href={`/catalogo/${p.id}`}>Completar o produto →</Link></div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {nota && (
        <>
          <section className="bloco">
            <h2>2. Confira os produtos</h2>
            <div className="resumo">
              <div className="resumo-cartao"><span>Fornecedor</span><strong style={{ fontSize: 17 }}>{nota.fornecedor}</strong><small>{nota.cnpj ?? ""}</small></div>
              <div className="resumo-cartao"><span>Nota</span><strong>{nota.numero}</strong><small>emitida em {dataBR(nota.emissao)}</small></div>
              <div className="resumo-cartao"><span>Total</span><strong>{moeda(nota.valorTotal)}</strong><small>{linhas.length} produtos · {unidades} unidades</small></div>
            </div>
            {lojas.length > 1 && (
              <div className="grade-campos">
                <label className="rotulo">Loja que recebeu
                  <select className="campo" value={loja} onChange={(e) => setLoja(e.target.value)}>
                    {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                </label>
              </div>
            )}
            <div className="tabela-rolagem">
              <table className="tabela tabela-entrada">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="col-categoria">Categoria</th>
                    <th className="numero col-qtd">Qtd.</th>
                    <th className="numero">Compra un.</th>
                    <th className="numero">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={`${l.codigo}-${i}`}>
                      <td>
                        <span className="produto-celula">
                          <strong style={{ fontWeight: 600 }}>{l.existente ? l.existente.nome : l.nome}</strong>
                          {l.existente ? <span className="etiqueta etiqueta-ok">já cadastrado</span> : <span className="etiqueta">produto novo</span>}
                          <small className="vazio">código {l.codigo || "—"}{l.ncm ? ` · NCM ${l.ncm}` : ""}</small>
                        </span>
                      </td>
                      <td className="col-categoria" data-rotulo="Categoria">
                        {l.existente ? <span className="texto-celula" style={{ justifyContent: "flex-start" }}>—</span> : (
                          <select className="campo" value={l.categoria} onChange={(e) => mudar(i, { categoria: e.target.value as Linha["categoria"] })} aria-label={`Categoria de ${l.nome}`}>
                            {Object.entries(CATEGORIAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="numero col-qtd" data-rotulo="Quantidade">
                        <input className="campo" style={{ textAlign: "right" }} type="number" min={1} value={l.quantidade} onChange={(e) => mudar(i, { quantidade: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} aria-label={`Quantidade de ${l.nome}`} />
                      </td>
                      <td className="numero" data-rotulo="Compra un."><span className="texto-celula">{moeda(l.custo)}</span></td>
                      <td className="numero" data-rotulo="Total"><span className="texto-celula"><strong>{moeda(l.custo * l.quantidade)}</strong></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <small className="vazio">
              Aqui só se dá entrada. Impostos, margem e preço de venda ficam na página do produto
              {novos > 0 ? `; os ${novos === 1 ? "produto novo entra" : `${novos} produtos novos entram`} fora da venda até você pôr o preço` : ""}.
              Produto que já existe com margem definida tem o preço atualizado pelo custo novo. Caixa com várias peças (ex.: lente de contato “CX”)? Ajuste a quantidade.
            </small>
          </section>

          <section className="bloco">
            <h2>3. Pagamento ao fornecedor</h2>
            <div className="escolha-pagamento" role="radiogroup" aria-label="Como a ótica paga esta nota">
              <label className="marcar"><input type="radio" name="pagamento" checked={pagamento === "boleto"} onChange={() => setPagamento("boleto")} /> Boleto (parcelas a pagar)</label>
              <label className="marcar"><input type="radio" name="pagamento" checked={pagamento === "a_vista"} onChange={() => setPagamento("a_vista")} /> Cartão, Pix ou dinheiro (já pago)</label>
            </div>
            {pagamento === "a_vista" ? (
              <p className="vazio">Pago na hora: nada vai para contas a pagar.</p>
            ) : nota.duplicatas.length === 0 ? (
              <p className="vazio">A nota não traz as parcelas do boleto: lance em contas a pagar quando o boleto chegar.</p>
            ) : (
              <>
                {nota.duplicatas.map((d, i) => (
                  <div key={i} className="linha-valor"><span>{d.numero ? `Parcela ${d.numero}` : `Parcela ${i + 1}`} · vence {dataBR(d.vencimento)}</span><strong>{moeda(d.valor)}</strong></div>
                ))}
                {podeFinanceiro ? (
                  <label className="rotulo" style={{ marginTop: 12, maxWidth: 420 }}>Categoria em contas a pagar
                    <select className="campo" value={categoriaCusto} onChange={(e) => setCategoriaCusto(e.target.value)}>
                      <option value="">Sem categoria</option>
                      {categoriasCusto.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </label>
                ) : (
                  <small className="vazio">Seu perfil não lança no financeiro: as parcelas ficam para quem cuida das contas.</small>
                )}
              </>
            )}
          </section>

          <div className="janela-botoes">
            <button className="botao" type="button" onClick={lancar} disabled={enviando}>
              {enviando ? "Lançando…" : `Dar entrada em ${unidades} ${unidades === 1 ? "unidade" : "unidades"}`}
            </button>
          </div>
        </>
      )}
    </>
  );
}
