"use client";

import { useEffect } from "react";

/** Botão de imprimir (some na impressão). Com ?imprimir=1, abre a janela de impressão sozinho. */
export function Imprimir({ automatico }: { automatico: boolean }) {
  useEffect(() => {
    if (automatico) window.print();
  }, [automatico]);
  return (
    <div className="cupom-acoes">
      <button type="button" className="botao" onClick={() => window.print()}>Imprimir</button>
      <button type="button" className="botao-secundario" onClick={() => window.close()}>Fechar</button>
    </div>
  );
}
