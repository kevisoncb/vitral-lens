import Link from "next/link";
import { sair } from "@/app/login/actions";
import { ROTULO_AREA } from "@/lib/areas";
import type { Sessao } from "@/lib/sessao";

export type Aba = { href: string; rotulo: string };

/**
 * Barra de topo das telas de área (consultório, produção). Sem menu lateral: quem trabalha
 * ali vê só o que é da área. A gestão ganha o link de volta para o sistema completo.
 */
export function BarraArea({ sessao, titulo, abas }: { sessao: Sessao; titulo: string; abas: Aba[] }) {
  return (
    <header className="barra-area">
      <div className="barra-area-marca">
        <strong>Vitral</strong>
        <span>{titulo}</span>
      </div>
      <nav className="barra-area-abas" aria-label={titulo}>
        {abas.map((a) => (
          <Link key={a.href} href={a.href}>{a.rotulo}</Link>
        ))}
        {sessao.area === "gestao" && <Link href="/inicio">← Sistema completo</Link>}
      </nav>
      <div className="barra-area-usuario">
        <span>{sessao.nome} · {ROTULO_AREA[sessao.area]}</span>
        <Link href="/conta">Minha conta</Link>
        <form action={sair}>
          <button type="submit">Sair</button>
        </form>
      </div>
    </header>
  );
}
