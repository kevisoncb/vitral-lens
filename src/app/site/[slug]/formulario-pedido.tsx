"use client";

import { useActionState } from "react";
import { enviarPedido, type Estado } from "./actions";

export function FormularioPedido({ slug }: { slug: string }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(enviarPedido.bind(null, slug), null);

  if (estado?.ok) return <p className="site-sucesso" role="status">{estado.mensagem}</p>;

  return (
    <form action={enviar} className="site-form">
      <label className="rotulo">Seu nome
        <input className="campo" name="nome" required autoComplete="name" />
      </label>
      <label className="rotulo">WhatsApp com DDD
        <input className="campo" name="telefone" required inputMode="tel" autoComplete="tel" placeholder="(27) 99999-0000" />
      </label>
      <label className="rotulo">O que você procura?
        <textarea className="campo" name="mensagem" rows={3} placeholder="Ex.: óculos multifocal, lente de contato, tenho receita…" />
      </label>
      <input type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" className="site-isca" />
      <label className="marcar">
        <input type="checkbox" name="aceite" required />
        Autorizo a ótica a usar meus dados para responder este pedido.
      </label>
      {estado && !estado.ok && <p className="erro" role="alert">{estado.mensagem}</p>}
      <button className="botao" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Pedir orçamento"}</button>
    </form>
  );
}
