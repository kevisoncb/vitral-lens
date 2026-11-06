"use client";

import { useState, useTransition } from "react";
import type { MotivoChamar } from "@/lib/whatsapp";
import { registrarContato } from "./actions";

/**
 * Abre o WhatsApp com a mensagem pronta e marca o cliente como chamado (sai da lista na hora).
 * Sem telefone válido, só marca. O envio é sempre da pessoa: o Vitral não manda nada sozinho.
 */
export function BotaoChamar({ clienteId, motivo, link }: { clienteId: string; motivo: MotivoChamar; link: string | null }) {
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function marcar(abrir: boolean) {
    if (abrir && link) window.open(link, "_blank", "noopener");
    setFeito(true); // some da lista antes de o banco confirmar
    iniciar(async () => {
      const r = await registrarContato(clienteId, motivo);
      if (!r.ok) {
        setFeito(false);
        setErro(r.mensagem ?? "Não foi possível marcar");
      }
    });
  }

  if (feito) return <span className="etiqueta etiqueta-ok">chamado</span>;
  return (
    <span className="linha" style={{ gap: 8, flexWrap: "nowrap" }}>
      {link && (
        <button className="botao" type="button" onClick={() => marcar(true)} disabled={enviando}>
          Chamar no WhatsApp
        </button>
      )}
      <button className="botao-secundario" type="button" onClick={() => marcar(false)} disabled={enviando} title="Já falou por telefone ou pessoalmente">
        Já chamei
      </button>
      {erro && <small className="erro">{erro}</small>}
    </span>
  );
}
