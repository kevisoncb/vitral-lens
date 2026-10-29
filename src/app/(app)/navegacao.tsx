"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ItemNavegacao = { rotulo: string; href: string };

export function Navegacao({ itens }: { itens: ItemNavegacao[] }) {
  const caminho = usePathname();

  return (
    <>
      {itens.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={caminho === item.href || caminho.startsWith(`${item.href}/`) ? "page" : undefined}
        >
          {item.rotulo}
        </Link>
      ))}
    </>
  );
}
