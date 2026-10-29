import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { MENU, moduloLiberado, pode, type Permissoes } from "@/lib/permissoes";
import { sair } from "../login/actions";
import { Navegacao } from "./navegacao";

type LinhaUsuario = {
  nome: string;
  perfis: { nome: string; permissoes: Permissoes } | null;
  oticas: { nome: string; plano: string } | null;
};

export default async function LayoutDoSistema({ children }: { children: React.ReactNode }) {
  const supabase = await criarClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nome, perfis(nome, permissoes), oticas(nome, plano)")
    .eq("id", user.id)
    .maybeSingle<LinhaUsuario>();

  if (!usuario || !usuario.perfis || !usuario.oticas) {
    return (
      <main className="conteudo">
        <h1>Acesso não liberado</h1>
        <p className="subtitulo">
          Seu login existe, mas ainda não está vinculado a uma ótica ativa. Fale com o responsável
          pela sua ótica.
        </p>
        <form action={sair}>
          <button className="botao-secundario" type="submit">
            Sair
          </button>
        </form>
      </main>
    );
  }

  const { data: recursos } = await supabase.from("plano_recursos").select("plano, recurso");
  const controlados = new Set((recursos ?? []).map((r) => r.recurso as string));
  const doPlano = new Set(
    (recursos ?? []).filter((r) => r.plano === usuario.oticas!.plano).map((r) => r.recurso as string),
  );

  const itens = MENU.filter(
    (item) =>
      item.modulo === null ||
      (pode(usuario.perfis!.permissoes, item.modulo, "ver") &&
        moduloLiberado(item.modulo, doPlano, controlados)),
  ).map(({ rotulo, href }) => ({ rotulo, href }));

  return (
    <div className="app">
      <nav className="menu" aria-label="Menu principal">
        <strong style={{ padding: "0 10px 24px", fontSize: 20, color: "#fff" }}>Vitra</strong>
        <Navegacao itens={itens} />
        <div className="menu-rodape">
          {usuario.oticas.nome}
          <br />
          {usuario.nome} ({usuario.perfis.nome})
          <br />
          <a href="/conta" style={{ color: "#b5ccc7" }}>Minha conta</a>
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
