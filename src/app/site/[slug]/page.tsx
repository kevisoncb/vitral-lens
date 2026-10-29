import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarSite } from "@/lib/supabase/publico";
import { linkWhatsApp } from "@/lib/whatsapp";
import { FormularioPedido } from "./formulario-pedido";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const site = await buscarSite(slug);
  if (!site) return { title: "Ótica não encontrada" };
  return { title: site.nome, description: site.titulo ?? site.sobre?.slice(0, 150) ?? undefined };
}

export default async function SiteDaOtica({ params }: Props) {
  const { slug } = await params;
  const site = await buscarSite(slug);
  if (!site) notFound();

  const zap = linkWhatsApp(site.whatsapp, `Olá! Vim pelo site da ${site.nome} e queria tirar uma dúvida.`);
  const cor = site.cor ?? "#0f6e64";

  return (
    <div className="site" style={{ ["--site-cor" as string]: cor }}>
      <header className="site-topo">
        <strong>{site.nome}</strong>
        <nav>
          <a href="#orcamento">Orçamento</a>
          {site.agendamento_online && <Link href={`/site/${slug}/agendar`}>Agendar exame</Link>}
          {zap && <a href={zap} target="_blank" rel="noreferrer">WhatsApp</a>}
        </nav>
      </header>

      <section className="site-hero">
        <h1>{site.titulo ?? `Óculos e lentes com atendimento de verdade na ${site.nome}`}</h1>
        <div className="site-hero-acoes">
          <a className="botao" href="#orcamento">Pedir orçamento</a>
          {site.agendamento_online && <Link className="botao-secundario" href={`/site/${slug}/agendar`}>Agendar exame de vista</Link>}
        </div>
      </section>

      {site.sobre && (
        <section className="site-bloco">
          <h2>Sobre nós</h2>
          {site.sobre.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}
        </section>
      )}

      <section className="site-bloco site-grade">
        <div>
          <h2>Onde estamos</h2>
          <p>{site.endereco ?? "Endereço em breve."}</p>
          {site.endereco && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.endereco)}`} target="_blank" rel="noreferrer">Ver no mapa</a>
          )}
        </div>
        <div>
          <h2>Horário</h2>
          <p style={{ whiteSpace: "pre-line" }}>{site.horario ?? "Consulte pelo WhatsApp."}</p>
          {site.instagram && <a href={`https://instagram.com/${site.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer">Instagram {site.instagram}</a>}
        </div>
      </section>

      <section className="site-bloco" id="orcamento">
        <h2>Peça seu orçamento</h2>
        <p>Conte o que você precisa. Respondemos pelo WhatsApp, sem compromisso.</p>
        <FormularioPedido slug={slug} />
      </section>

      <footer className="site-rodape">
        {site.nome} · Seus dados são usados só para responder o seu pedido (LGPD). · Feito com Vitra
      </footer>
      {zap && <a className="site-zap" href={zap} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp">WhatsApp</a>}
    </div>
  );
}
