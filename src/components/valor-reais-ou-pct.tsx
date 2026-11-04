"use client";

import { CampoMascara } from "@/components/campo-mascara";
import { moeda } from "@/lib/formatar";
import { formatarDecimal, lerDecimal } from "@/lib/mascaras";
import { converter, emReais, type Tipo } from "@/lib/precificacao";

/**
 * Valor em reais ou em % da compra, com a chave R$ / % do lado. Trocar a chave converte mantendo o
 * mesmo dinheiro; embaixo aparece sempre o equivalente na outra unidade.
 */
export function ValorReaisOuPct({
  tipo,
  texto,
  compra,
  onChange,
  negativo = false,
  nome,
  rotulo,
  disabled,
}: {
  tipo: Tipo;
  texto: string;
  /** preço de compra da unidade, base da porcentagem */
  compra: number;
  onChange: (tipo: Tipo, texto: string) => void;
  negativo?: boolean;
  /** nome nos formulários comuns: envia <nome>_valor e <nome>_tipo */
  nome?: string;
  rotulo: string;
  disabled?: boolean;
}) {
  const valor = lerDecimal(texto) ?? 0;

  function trocar(novo: Tipo) {
    if (novo === tipo) return;
    onChange(novo, formatarDecimal(converter(valor, tipo, novo, compra)));
  }

  const equivalente = tipo === "porcentagem" ? moeda(emReais(compra, valor, "porcentagem")) : compra > 0 ? `${formatarDecimal(converter(valor, "reais", "porcentagem", compra))}% da compra` : "—";

  return (
    <span className="valor-unidade">
      <span className="valor-unidade-campo">
        <CampoMascara
          mascara={tipo === "porcentagem" ? "porcentagem" : "moeda"}
          negativo={negativo}
          value={texto}
          onChange={(t) => onChange(tipo, t)}
          name={nome ? `${nome}_valor` : undefined}
          aria-label={`${rotulo} (${tipo === "porcentagem" ? "% da compra" : "reais"})`}
          disabled={disabled}
        />
        <span className="valor-unidade-chave" role="group" aria-label={`${rotulo}: reais ou porcentagem`}>
          <button type="button" aria-pressed={tipo === "reais"} onClick={() => trocar("reais")} disabled={disabled}>R$</button>
          <button type="button" aria-pressed={tipo === "porcentagem"} onClick={() => trocar("porcentagem")} disabled={disabled}>%</button>
        </span>
      </span>
      {nome && <input type="hidden" name={`${nome}_tipo`} value={tipo} />}
      <small className="ajuda-campo">= {equivalente}</small>
    </span>
  );
}
