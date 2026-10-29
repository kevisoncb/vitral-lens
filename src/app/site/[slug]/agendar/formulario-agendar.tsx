"use client";

import { useActionState } from "react";
import { agendar, type Estado } from "../actions";

export function FormularioAgendar({ slug, vagas }: { slug: string; vagas: { inicio: string; rotulo: string }[] }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(agendar.bind(null, slug), null);

  if (estado?.ok) return <p className="site-sucesso" role="status">{estado.mensagem}</p>;

  return (
    <form action={enviar} className="site-form">
      <fieldset className="site-horarios">
        <legend className="rotulo">Horário</legend>
        {vagas.map((v) => (
          <label key={v.inicio} className="site-horario">
            <input type="radio" name="inicio" value={v.inicio} required />
            <span>{v.rotulo}</span>
          </label>
        ))}
      </fieldset>
      <label className="rotulo">Seu nome
        <input className="campo" name="nome" required autoComplete="name" />
      </label>
      <label className="rotulo">WhatsApp com DDD
        <input className="campo" name="telefone" required inputMode="tel" autoComplete="tel" />
      </label>
      <input type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" className="site-isca" />
      <label className="marcar">
        <input type="checkbox" name="aceite" required />
        Autorizo a ótica a usar meus dados para marcar e confirmar a consulta.
      </label>
      {estado && !estado.ok && <p className="erro" role="alert">{estado.mensagem}</p>}
      <button className="botao" type="submit" disabled={enviando}>{enviando ? "Marcando…" : "Marcar consulta"}</button>
    </form>
  );
}
