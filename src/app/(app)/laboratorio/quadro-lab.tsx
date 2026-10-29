"use client";

import { useEffect, useState, useTransition } from "react";
import { linkWhatsApp, mensagemOculosPronto } from "@/lib/whatsapp";
import { dataBR } from "@/lib/formatar";
import { moverOS } from "./actions";

export type EtapaOS = { id: string; nome: string; final: boolean; avisaCliente: boolean };
export type CartaoOS = {
  id: string;
  numero: number;
  etapaId: string;
  cliente: string;
  telefone: string | null;
  descricao: string;
  laboratorio: string | null;
  prometida: string | null;
  garantiaAte: string | null;
  desde: string;
};

/** Dias entre hoje e a data (negativo = atrasada). Compara só o dia, no fuso local. */
function diasAte(data: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${data.slice(0, 10)}T00:00:00`);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

export function QuadroLab({
  etapas,
  cartoesIniciais,
  nomeOtica,
}: {
  etapas: EtapaOS[];
  cartoesIniciais: CartaoOS[];
  nomeOtica: string;
}) {
  const [cartoes, setCartoes] = useState(cartoesIniciais);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  useEffect(() => setCartoes(cartoesIniciais), [cartoesIniciais]);

  const finais = new Set(etapas.filter((e) => e.final).map((e) => e.id));
  const abertas = cartoes.filter((c) => !finais.has(c.etapaId));
  const vencemAmanha = abertas.filter((c) => c.prometida && diasAte(c.prometida) === 1).length;
  const atrasadas = abertas.filter((c) => c.prometida && diasAte(c.prometida) < 0).length;

  function mover(id: string, etapaId: string) {
    const anterior = cartoes;
    setErro(null);
    setCartoes((atual) => atual.map((c) => (c.id === id ? { ...c, etapaId, desde: new Date().toISOString() } : c)));
    iniciar(async () => {
      const r = await moverOS(id, etapaId);
      if (!r.ok) {
        setCartoes(anterior);
        setErro(r.erro);
      }
    });
  }

  function aoSoltar(etapa: EtapaOS) {
    const id = arrastando;
    setArrastando(null);
    setAlvo(null);
    if (!id) return;
    const c = cartoes.find((x) => x.id === id);
    if (!c || c.etapaId === etapa.id) return;
    mover(id, etapa.id);
  }

  return (
    <>
      {(vencemAmanha > 0 || atrasadas > 0) && (
        <div role="status" className="aviso">
          {atrasadas > 0 && <strong>{atrasadas} {atrasadas === 1 ? "ordem atrasada" : "ordens atrasadas"}. </strong>}
          {vencemAmanha > 0 && <span>{vencemAmanha} {vencemAmanha === 1 ? "vence" : "vencem"} amanhã.</span>}
        </div>
      )}
      {erro && <p className="erro" role="alert">{erro}</p>}

      <section className="quadro" aria-label="Etapas do laboratório">
        {etapas.map((etapa) => {
          const daEtapa = cartoes.filter((c) => c.etapaId === etapa.id);
          return (
            <div
              key={etapa.id}
              className="coluna"
              data-alvo={alvo === etapa.id}
              onDragOver={(e) => {
                e.preventDefault();
                setAlvo(etapa.id);
              }}
              onDragLeave={() => setAlvo((atual) => (atual === etapa.id ? null : atual))}
              onDrop={() => aoSoltar(etapa)}
            >
              <div className="coluna-titulo">
                <span>{etapa.nome}</span>
                <span>{daEtapa.length}</span>
              </div>

              {daEtapa.map((c) => {
                const d = c.prometida && !etapa.final ? diasAte(c.prometida) : null;
                const zap = etapa.avisaCliente ? linkWhatsApp(c.telefone, mensagemOculosPronto(c.cliente, nomeOtica)) : null;
                return (
                  <article
                    key={c.id}
                    className="cartao"
                    draggable
                    data-arrastando={arrastando === c.id}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setArrastando(c.id);
                    }}
                    onDragEnd={() => {
                      setArrastando(null);
                      setAlvo(null);
                    }}
                  >
                    <small>OS {c.numero}{c.prometida && !etapa.final ? ` · entrega ${dataBR(c.prometida)}` : ""}</small>
                    <strong>{c.cliente}</strong>
                    <small>{c.descricao}</small>
                    {c.laboratorio && <small>Lab: {c.laboratorio}</small>}
                    {d !== null && d < 0 && <span className="etiqueta etiqueta-erro">Atrasada {-d} {-d === 1 ? "dia" : "dias"}</span>}
                    {d === 0 && <span className="etiqueta etiqueta-erro">Vence hoje</span>}
                    {d === 1 && <span className="etiqueta">Vence amanhã</span>}
                    {etapa.final && c.garantiaAte && <span className="etiqueta etiqueta-ok">Garantia até {dataBR(c.garantiaAte)}</span>}
                    {zap && (
                      <div className="cartao-acoes">
                        <a href={zap} target="_blank" rel="noopener noreferrer">Avisar no WhatsApp</a>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          );
        })}
      </section>
    </>
  );
}
