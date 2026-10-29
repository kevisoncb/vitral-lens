import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { sair } from "@/app/login/actions";

/** Painel do Vitra: só para quem está em vitra_admins (o banco confere em cada função). */
export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const supabase = await criarClienteServidor();
  const [{ data: { user } }, { data: admin }] = await Promise.all([supabase.auth.getUser(), supabase.rpc("sou_admin_vitra")]);

  if (!admin) {
    return (
      <main className="conteudo">
        <h1>Painel do Vitra</h1>
        <p className="subtitulo">Esta área é só da equipe do Vitra.</p>
        <Link href="/inicio">Ir para o sistema</Link>
      </main>
    );
  }

  return (
    <div className="area">
      <header className="barra-area">
        <div className="barra-area-marca"><strong>Vitra</strong><span>Painel</span></div>
        <nav className="barra-area-abas" aria-label="Painel">
          <Link href="/painel">Óticas</Link>
          <Link href="/painel/espera">Lista de espera</Link>
        </nav>
        <div className="barra-area-usuario">
          <span>{user?.email}</span>
          <form action={sair}><button type="submit">Sair</button></form>
        </div>
      </header>
      <main className="area-conteudo">{children}</main>
    </div>
  );
}
