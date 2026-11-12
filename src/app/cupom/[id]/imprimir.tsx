"use client";

import { useEffect } from "react";

/**
 * Botão de imprimir (some na impressão). Com ?imprimir=1, abre a janela de impressão sozinho.
 * Com `voltar`, mostra o link de volta (página aberta na mesma aba) em vez de fechar a janela.
 */
export function Imprimir({ automatico, voltar }: { automatico: boolean; voltar?: string }) {
  useEffect(() => {
    if (automatico) window.print();
  }, [automatico]);
  return (
    <div className="cupom-acoes">
      <button type="button" className="botao" onClick={() => window.print()}>Imprimir</button>
      {voltar ? (
        <a className="botao-secundario" href={voltar}>Voltar</a>
      ) : (
        <button type="button" className="botao-secundario" onClick={() => window.close()}>Fechar</button>
      )}
    </div>
  );
}
