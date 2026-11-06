import Link from "next/link";
import { redirect } from "next/navigation";
import { MENU } from "@/lib/permissoes";
import { INICIO_DA_AREA, ROTULO_AREA } from "@/lib/areas";
import { obterSessao } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { sair } from "../login/actions";
import { Navegacao } from "./navegacao";

/** Tela da loja (balcão) e da gestão. Consultório e laboratório vão para as telas deles. */
export default async function LayoutDaLoja({ children }: { children: React.ReactNode }) {
  const sessao = await obterSessao();

  if (!sessao) {
    // equipe do Vitral não pertence a uma ótica: vai para o painel
    const supabase = await criarClienteServidor();
    const { data: admin } = await supabase.rpc("sou_admin_vitral");
    if (admin) redirect("/painel");
    return (
      <main className="conteudo">
        <h1>Acesso não liberado</h1>
        <p className="subtitulo">
          Seu login existe, mas ainda não está vinculado a uma ótica ativa. Fale com o responsável
          pela sua ótica.
        </p>
        <form action={sair}>
          <button className="botao-secundario" type="submit">Sair</button>
        </form>
      </main>
    );
  }

  if (sessao.area !== "loja" && sessao.area !== "gestao") {
    redirect(INICIO_DA_AREA[sessao.area]);
  }

  const gestao = sessao.area === "gestao";
  const supabase = await criarClienteServidor();
  const { data: contratados } = await supabase.from("otica_adicionais").select("recurso");
  const temAdicional = new Set((contratados ?? []).map((a) => a.recurso));
  const secoes = MENU.map((secao) => ({
    titulo: secao.titulo,
    itens: secao.itens
      .filter((item) => (!item.soGestao || gestao) && (item.modulo === null || sessao.pode(item.modulo, "ver")))
      .map(({ rotulo, href, adicional }) => ({ rotulo, href, adicional: !!adicional && !temAdicional.has(adicional) })),
  })).filter((secao) => secao.itens.length > 0);

  return (
    <div className="app">
      <nav className="menu" aria-label="Menu principal">
        <Navegacao secoes={secoes} otica={sessao.oticaNome} />
        <div className="menu-rodape">
          {sessao.oticaNome} · {ROTULO_AREA[sessao.area]}
          <br />
          {sessao.nome} ({sessao.perfilNome})
          <br />
          <Link href="/conta" style={{ color: "#b5ccc7" }}>Minha conta</Link>
          <form action={sair} style={{ marginTop: 10 }}>
            <button
              type="submit"
              style={{ background: "none", border: "none", padding: 0, color: "#b5ccc7", textDecoration: "underline", cursor: "pointer" }}
            >
              Sair
            </button>
          </form>
        </div>
      </nav>
      <main className="conteudo">{children}</main>
    </div>
  );
}
