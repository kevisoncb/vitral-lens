"use client";

import { useActionState } from "react";
import { trocarSenha, type EstadoSenha } from "./actions";

export function FormularioSenha() {
  const [estado, enviar, enviando] = useActionState<EstadoSenha, FormData>(trocarSenha, null);
  return (
    <form action={enviar} className="formulario">
      <label className="rotulo">Nova senha<input className="campo" type="password" name="senha" minLength={8} required autoComplete="new-password" /></label>
      <label className="rotulo">Repita a nova senha<input className="campo" type="password" name="confirmar" minLength={8} required autoComplete="new-password" /></label>
      {estado && <p className={estado.ok ? "ok" : "erro"} role="status">{estado.mensagem}</p>}
      <div className="janela-botoes"><button className="botao" type="submit" disabled={enviando}>Trocar senha</button></div>
    </form>
  );
}
