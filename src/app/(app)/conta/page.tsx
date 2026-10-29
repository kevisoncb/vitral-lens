import { obterSessao } from "@/lib/sessao";
import { FormularioSenha } from "./formulario-senha";

export default async function MinhaConta() {
  const sessao = await obterSessao();
  return (
    <>
      <div>
        <h1>Minha conta</h1>
        <p className="subtitulo">{sessao?.nome}</p>
      </div>
      <section className="bloco">
        <h2>Trocar senha</h2>
        <FormularioSenha />
      </section>
    </>
  );
}
