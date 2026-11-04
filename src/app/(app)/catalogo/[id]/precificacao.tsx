"use client";

import { useState } from "react";
import { CampoMascara } from "@/components/campo-mascara";
import { moeda } from "@/lib/formatar";
import { formatarDecimal, lerDecimal } from "@/lib/mascaras";

/**
 * Custo e preço em porcentagem sobre a compra, que é como a ótica costuma saber
 * (frete 5%, IPI 10%, markup 150%). O valor em reais aparece ao lado.
 */
export function Precificacao({
  inicial,
  podeEditar,
}: {
  inicial: { custo: number | null; insumosPct: number; impostosPct: number; preco: number };
  podeEditar: boolean;
}) {
  const [custo, setCusto] = useState(inicial.custo === null ? "" : formatarDecimal(inicial.custo));
  const [insumos, setInsumos] = useState(formatarDecimal(inicial.insumosPct));
  const [impostos, setImpostos] = useState(formatarDecimal(inicial.impostosPct));
  const [preco, setPreco] = useState(formatarDecimal(inicial.preco));
  const [markup, setMarkup] = useState("");

  const compra = lerDecimal(custo) ?? 0;
  const pctInsumos = lerDecimal(insumos) ?? 0;
  const pctImpostos = lerDecimal(impostos) ?? 0;
  const final = Math.round(compra * (1 + (pctInsumos + pctImpostos) / 100) * 100) / 100;
  const venda = lerDecimal(preco) ?? 0;
  const lucro = venda - final;
  const markupAtual = final > 0 && venda > 0 ? (venda / final - 1) * 100 : null;

  function aplicarMarkup() {
    const m = lerDecimal(markup);
    if (m !== null && final > 0) setPreco(formatarDecimal(Math.max(0, Math.ceil(final * (1 + m / 100)) - 0.1)));
  }

  return (
    <>
      <div className="linha" style={{ alignItems: "flex-start" }}>
        <label className="rotulo">Compra (preço na nota, por unidade)
          <CampoMascara mascara="moeda" name="custo" value={custo} onChange={setCusto} disabled={!podeEditar} />
        </label>
        <label className="rotulo" title="Frete, seguro, embalagem e outras despesas, em % da compra. Desconto do fornecedor entra negativo.">
          Insumos (% da compra)
          <CampoMascara mascara="porcentagem" negativo name="insumos_pct" value={insumos} onChange={setInsumos} disabled={!podeEditar} />
          <small className="vazio">{moeda((compra * pctInsumos) / 100)} por unidade</small>
        </label>
        <label className="rotulo" title="IPI e ICMS-ST pagos na compra, em % da compra">
          Impostos da compra (% da compra)
          <CampoMascara mascara="porcentagem" name="impostos_pct" value={impostos} onChange={setImpostos} disabled={!podeEditar} />
          <small className="vazio">{moeda((compra * pctImpostos) / 100)} por unidade</small>
        </label>
      </div>
      <div className="linha">
        <label className="rotulo">Preço de venda
          <CampoMascara mascara="moeda" name="preco" value={preco} onChange={setPreco} disabled={!podeEditar} />
        </label>
        {podeEditar && (
          <>
            <label className="rotulo" title="Quanto o preço fica acima do custo final. Ex.: 150% transforma R$ 100 de custo em R$ 250.">
              Markup desejado (% sobre o custo)
              <CampoMascara mascara="porcentagem" value={markup} onChange={setMarkup} placeholder="150,00" />
            </label>
            <button type="button" className="botao-secundario" onClick={aplicarMarkup} disabled={lerDecimal(markup) === null || final <= 0}>Calcular preço</button>
          </>
        )}
      </div>
      <div className="resumo">
        <div className="resumo-cartao"><span>Custo final</span><strong>{moeda(final)}</strong><small>compra + {formatarDecimal(pctInsumos + pctImpostos)}% de insumos e impostos</small></div>
        <div className="resumo-cartao"><span>Lucro bruto por peça</span><strong className={lucro < 0 ? "erro-texto" : undefined}>{moeda(lucro)}</strong><small>antes dos impostos da venda</small></div>
        <div className="resumo-cartao">
          <span>Markup</span>
          <strong>{markupAtual === null ? "—" : `${formatarDecimal(markupAtual)}%`}</strong>
          <small>{venda > 0 ? `margem de ${formatarDecimal((lucro / venda) * 100)}% do preço` : ""}</small>
        </div>
      </div>
    </>
  );
}
