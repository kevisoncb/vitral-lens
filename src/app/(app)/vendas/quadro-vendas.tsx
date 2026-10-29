"use client";

import { useEffect, useState, useTransition } from "react";
import { linkWhatsApp, mensagemCobrarRetorno } from "@/lib/whatsapp";
import { moverAtendimento } from "./actions";

export type Etapa = { id: string; nome: string; tipo: "aberta" | "ganha" | "perdida" };
export type Motivo = { id: string; nome: string };
export type Cartao = {
  id: string;
  etapaId: string;
  cliente: string;
  telefone: string | null;
  descricao: string | null;
  valor: number;
  desde: string;
};

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function diasParado(desde: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(desde)) / 86_400_000));
}

export function QuadroVendas({
  etapas,
  motivos,
  cartoesIniciais,
  nomeOtica,
}: {
  etapas: Etapa[];
  motivos: Motivo[];
  cartoesIniciais: Cartao[];
  nomeOtica: string;
}) {
  const [cartoes, setCartoes] = useState(cartoesIniciais);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [pendente, setPendente] = useState<{ cartaoId: string; etapaId: string } | null>(null);
  const [motivoId, setMotivoId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  // Depois de uma ação no servidor, a página manda a lista atualizada.
  useEffect(() => setCartoes(cartoesIniciais), [cartoesIniciais]);

  function mover(cartaoId: string, etapaId: string, motivo: string | null, obs: string | null) {
    const anterior = cartoes;
    setCartoes((lista) =>
      lista.map((c) =>
        c.id === cartaoId ? { ...c, etapaId, desde: new Date().toISOString() } : c,
      ),
    );
    setErro(null);

    iniciar(async () => {
      const resposta = await moverAtendimento(cartaoId, etapaId, motivo, obs);
      if (!resposta.ok) {
        setCartoes(anterior);
        setErro(resposta.erro);
      }
    });
  }

  function aoSoltar(etapa: Etapa) {
    const cartaoId = arrastando;
    setArrastando(null);
    setAlvo(null);
    if (!cartaoId) return;

    const cartao = cartoes.find((c) => c.id === cartaoId);
    if (!cartao || cartao.etapaId === etapa.id) return;

    if (etapa.tipo === "perdida") {
      setMotivoId("");
      setObservacao("");
      setPendente({ cartaoId, etapaId: etapa.id });
      return;
    }
    mover(cartaoId, etapa.id, null, null);
  }

  function confirmarPerda() {
    if (!pendente || !motivoId) return;
    mover(pendente.cartaoId, pendente.etapaId, motivoId, observacao.trim() || null);
    setPendente(null);
  }

  return (
    <>
      {erro && (
        <div className="erro" role="alert">
          {erro}
        </div>
      )}

      <section className="quadro" aria-label="Etapas do funil">
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
                const dias = diasParado(c.desde);
                const cobrar = etapa.tipo === "aberta" ? linkWhatsApp(c.telefone, mensagemCobrarRetorno(c.cliente, nomeOtica)) : null;
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
                    <strong>{c.cliente}</strong>
                    {c.descricao && <small>{c.descricao}</small>}
                    <div className="cartao-rodape">
                      <strong style={{ fontSize: 13 }}>{moeda.format(c.valor)}</strong>
                      <small suppressHydrationWarning>
                        {dias === 0 ? "hoje" : `${dias} ${dias === 1 ? "dia" : "dias"}`}
                      </small>
                    </div>
                    {cobrar && (
                      <div className="cartao-acoes">
                        <a href={cobrar} target="_blank" rel="noopener noreferrer">
                          Chamar no WhatsApp
                        </a>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          );
        })}
      </section>

      {pendente && (
        <div className="janela-fundo" role="dialog" aria-modal="true" aria-labelledby="titulo-perda">
          <div className="janela">
            <h2 id="titulo-perda">Por que o cliente não fechou?</h2>
            <div>
              <label className="rotulo" htmlFor="motivo">
                Motivo
              </label>
              <select
                id="motivo"
                className="campo"
                value={motivoId}
                onChange={(e) => setMotivoId(e.target.value)}
              >
                <option value="">Escolha um motivo</option>
                {motivos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="obs">
                Observação (opcional)
              </label>
              <textarea
                id="obs"
                className="campo"
                style={{ height: 80, padding: 12 }}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
            <div className="janela-botoes">
              <button className="botao-secundario" type="button" onClick={() => setPendente(null)}>
                Cancelar
              </button>
              <button className="botao" type="button" disabled={!motivoId} onClick={confirmarPerda}>
                Marcar como perdido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
