import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { linkWhatsApp, mensagemOculosPronto } from "@/lib/whatsapp";
import { AoVivo } from "@/components/ao-vivo";

const FUSO = "-03:00";

function hojeBR(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}
function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

export default async function Inicio() {
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();
  const hoje = hojeBR();
  const amanha = new Date(new Date(`${hoje}T12:00:00${FUSO}`).getTime() + 86_400_000).toISOString().slice(0, 10);

  const verVendas = sessao?.pode("vendas") ?? false;
  const verLab = sessao?.pode("laboratorio") ?? false;
  const verAgenda = sessao?.pode("agenda") ?? false;

  const consultorioR = verVendas
    ? await supabase.from("atendimentos").select("id, descricao, clientes(nome), funil_etapas!inner(ordem)").eq("origem", "consultorio").eq("funil_etapas.ordem", 1).limit(8)
        .returns<{ id: string; descricao: string | null; clientes: { nome: string } | null }[]>()
    : null;
  const [semRetornoR, siteR, avisarR, atrasadasR, consultasR, oticaR] = await Promise.all([
    verVendas
      ? supabase.from("atendimentos").select("id, descricao, clientes(nome), funil_etapas!inner(nome)").eq("funil_etapas.nome", "Sem retorno").limit(8)
          .returns<{ id: string; descricao: string | null; clientes: { nome: string } | null }[]>()
      : null,
    verVendas
      ? supabase.from("atendimentos").select("id, descricao, clientes(nome), funil_etapas!inner(ordem)").eq("origem", "site").eq("funil_etapas.ordem", 1).limit(8)
          .returns<{ id: string; descricao: string | null; clientes: { nome: string } | null }[]>()
      : null,
    verLab
      ? supabase.from("ordens_servico").select("id, numero, clientes(nome, telefone), os_etapas!inner(avisa_cliente)").eq("os_etapas.avisa_cliente", true)
          .returns<{ id: string; numero: number; clientes: { nome: string; telefone: string | null } | null }[]>()
      : null,
    verLab
      ? supabase.from("ordens_servico").select("id, numero, data_prometida, clientes(nome), os_etapas!inner(final)").eq("os_etapas.final", false).lt("data_prometida", amanha)
          .returns<{ id: string; numero: number; data_prometida: string; clientes: { nome: string } | null }[]>()
      : null,
    verAgenda
      ? supabase.from("consultas").select("id, inicio, status, nome_contato, clientes(nome)").gte("inicio", `${hoje}T00:00:00${FUSO}`).lt("inicio", `${amanha}T00:00:00${FUSO}`)
          .not("status", "in", "(cancelada,remarcada)").order("inicio")
          .returns<{ id: string; inicio: string; status: string; nome_contato: string | null; clientes: { nome: string } | null }[]>()
      : null,
    supabase.from("oticas").select("nome").maybeSingle(),
  ]);
  const nomeOtica = oticaR.data?.nome ?? "ótica";

  return (
    <>
      <div>
        <h1>Olá, {sessao?.nome.split(" ")[0]}</h1>
        <p className="subtitulo">O que precisa de atenção hoje.</p>
      </div>
      <AoVivo tabelas={["atendimentos", "ordens_servico", "consultas"]} />

      <div className="duas-colunas">
        {verAgenda && (
          <section className="bloco">
            <h2>Consultas de hoje</h2>
            {(consultasR?.data ?? []).length === 0 && <p className="vazio">Nenhuma consulta hoje.</p>}
            {(consultasR?.data ?? []).map((c) => (
              <div key={c.id} className="linha-valor"><span><strong>{hora(c.inicio)}</strong> {c.clientes?.nome ?? c.nome_contato}</span><small>{c.status}</small></div>
            ))}
            <Link href="/agenda">Abrir agenda</Link>
          </section>
        )}

        {verLab && (
          <section className="bloco">
            <h2>Óculos para avisar</h2>
            {(avisarR?.data ?? []).length === 0 && <p className="vazio">Nada chegou para avisar.</p>}
            {(avisarR?.data ?? []).map((o) => {
              const zap = o.clientes ? linkWhatsApp(o.clientes.telefone, mensagemOculosPronto(o.clientes.nome, nomeOtica)) : null;
              return (
                <div key={o.id} className="linha-valor">
                  <span>OS {o.numero} · {o.clientes?.nome}</span>
                  {zap && <a href={zap} target="_blank" rel="noreferrer">WhatsApp</a>}
                </div>
              );
            })}
            {(atrasadasR?.data ?? []).length > 0 && (
              <p className="aviso">{atrasadasR!.data!.length} OS vencem hoje ou estão atrasadas: {atrasadasR!.data!.map((o) => o.numero).join(", ")}.</p>
            )}
            <Link href="/laboratorio">Abrir laboratório</Link>
          </section>
        )}

        {verVendas && (
          <section className="bloco">
            <h2>Saíram do consultório (receita pronta)</h2>
            {(consultorioR?.data ?? []).length === 0 && <p className="vazio">Ninguém esperando atendimento.</p>}
            {(consultorioR?.data ?? []).map((a) => (
              <Link key={a.id} href={`/vendas/${a.id}`} className="linha-valor"><span>{a.clientes?.nome}</span><small>montar orçamento</small></Link>
            ))}
            <h2>Pedidos novos pelo site</h2>
            {(siteR?.data ?? []).length === 0 && <p className="vazio">Nenhum pedido novo.</p>}
            {(siteR?.data ?? []).map((a) => (
              <Link key={a.id} href={`/vendas/${a.id}`} className="linha-valor"><span>{a.clientes?.nome}</span><small>{a.descricao}</small></Link>
            ))}
            <h2>Sem retorno: ligar hoje</h2>
            {(semRetornoR?.data ?? []).length === 0 && <p className="vazio">Ninguém esperando retorno.</p>}
            {(semRetornoR?.data ?? []).map((a) => (
              <Link key={a.id} href={`/vendas/${a.id}`} className="linha-valor"><span>{a.clientes?.nome}</span><small>{a.descricao}</small></Link>
            ))}
            <Link href="/vendas">Abrir funil</Link>
          </section>
        )}
      </div>
    </>
  );
}
