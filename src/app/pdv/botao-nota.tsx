"use client";

import { useState, useTransition } from "react";
import { cancelarNota, emitirNota, type ResultadoNota } from "./nota-fiscal";

export type NotaDaVenda = {
  id: string;
  status: "pendente" | "autorizada" | "rejeitada" | "cancelada";
  numero: string | null;
  mensagem: string | null;
  danfe: string | null;
  homologacao: boolean;
  /** autorizada há menos de 30 minutos e o usuário é gerente */
  cancelavel: boolean;
};

/** Emitir, ver e cancelar a NFC-e de uma venda do PDV. */
export function BotaoNota({ vendaId, nota }: { vendaId: string; nota: NotaDaVenda | null }) {
  const [resultado, setResultado] = useState<ResultadoNota | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [ocupado, iniciar] = useTransition();

  const autorizada = nota?.status === "autorizada" && !resultado;
  const danfe = resultado?.danfe ?? nota?.danfe ?? null;

  function emitir() {
    iniciar(async () => setResultado(await emitirNota(vendaId)));
  }

  function cancelar() {
    if (!nota) return;
    iniciar(async () => {
      const r = await cancelarNota(nota.id, justificativa);
      setResultado(r);
      if (r.ok) setCancelando(false);
    });
  }

  return (
    <div className="nota-fiscal">
      {nota?.status === "autorizada" && !resultado && (
        <span className="etiqueta etiqueta-ok">NFC-e {nota.numero}{nota.homologacao ? " (teste)" : ""}</span>
      )}
      {nota?.status === "cancelada" && !resultado && <span className="etiqueta etiqueta-erro">NFC-e {nota.numero} cancelada</span>}
      {nota?.status === "rejeitada" && !resultado && <span className="etiqueta etiqueta-erro" title={nota.mensagem ?? undefined}>NFC-e rejeitada</span>}
      {nota?.status === "pendente" && !resultado && <span className="etiqueta">NFC-e sem resposta</span>}

      {danfe && (resultado?.ok || autorizada) && <a href={danfe} target="_blank" rel="noopener noreferrer">Ver e imprimir o DANFCe</a>}

      {(!nota || nota.status === "rejeitada" || nota.status === "pendente" || nota.status === "cancelada") && !resultado?.ok && (
        <button type="button" className="botao-secundario" onClick={emitir} disabled={ocupado}>
          {ocupado ? "Emitindo…" : nota?.status === "pendente" ? "Tentar de novo" : "Emitir NFC-e"}
        </button>
      )}

      {autorizada && nota?.cancelavel && !cancelando && (
        <button type="button" className="botao-link" onClick={() => setCancelando(true)}>Cancelar a nota</button>
      )}
      {cancelando && (
        <span className="linha" style={{ flexWrap: "nowrap" }}>
          <input className="campo" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Motivo (mínimo 15 letras)" aria-label="Motivo do cancelamento da nota" />
          <button type="button" className="botao-secundario" onClick={cancelar} disabled={ocupado || justificativa.trim().length < 15}>Cancelar na SEFAZ</button>
        </span>
      )}

      {resultado && <small className={resultado.ok ? "ok-texto" : "erro-texto"} role="status">{resultado.mensagem}</small>}
      {nota?.status === "rejeitada" && !resultado && nota.mensagem && <small className="erro-texto">{nota.mensagem}</small>}
    </div>
  );
}
