"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { moverOS } from "@/app/acoes/os";

type Etapa = { id: string; nome: string; ordem: number; area: string };
type Estado = { atual: string; mover: (id: string) => void; pendente: boolean; erro: string | null };

const Contexto = createContext<Estado | null>(null);

/**
 * Guarda a etapa da OS na tela: o botão "Mover para" muda a etapa na hora (atualização otimista) e o
 * cabeçalho acompanha; se o banco recusar, volta e mostra o motivo. Depois a página é recarregada do servidor.
 */
export function EtapaOS({ osId, inicial, children }: { osId: string; inicial: string; children: ReactNode }) {
  const router = useRouter();
  const [atual, setAtual] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);

  // o botão fica travado só enquanto o banco responde; a recarga da página vem depois, sem travar a tela
  async function mover(etapaId: string) {
    const antes = atual;
    setErro(null);
    setAtual(etapaId);
    setPendente(true);
    const r = await moverOS(osId, etapaId).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
    setPendente(false);
    if (!r.ok) {
      setAtual(antes);
      setErro(r.erro);
      return;
    }
    router.refresh();
  }

  return <Contexto.Provider value={{ atual, mover, pendente, erro }}>{children}</Contexto.Provider>;
}

function useEtapa() {
  const c = useContext(Contexto);
  if (!c) throw new Error("Use dentro de <EtapaOS>");
  return c;
}

export function NomeEtapa({ etapas }: { etapas: Etapa[] }) {
  const { atual } = useEtapa();
  return <>{etapas.find((e) => e.id === atual)?.nome}</>;
}

/** Botões das etapas que a área da pessoa pode mover (o banco confere de novo em os_etapa_permitida). */
export function MoverPara({ etapas, areas }: { etapas: Etapa[]; areas: string[] | "todas" }) {
  const { atual, mover, pendente, erro } = useEtapa();
  const ordemAtual = etapas.find((e) => e.id === atual)?.ordem ?? 0;
  const proximas = etapas.filter((e) => e.id !== atual && (areas === "todas" || areas.includes(e.area)));
  if (proximas.length === 0 && !erro) return null;
  return (
    <section className="bloco">
      <h2>Mover para</h2>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="topo-acoes">
        {proximas.map((e) => (
          <button key={e.id} type="button" disabled={pendente} onClick={() => mover(e.id)}
            className={e.ordem === ordemAtual + 1 ? "botao" : "botao-secundario"}>{e.nome}</button>
        ))}
      </div>
    </section>
  );
}
