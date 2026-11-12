import { sair } from "@/app/login/actions";
import { ROTULO_AREA } from "@/lib/areas";
import type { Sessao } from "@/lib/sessao";
import { NavegacaoArea } from "./navegacao-area";

export type Aba = { href: string; rotulo: string };

/** Atalhos da gestão para as outras áreas (quem é de uma área só não vê). */
const AREAS: Aba[] = [
  { href: "/inicio", rotulo: "Loja" },
  { href: "/consultorio", rotulo: "Consultório" },
  { href: "/producao", rotulo: "Laboratório" },
  { href: "/pdv", rotulo: "PDV" },
  { href: "/financeiro", rotulo: "Financeiro" },
];

/**
 * Barra de topo das telas de área (consultório, produção, PDV, financeiro). Sem menu lateral: quem trabalha
 * ali vê só o que é da área. A aba atual fica marcada; no celular as abas ficam num botão.
 * A gestão ganha a troca de área.
 */
export function BarraArea({ sessao, titulo, abas }: { sessao: Sessao; titulo: string; abas: Aba[] }) {
  const outras = sessao.area === "gestao"
    ? AREAS.filter((a) => a.rotulo !== titulo && !(titulo === "Laboratório" && a.href === "/producao"))
    : [];
  return (
    <header className="barra-area">
      <NavegacaoArea titulo={titulo} abas={abas} outras={outras}>
        <div className="barra-area-usuario">
          <span>{sessao.nome} · {ROTULO_AREA[sessao.area]}</span>
          <a href="/conta">Minha conta</a>
          <form action={sair}>
            <button type="submit">Sair</button>
          </form>
        </div>
      </NavegacaoArea>
    </header>
  );
}
