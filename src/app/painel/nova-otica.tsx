"use client";

import { useActionState } from "react";
import { criarOtica, type EstadoNovaOtica } from "./actions";

export function NovaOtica() {
  const [estado, enviar, enviando] = useActionState<EstadoNovaOtica, FormData>(criarOtica, null);
  return (
    <form action={enviar} className="formulario formulario-largo">
      <div className="linha">
        <label className="rotulo" style={{ flex: "3 1 240px" }}>Nome da ótica
          <input className="campo" name="nome" required placeholder="Óticas Nery" />
        </label>
        <label className="rotulo">Endereço do site (opcional)
          <input className="campo" name="slug" placeholder="nery" pattern="[a-z0-9-]{3,40}" title="3 a 40 letras minúsculas, números ou hífen" />
        </label>
      </div>
      <div className="linha">
        <label className="rotulo">Nome do dono
          <input className="campo" name="dono_nome" required />
        </label>
        <label className="rotulo">E-mail do dono (login)
          <input className="campo" name="dono_email" type="email" required />
        </label>
        <button className="botao" type="submit" disabled={enviando}>{enviando ? "Criando…" : "Criar ótica"}</button>
      </div>
      {estado && (
        <p className={estado.ok ? "ok" : "erro"} role="status">
          {estado.mensagem}
          {estado.senha && <><br />Senha temporária: <code className="senha">{estado.senha}</code></>}
        </p>
      )}
    </form>
  );
}
