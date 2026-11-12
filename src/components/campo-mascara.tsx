"use client";

import { useState } from "react";
import { aplicarMascara, valorInicial, type Mascara } from "@/lib/mascaras";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> & {
  mascara: Mascara;
  /** valor inicial (formulário comum); o campo cuida do resto */
  defaultValue?: string | number | null;
  /** valor controlado por quem usa (telas interativas) */
  value?: string;
  onChange?: (valorComMascara: string) => void;
  /** porcentagem negativa (ex.: desconto no frete) */
  negativo?: boolean;
};

const PREFIXO: Partial<Record<Mascara, string>> = { moeda: "R$" };
const SUFIXO: Partial<Record<Mascara, string>> = { porcentagem: "%" };
const TECLADO: Partial<Record<Mascara, React.HTMLAttributes<HTMLInputElement>["inputMode"]>> = { telefone: "tel" };

/** Campo com máscara: dinheiro (R$ 1.234,56), porcentagem, CPF, CNPJ, telefone, NCM, CEST, CFOP, CEP. */
export function CampoMascara({ mascara, defaultValue, value, onChange, negativo = false, className = "campo", style, ...resto }: Props) {
  const [interno, setInterno] = useState(() => valorInicial(mascara, defaultValue));
  const atual = value ?? interno;
  const prefixo = PREFIXO[mascara];
  const sufixo = SUFIXO[mascara];

  function mudar(e: React.ChangeEvent<HTMLInputElement>) {
    const novo = aplicarMascara(mascara, e.target.value, negativo);
    if (value === undefined) setInterno(novo);
    onChange?.(novo);
  }

  const input = (
    <input
      {...resto}
      className={className}
      style={prefixo || sufixo ? undefined : style}
      value={atual}
      onChange={mudar}
      inputMode={TECLADO[mascara] ?? "numeric"}
      autoComplete={resto.autoComplete ?? "off"}
    />
  );
  if (!prefixo && !sufixo) return input;
  return (
    <span className={`campo-mascara${prefixo ? " com-prefixo" : ""}${sufixo ? " com-sufixo" : ""}`} style={style}>
      {prefixo && <span className="campo-mascara-prefixo" aria-hidden="true">{prefixo}</span>}
      {input}
      {sufixo && <span className="campo-mascara-sufixo" aria-hidden="true">{sufixo}</span>}
    </span>
  );
}
