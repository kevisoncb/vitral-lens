import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarSite, criarClientePublico } from "@/lib/supabase/publico";
import { FormularioAgendar } from "./formulario-agendar";

const FUSO = "America/Sao_Paulo";

function diaBR(offset: number): string {
  const d = new Date(Date.now() - 3 * 3600_000 + offset * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export default async function Agendar({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ dia?: string }>;
}) {
  const { slug } = await params;
  const { dia: diaParam } = await searchParams;
  const site = await buscarSite(slug);
  if (!site || !site.agendamento_online) notFound();

  const dias = Array.from({ length: 14 }, (_, i) => diaBR(i));
  const dia = dias.includes(diaParam ?? "") ? (diaParam as string) : dias[0];

  const { data } = await criarClientePublico().rpc("horarios_livres", { p_slug: slug, p_dia: dia });
  const vagas = ((data ?? []) as { inicio: string; fim: string }[]).map((v) => ({
    inicio: v.inicio,
    rotulo: new Date(v.inicio).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }),
  }));

  return (
    <div className="site" style={{ ["--site-cor" as string]: site.cor ?? "#0f6e64" }}>
      <header className="site-topo">
        <Link href={`/site/${slug}`}><strong>{site.nome}</strong></Link>
      </header>
      <section className="site-bloco">
        <h1>Agendar exame de vista</h1>
        <p>Escolha o dia e o horário. Dias e horários já ocupados não aparecem.</p>
        <div className="site-dias" role="list">
          {dias.map((d) => {
            const data = new Date(`${d}T12:00:00-03:00`);
            return (
              <Link
                key={d}
                role="listitem"
                href={`/site/${slug}/agendar?dia=${d}`}
                className="site-dia"
                aria-current={d === dia ? "date" : undefined}
              >
                <small>{data.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "short" })}</small>
                <strong>{data.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" })}</strong>
              </Link>
            );
          })}
        </div>
        {vagas.length === 0 ? (
          <p className="vazio">Sem horários livres neste dia. Escolha outro dia.</p>
        ) : (
          <FormularioAgendar slug={slug} vagas={vagas} />
        )}
      </section>
    </div>
  );
}
