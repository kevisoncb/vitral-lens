import Link from "next/link";

const ABAS = [
  { href: "/configuracoes", rotulo: "Ótica e site" },
  { href: "/configuracoes/usuarios", rotulo: "Usuários" },
  { href: "/configuracoes/perfis", rotulo: "Perfis e permissões" },
  { href: "/configuracoes/agenda", rotulo: "Horários e bloqueios" },
  { href: "/configuracoes/funil", rotulo: "Funil e motivos" },
];

export function Abas({ atual }: { atual: string }) {
  return (
    <nav className="abas" aria-label="Configurações">
      {ABAS.map((a) => (
        <Link key={a.href} href={a.href} aria-current={a.href === atual ? "page" : undefined}>
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
