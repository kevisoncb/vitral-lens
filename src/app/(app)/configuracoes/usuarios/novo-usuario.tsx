"use client";

import { useActionState } from "react";
import { criarUsuario, type EstadoConvite } from "./actions";

export function NovoUsuario({ perfis, lojas }: { perfis: { id: string; nome: string }[]; lojas: { id: string; nome: string }[] }) {
  const [estado, enviar, enviando] = useActionState<EstadoConvite, FormData>(criarUsuario, null);
  return (
    <form action={enviar} className="formulario formulario-largo">
      <div className="linha">
        <label className="rotulo">Nome<input className="campo" name="nome" required /></label>
        <label className="rotulo">E-mail (login)<input className="campo" name="email" type="email" required /></label>
      </div>
      <div className="linha">
        <label className="rotulo">Perfil
          <select className="campo" name="perfil_id" required defaultValue="">
            <option value="" disabled>Escolha</option>
            {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <label className="rotulo">Loja
          <select className="campo" name="loja_id" defaultValue={lojas[0]?.id ?? ""}>
            {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </label>
        <button className="botao" type="submit" disabled={enviando}>{enviando ? "Criando…" : "Criar login"}</button>
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
