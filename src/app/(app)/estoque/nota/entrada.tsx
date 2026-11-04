"use client";

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

type Linha = {
  codigo: string;
  nome: string;
  categoria: string;
  quantidade: number;
  custo: number;
  insumos: string;
  impostos: string;
  preco: string;
  existente: string | null;
  ncm: string | null;
  cest: string | null;
  origem: number | null;
  unidade: string | null;
};

const texto = (n: number) => n.toFixed(2).replace(".", ",");

/** Preço de venda sugerido: custo × margem, terminando em ,90. */
function sugerido(custo: number, margem: number): string {
  const v = Math.max(0, Math.ceil(custo * margem) - 0.1);
  return v.toFixed(2).replace(".", ",");
}

const numero = (t: string) => {
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function EntradaPorNota({
  catalogo,
  lojas,
  categoriasCusto,
  podeFinanceiro,
}: {
  catalogo: Record<string, string>; // código -> nome do produto que já existe
  lojas: { id: string; nome: string }[];
  categoriasCusto: { id: string; nome: string }[];
  podeFinanceiro: boolean;
}) {
  const [nota, setNota] = useState<NotaFiscal | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [margem, setMargem] = useState("2,5");
  const [loja, setLoja] = useState(lojas[0]?.id ?? "");
  const [categoriaCusto, setCategoriaCusto] = useState(categoriasCusto.find((c) => /fornecedor/i.test(c.nome))?.id ?? "");
  const [lancarParcelas, setLancarParcelas] = useState(podeFinanceiro);
  const [resultado, setResultado] = useState<ResultadoEntrada | null>(null);
  const [enviando, iniciar] = useTransition();

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setResultado(null);
    if (!f) return;
    try {
      const n = lerNfe(await f.text());
      const m = numero(margem) ?? 2.5;
      setNota(n);
      setLinhas(n.itens.map((i) => ({
        codigo: i.codigo,
        nome: i.nome,
        categoria: i.categoria,
        quantidade: Math.max(1, Math.round(i.quantidade)),
        custo: i.custo,
        insumos: texto(i.insumos),
        impostos: texto(i.impostos),
        preco: sugerido(i.custo + i.insumos + i.impostos, m),
        existente: catalogo[i.codigo] ?? null,
        ncm: i.ncm,
        cest: i.cest,
        origem: i.origem,
        unidade: i.unidade,
      })));
    } catch (erro) {
      setNota(null);
      setLinhas([]);
      setResultado({ ok: false, mensagem: erro instanceof Error ? erro.message : "Não consegui ler o XML." });
    }
  }

  function aplicarMargem(valor: string) {
    setMargem(valor);
    const m = numero(valor);
    if (m && m > 0) setLinhas((ls) => ls.map((l) => (l.existente ? l : { ...l, preco: sugerido(custoFinal(l), m) })));
  }

  /** compra + insumos + impostos, por unidade */
  function custoFinal(l: Linha): number {
    return l.custo + (numero(l.insumos) ?? 0) + (numero(l.impostos) ?? 0);
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
          insumos: numero(l.insumos) ?? 0,
          impostos: Math.max(0, numero(l.impostos) ?? 0),
          preco_venda: l.existente ? null : numero(l.preco),
          ncm: l.ncm,
          cest: l.cest,
          origem: l.origem,
          unidade: l.unidade,
        })),
        duplicatas: lancarParcelas ? nota.duplicatas.map((d) => ({ vencimento: d.vencimento, valor: d.valor })) : [],
        categoriaCusto: categoriaCusto || null,
      });
      setResultado(r);
      if (r.ok) {
        setNota(null);
        setLinhas([]);
      }
    });
  }

  const novos = linhas.filter((l) => !l.existente);
  const semPreco = novos.some((l) => numero(l.preco) === null);
  const unidades = linhas.reduce((s, l) => s + l.quantidade, 0);

  return (
    <>
      <section className="bloco">
        <h2>1. Arquivo XML da nota</h2>
        <input className="campo" type="file" accept=".xml,text/xml,application/xml" onChange={aoEscolher} aria-label="XML da NF-e" />
        <small className="vazio">É o arquivo .xml que o fornecedor manda por e-mail junto com o DANFE (o PDF). A mesma nota não entra duas vezes.</small>
        {resultado && <p className={resultado.ok ? "ok" : "erro"} role="status">{resultado.mensagem}</p>}
      </section>

      {nota && (
        <>
          <section className="bloco">
            <h2>2. Confira a nota</h2>
            <div className="resumo">
              <div className="resumo-cartao"><span>Fornecedor</span><strong style={{ fontSize: 17 }}>{nota.fornecedor}</strong><small>{nota.cnpj ?? ""}</small></div>
              <div className="resumo-cartao"><span>Nota</span><strong>{nota.numero}</strong><small>emitida em {dataBR(nota.emissao)}</small></div>
              <div className="resumo-cartao"><span>Total</span><strong>{moeda(nota.valorTotal)}</strong><small>{linhas.length} produtos · {unidades} unidades</small></div>
            </div>
            <div className="linha">
              {lojas.length > 1 && (
                <label className="rotulo">Loja que recebeu
                  <select className="campo" value={loja} onChange={(e) => setLoja(e.target.value)}>
                    {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                </label>
              )}
              {novos.length > 0 && (
                <label className="rotulo" style={{ flex: "0 1 220px" }}>Margem dos produtos novos (× custo)
                  <input className="campo" inputMode="decimal" value={margem} onChange={(e) => aplicarMargem(e.target.value)} />
                </label>
              )}
            </div>
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Produto</th><th>Categoria</th><th className="numero">Qtd.</th><th className="numero">Compra un.</th>
                    <th className="numero" title="Frete, seguro e outras despesas, menos o desconto, por unidade">Insumos un.</th>
                    <th className="numero" title="IPI e ICMS-ST pagos na compra, por unidade">Impostos un.</th>
                    <th className="numero">Custo final</th><th className="numero">Preço de venda</th><th className="numero">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={`${l.codigo}-${i}`}>
                      <td>
                        {l.existente ? <>{l.existente} <span className="etiqueta etiqueta-ok">no catálogo</span></> : <>{l.nome} <span className="etiqueta">novo</span></>}
                        <br /><small className="vazio">código {l.codigo || "—"}{l.ncm ? ` · NCM ${l.ncm}` : ""}{l.cest ? ` · CEST ${l.cest}` : ""}</small>
                      </td>
                      <td>
                        {l.existente ? "—" : (
                          <select className="campo" value={l.categoria} onChange={(e) => mudar(i, { categoria: e.target.value })} aria-label={`Categoria de ${l.nome}`}>
                            {Object.entries(CATEGORIAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="numero">
                        <input className="campo pdv-qtd" type="number" min={1} value={l.quantidade} onChange={(e) => mudar(i, { quantidade: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} aria-label={`Quantidade de ${l.nome}`} />
                      </td>
                      <td className="numero">{moeda(l.custo)}</td>
                      <td className="numero">
                        <input className="campo" style={{ width: 90, textAlign: "right" }} inputMode="decimal" value={l.insumos} onChange={(e) => mudar(i, { insumos: e.target.value })} aria-label={`Insumos de ${l.nome}`} />
                      </td>
                      <td className="numero">
                        <input className="campo" style={{ width: 90, textAlign: "right" }} inputMode="decimal" value={l.impostos} onChange={(e) => mudar(i, { impostos: e.target.value })} aria-label={`Impostos de ${l.nome}`} />
                      </td>
                      <td className="numero"><strong>{moeda(custoFinal(l))}</strong></td>
                      <td className="numero">
                        {l.existente ? <small className="vazio">mantém o atual</small> : (
                          <input className="campo" style={{ width: 110, textAlign: "right" }} inputMode="decimal" value={l.preco} onChange={(e) => mudar(i, { preco: e.target.value })} aria-label={`Preço de venda de ${l.nome}`} />
                        )}
                      </td>
                      <td className="numero">{!l.existente && numero(l.preco) && custoFinal(l) > 0 ? `${((numero(l.preco) as number) / custoFinal(l)).toFixed(2).replace(".", ",")}×` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <small className="vazio">
              Insumos e impostos vêm da nota (frete, seguro, outras despesas e desconto; IPI e ICMS-ST) e podem ser ajustados, por exemplo para incluir
              embalagem ou o frete que veio em outra nota. NCM, CEST e origem vão para o cadastro do produto quando ele ainda não tem.
              Caixa com várias peças (ex.: lente de contato “CX”)? Ajuste a quantidade para o que vai para a prateleira.
            </small>
          </section>

          <section className="bloco">
            <h2>3. Parcelas a pagar</h2>
            {nota.duplicatas.length > 0 ? (
              <>
                {nota.duplicatas.map((d, i) => (
                  <div key={i} className="linha-valor"><span>{d.numero ? `Parcela ${d.numero}` : `Parcela ${i + 1}`} · vence {dataBR(d.vencimento)}</span><strong>{moeda(d.valor)}</strong></div>
                ))}
                {podeFinanceiro ? (
                  <div className="linha">
                    <label className="marcar"><input type="checkbox" checked={lancarParcelas} onChange={(e) => setLancarParcelas(e.target.checked)} /> Lançar em contas a pagar</label>
                    {lancarParcelas && (
                      <label className="rotulo">Categoria
                        <select className="campo" value={categoriaCusto} onChange={(e) => setCategoriaCusto(e.target.value)}>
                          <option value="">Sem categoria</option>
                          {categoriasCusto.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                ) : (
                  <small className="vazio">Seu perfil não lança no financeiro: as parcelas ficam para quem cuida das contas.</small>
                )}
              </>
            ) : (
              <p className="vazio">A nota não traz parcelas (paga à vista ou combinada à parte).</p>
            )}
          </section>

          <div className="janela-botoes">
            {semPreco && <span className="erro">Informe o preço de venda de todos os produtos novos.</span>}
            <button className="botao" type="button" onClick={lancar} disabled={enviando || semPreco}>
              {enviando ? "Lançando…" : `Dar entrada em ${unidades} ${unidades === 1 ? "unidade" : "unidades"}`}
            </button>
          </div>
        </>
      )}
    </>
  );
}
