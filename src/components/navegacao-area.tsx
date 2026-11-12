"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Aba } from "./barra-area";

/** Abas da área com a atual marcada; no celular, fechadas num botão com o nome da tela. */
export function NavegacaoArea({ titulo, abas, outras, children }: { titulo: string; abas: Aba[]; outras: Aba[]; children: React.ReactNode }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  useEffect(() => setAberto(false), [caminho]);
  const atual = abas
    .filter((a) => caminho === a.href || caminho.startsWith(`${a.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <>
      <div className="barra-area-marca">
        <strong>Vitral</strong>
        <span>{titulo}</span>
        <button type="button" className="barra-area-botao" aria-expanded={aberto} aria-controls="barra-area-itens" onClick={() => setAberto((a) => !a)}>
          {atual?.rotulo ?? "Menu"} <span aria-hidden>{aberto ? "▴" : "▾"}</span>
        </button>
      </div>
      <div id="barra-area-itens" className={aberto ? "barra-area-itens aberto" : "barra-area-itens"}>
        <nav className="barra-area-abas" aria-label={titulo}>
          {abas.map((a) => (
            <Link key={a.href} href={a.href} aria-current={a === atual ? "page" : undefined}>{a.rotulo}</Link>
          ))}
        </nav>
        {outras.length > 0 && (
          <nav className="barra-area-outras" aria-label="Outras áreas">
            <span>Ir para</span>
            {outras.map((a) => <Link key={a.href} href={a.href}>{a.rotulo}</Link>)}
          </nav>
        )}
        {children}
      </div>
    </>
  );
}
