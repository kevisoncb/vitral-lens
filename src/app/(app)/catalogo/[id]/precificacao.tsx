"use client";

import { useState } from "react";
import { moeda } from "@/lib/formatar";

const numero = (t: string) => {
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return t.trim() !== "" && Number.isFinite(n) ? n : null;
};
const texto = (n: number | null) => (n === null ? "" : n.toFixed(2).replace(".", ","));

/** Custo em partes, preço de venda e margem, com a conta feita na hora. */
export function Precificacao({
  inicial,
  podeEditar,
}: {
  inicial: { custo: number | null; insumos: number; impostos: number; preco: number };
  podeEditar: boolean;
}) {
  const [custo, setCusto] = useState(texto(inicial.custo));
  const [insumos, setInsumos] = useState(texto(inicial.insumos));
  const [impostos, setImpostos] = useState(texto(inicial.impostos));
  const [preco, setPreco] = useState(texto(inicial.preco));
  const [margem, setMargem] = useState("");

  const final = (numero(custo) ?? 0) + (numero(insumos) ?? 0) + (numero(impostos) ?? 0);
  const venda = numero(preco) ?? 0;
  const lucro = venda - final;

  function aplicarMargem() {
    const m = numero(margem);
    if (m && m > 0 && final > 0) setPreco(texto(Math.max(0, Math.ceil(final * m) - 0.1)));
  }

  const campo = (rotulo: string, nome: string, valor: string, mudar: (v: string) => void, dica?: string) => (
    <label className="rotulo" title={dica}>{rotulo}
      <input className="campo" name={nome} inputMode="decimal" value={valor} onChange={(e) => mudar(e.target.value)} disabled={!podeEditar} placeholder="0,00" />
    </label>
  );

  return (
    <>
      <div className="linha">
        {campo("Compra (R$ por unidade)", "custo", custo, setCusto, "Preço unitário na nota do fornecedor")}
        {campo("Insumos (R$)", "custo_insumos", insumos, setInsumos, "Frete, seguro, embalagem e outras despesas por unidade (desconto entra negativo)")}
        {campo("Impostos da compra (R$)", "custo_impostos", impostos, setImpostos, "IPI e ICMS-ST pagos na compra, por unidade")}
      </div>
      <div className="linha">
        {campo("Preço de venda (R$)", "preco", preco, setPreco)}
        {podeEditar && (
          <>
            <label className="rotulo" style={{ flex: "0 1 150px" }}>Margem desejada (×)
              <input className="campo" inputMode="decimal" value={margem} onChange={(e) => setMargem(e.target.value)} placeholder="2,5" />
            </label>
            <button type="button" className="botao-secundario" onClick={aplicarMargem} disabled={!numero(margem) || final <= 0}>Calcular preço</button>
          </>
        )}
      </div>
      <div className="resumo">
        <div className="resumo-cartao"><span>Custo final</span><strong>{moeda(final)}</strong><small>compra + insumos + impostos</small></div>
        <div className="resumo-cartao"><span>Lucro bruto por peça</span><strong className={lucro < 0 ? "erro-texto" : undefined}>{moeda(lucro)}</strong><small>antes dos impostos da venda</small></div>
        <div className="resumo-cartao">
          <span>Margem</span>
          <strong>{final > 0 && venda > 0 ? `${(venda / final).toFixed(2).replace(".", ",")}×` : "—"}</strong>
          <small>{venda > 0 ? `${Math.round((lucro / venda) * 100)}% do preço é lucro bruto` : ""}</small>
        </div>
      </div>
    </>
  );
}
