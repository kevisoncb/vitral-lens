"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type ItemNavegacao = { rotulo: string; href: string; adicional: boolean };
export type SecaoNavegacao = { titulo: string | null; itens: ItemNavegacao[] };

/** Menu por seções. No celular fica fechado num botão com o nome da tela atual. */
export function Navegacao({ secoes, otica }: { secoes: SecaoNavegacao[]; otica: string }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  useEffect(() => setAberto(false), [caminho]);

  // a tela atual é o item de endereço mais comprido que bate (Estoque não acende em Entrada pela nota)
  const todos = secoes.flatMap((s) => s.itens);
  const atual = todos
    .filter((i) => caminho === i.href || caminho.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <>
      <div className="menu-topo">
        <strong className="menu-marca">Vitral</strong>
        <button type="button" className="menu-botao" aria-expanded={aberto} aria-controls="menu-itens" onClick={() => setAberto((a) => !a)}>
          {atual?.rotulo ?? "Menu"} <span aria-hidden>{aberto ? "▴" : "▾"}</span>
        </button>
      </div>
      <div id="menu-itens" className={aberto ? "menu-itens aberto" : "menu-itens"}>
        <span className="menu-otica">{otica}</span>
        {secoes.map((secao, n) => (
          <div key={secao.titulo ?? n} className="menu-secao">
            {secao.titulo && <span className="menu-secao-titulo">{secao.titulo}</span>}
            {secao.itens.map((item) => (
              <Link key={item.href} href={item.href} aria-current={item === atual ? "page" : undefined}>
                {item.rotulo}
                {item.adicional && <span className="menu-selo" title="Recurso pago à parte">adicional</span>}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
