import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { linkWhatsApp, mensagemOculosPronto, ROTULO_MOTIVO, type MotivoChamar } from "@/lib/whatsapp";
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
  const verClientes = sessao?.pode("clientes") ?? false;

  const consultorioR = verVendas
    ? await supabase.from("atendimentos").select("id, descricao, clientes(nome), funil_etapas!inner(ordem)").eq("origem", "consultorio").eq("funil_etapas.ordem", 1).limit(8)
        .returns<{ id: string; descricao: string | null; clientes: { nome: string } | null }[]>()
    : null;
  const [semRetornoR, siteR, avisarR, atrasadasR, consultasR, oticaR, chamarR] = await Promise.all([
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
    verClientes ? supabase.rpc("clientes_para_chamar", {}) : null,
  ]);
  const paraChamar = ((chamarR?.data ?? []) as { cliente_id: string; nome: string; motivo: MotivoChamar; detalhe: string }[]);
  const consultas = consultasR?.data ?? [];
  const avisar = avisarR?.data ?? [];
  const atrasadas = atrasadasR?.data ?? [];
  const nomeOtica = oticaR.data?.nome ?? "ótica";

  return (
    <>
      <div>
        <h1>Olá, {sessao?.nome.split(" ")[0]}</h1>
        <p className="subtitulo">O que precisa de atenção hoje.</p>
      </div>
      <AoVivo tabelas={["atendimentos", "ordens_servico", "consultas"]} />

      <div className="resumo">
        {verAgenda && <Link className="resumo-cartao cartao-link" href="/agenda"><span>Consultas hoje</span><strong>{consultas.length}</strong></Link>}
        {verLab && <Link className="resumo-cartao cartao-link" href="/laboratorio"><span>Óculos para avisar</span><strong>{avisar.length}</strong></Link>}
        {verLab && (
          <Link className="resumo-cartao cartao-link" href="/laboratorio">
            <span>OS atrasadas ou para hoje</span><strong style={atrasadas.length > 0 ? { color: "var(--erro-texto)" } : undefined}>{atrasadas.length}</strong>
          </Link>
        )}
        {verClientes && <Link className="resumo-cartao cartao-link" href="/clientes/chamar"><span>Clientes para chamar</span><strong>{paraChamar.length}</strong></Link>}
      </div>

      <div className="duas-colunas">
        {verAgenda && (
          <section className="bloco">
            <h2>Consultas de hoje</h2>
            {consultas.length === 0 && <p className="vazio">Nenhuma consulta hoje.</p>}
            {consultas.map((c) => (
              <div key={c.id} className="linha-valor"><span><strong>{hora(c.inicio)}</strong> {c.clientes?.nome ?? c.nome_contato}</span><small>{c.status}</small></div>
            ))}
            <Link href="/agenda">Abrir a agenda</Link>
          </section>
        )}

        {verLab && (
          <section className="bloco">
            <h2>Óculos para avisar</h2>
            {avisar.length === 0 && <p className="vazio">Nada chegou para avisar.</p>}
            {avisar.map((o) => {
              const zap = o.clientes ? linkWhatsApp(o.clientes.telefone, mensagemOculosPronto(o.clientes.nome, nomeOtica)) : null;
              return (
                <div key={o.id} className="linha-valor">
                  <Link href={`/laboratorio/${o.id}`}>OS {o.numero} · {o.clientes?.nome}</Link>
                  {zap && <a href={zap} target="_blank" rel="noreferrer">WhatsApp</a>}
                </div>
              );
            })}
            {atrasadas.length > 0 && (
              <p className="aviso">{atrasadas.length} {atrasadas.length === 1 ? "OS vence hoje ou está atrasada" : "OS vencem hoje ou estão atrasadas"}: {atrasadas.map((o) => o.numero).join(", ")}.</p>
            )}
            <Link href="/laboratorio">Abrir as ordens de serviço</Link>
          </section>
        )}

        {verVendas && (
          <section className="bloco">
            <h2>Saíram do consultório</h2>
            <small className="vazio">Receita pronta: falta montar o orçamento.</small>
            {(consultorioR?.data ?? []).length === 0 && <p className="vazio">Ninguém esperando atendimento.</p>}
            {(consultorioR?.data ?? []).map((a) => (
              <Link key={a.id} href={`/vendas/${a.id}`} className="linha-valor"><span>{a.clientes?.nome}</span><small>montar orçamento</small></Link>
            ))}
          </section>
        )}

        {verVendas && (
          <section className="bloco">
            <h2>Pedidos novos pelo site</h2>
            {(siteR?.data ?? []).length === 0 && <p className="vazio">Nenhum pedido novo.</p>}
            {(siteR?.data ?? []).map((a) => (
              <Link key={a.id} href={`/vendas/${a.id}`} className="linha-valor"><span>{a.clientes?.nome}</span><small>{a.descricao}</small></Link>
            ))}
          </section>
        )}

        {verVendas && (
          <section className="bloco">
            <h2>Orçamentos sem retorno</h2>
            <small className="vazio">Mandaram orçamento e não responderam: vale ligar hoje.</small>
            {(semRetornoR?.data ?? []).length === 0 && <p className="vazio">Ninguém esperando retorno.</p>}
            {(semRetornoR?.data ?? []).map((a) => (
              <Link key={a.id} href={`/vendas/${a.id}`} className="linha-valor"><span>{a.clientes?.nome}</span><small>{a.descricao}</small></Link>
            ))}
            <Link href="/vendas">Abrir o funil de vendas</Link>
          </section>
        )}

        {verClientes && (
          <section className="bloco">
            <h2>Clientes para chamar</h2>
            {paraChamar.length === 0 && <p className="vazio">Ninguém para chamar hoje.</p>}
            {paraChamar.slice(0, 6).map((c) => (
              <Link key={`${c.cliente_id}-${c.motivo}`} href={`/clientes/chamar?motivo=${c.motivo}`} className="linha-valor">
                <span>{c.nome}</span><small>{ROTULO_MOTIVO[c.motivo]}</small>
              </Link>
            ))}
            {paraChamar.length > 0 && <Link href="/clientes/chamar">Ver todos e chamar no WhatsApp</Link>}
          </section>
        )}
      </div>
    </>
  );
}
