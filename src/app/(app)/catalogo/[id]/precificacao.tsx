"use client";

import { useState } from "react";
import { CampoMascara } from "@/components/campo-mascara";
import { ValorReaisOuPct } from "@/components/valor-reais-ou-pct";
import { moeda } from "@/lib/formatar";
import { formatarDecimal, lerDecimal } from "@/lib/mascaras";
import { custoFinal, margemPeloPreco, precoPelaMargem, type Tipo } from "@/lib/precificacao";

type Inicial = {
  custo: number | null;
  insumos: number;
  insumosTipo: Tipo;
  impostos: number;
  impostosTipo: Tipo;
  margem: number | null;
  preco: number;
};

/**
 * Custo, margem e preço. Insumos e impostos em R$ ou em % da compra (chave R$ / %). Margem é % sobre o
 * custo final: mudou o custo ou a margem, o preço acompanha; mudou o preço, a margem acompanha.
 */
export function Precificacao({ inicial, podeEditar }: { inicial: Inicial; podeEditar: boolean }) {
  const [custo, setCusto] = useState(inicial.custo === null ? "" : formatarDecimal(inicial.custo));
  const [insumosTipo, setInsumosTipo] = useState<Tipo>(inicial.insumosTipo);
  const [insumos, setInsumos] = useState(formatarDecimal(inicial.insumos));
  const [impostosTipo, setImpostosTipo] = useState<Tipo>(inicial.impostosTipo);
  const [impostos, setImpostos] = useState(formatarDecimal(inicial.impostos));
  const [preco, setPreco] = useState(formatarDecimal(inicial.preco));
  const [margem, setMargem] = useState(() => {
    if (inicial.margem !== null) return formatarDecimal(inicial.margem);
    const c = custoFinal(inicial.custo ?? 0, inicial.insumos, inicial.insumosTipo, inicial.impostos, inicial.impostosTipo);
    const m = margemPeloPreco(c, inicial.preco);
    return m === null ? "" : formatarDecimal(m);
  });

  const compra = lerDecimal(custo) ?? 0;
  const calcular = (c: string, it: Tipo, i: string, pt: Tipo, p: string) =>
    custoFinal(lerDecimal(c) ?? 0, lerDecimal(i) ?? 0, it, lerDecimal(p) ?? 0, pt);
  const final = calcular(custo, insumosTipo, insumos, impostosTipo, impostos);
  const venda = lerDecimal(preco) ?? 0;
  const lucro = venda - final;

  /** O custo mudou: com margem informada, o preço acompanha. */
  function precoNovo(novoFinal: number) {
    const m = lerDecimal(margem);
    if (m !== null && novoFinal > 0) setPreco(formatarDecimal(precoPelaMargem(novoFinal, m)));
  }

  return (
    <>
      <div className="grade-campos">
        <label className="rotulo">Compra (por unidade)
          <CampoMascara mascara="moeda" name="custo" value={custo} disabled={!podeEditar}
            onChange={(t) => { setCusto(t); precoNovo(calcular(t, insumosTipo, insumos, impostosTipo, impostos)); }} />
          <small className="ajuda-campo">preço na nota do fornecedor</small>
        </label>
        <label className="rotulo" title="Frete, seguro, embalagem e outras despesas. Desconto do fornecedor entra negativo.">Insumos
          <ValorReaisOuPct rotulo="Insumos" nome="insumos" negativo tipo={insumosTipo} texto={insumos} compra={compra} disabled={!podeEditar}
            onChange={(tipo, texto) => { setInsumosTipo(tipo); setInsumos(texto); precoNovo(calcular(custo, tipo, texto, impostosTipo, impostos)); }} />
        </label>
        <label className="rotulo" title="IPI e ICMS-ST pagos na compra">Impostos da compra
          <ValorReaisOuPct rotulo="Impostos da compra" nome="impostos" tipo={impostosTipo} texto={impostos} compra={compra} disabled={!podeEditar}
            onChange={(tipo, texto) => { setImpostosTipo(tipo); setImpostos(texto); precoNovo(calcular(custo, insumosTipo, insumos, tipo, texto)); }} />
        </label>
      </div>
      <div className="grade-campos">
        <label className="rotulo">Custo final
          <span className="campo campo-leitura">{moeda(final)}</span>
          <small className="ajuda-campo">compra + insumos + impostos</small>
        </label>
        <label className="rotulo" title="% sobre o custo final: custo R$ 100 com margem 30% = venda R$ 130">Margem (% sobre o custo)
          <CampoMascara mascara="porcentagem" name="margem_pct" value={margem} disabled={!podeEditar}
            onChange={(t) => { setMargem(t); const m = lerDecimal(t); if (m !== null && final > 0) setPreco(formatarDecimal(precoPelaMargem(final, m))); }} />
          <small className="ajuda-campo">lucro de {moeda(lucro)} por peça</small>
        </label>
        <label className="rotulo">Preço de venda
          <CampoMascara mascara="moeda" name="preco" value={preco} disabled={!podeEditar}
            onChange={(t) => { setPreco(t); const p = lerDecimal(t); const m = p === null ? null : margemPeloPreco(final, p); setMargem(m === null ? "" : formatarDecimal(m)); }} />
          <small className="ajuda-campo">{venda > 0 ? `${formatarDecimal((lucro / venda) * 100)}% do preço é lucro bruto` : ""}</small>
        </label>
      </div>
    </>
  );
}
