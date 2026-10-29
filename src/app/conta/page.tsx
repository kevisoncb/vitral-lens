import Link from "next/link";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao";
import { INICIO_DA_AREA, ROTULO_AREA } from "@/lib/areas";
import { FormularioSenha } from "./formulario-senha";

/** Fica fora das áreas: qualquer funcionário troca a própria senha. */
export default async function MinhaConta() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  return (
    <main className="conteudo" style={{ maxWidth: 640, margin: "0 auto" }}>
      <Link href={INICIO_DA_AREA[sessao.area]}>← Voltar</Link>
      <div>
        <h1>Minha conta</h1>
        <p className="subtitulo">{sessao.nome} · {sessao.perfilNome} · {ROTULO_AREA[sessao.area]} · {sessao.oticaNome}</p>
      </div>
      <section className="bloco">
        <h2>Trocar senha</h2>
        <FormularioSenha />
      </section>
    </main>
  );
}
