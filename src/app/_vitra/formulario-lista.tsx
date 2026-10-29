"use client";

import { useActionState } from "react";
import { entrarNaLista, type EstadoLista } from "./actions";

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

export function FormularioLista() {
  const [estado, enviar, enviando] = useActionState<EstadoLista, FormData>(entrarNaLista, null);

  if (estado?.ok) return <p className="site-sucesso" role="status">{estado.mensagem}</p>;

  return (
    <form action={enviar} className="site-form">
      <label className="rotulo">Seu nome
        <input className="campo" name="nome" required autoComplete="name" />
      </label>
      <label className="rotulo">Nome da ótica
        <input className="campo" name="otica" required autoComplete="organization" />
      </label>
      <div className="linha">
        <label className="rotulo" style={{ flex: "3 1 180px" }}>Cidade
          <input className="campo" name="cidade" autoComplete="address-level2" />
        </label>
        <label className="rotulo" style={{ flex: "1 1 90px" }}>UF
          <select className="campo" name="uf" defaultValue="">
            <option value="">—</option>
            {UFS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
      </div>
      <div className="linha">
        <label className="rotulo" style={{ flex: "3 1 180px" }}>WhatsApp com DDD
          <input className="campo" name="telefone" required inputMode="tel" autoComplete="tel" placeholder="(27) 99999-0000" />
        </label>
        <label className="rotulo" style={{ flex: "1 1 90px" }}>Lojas
          <input className="campo" name="lojas" type="number" min={1} max={500} defaultValue={1} />
        </label>
      </div>
      <label className="rotulo">E-mail (opcional)
        <input className="campo" name="email" type="email" autoComplete="email" />
      </label>
      <input type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" className="site-isca" />
      <label className="marcar">
        <input type="checkbox" name="aceite" required />
        Autorizo o Vitra a usar estes dados para falar comigo sobre o sistema.
      </label>
      {estado && !estado.ok && <p className="erro" role="alert">{estado.mensagem}</p>}
      <button className="botao" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Quero entrar na lista"}</button>
    </form>
  );
}
