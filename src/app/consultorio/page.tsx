import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigirArea } from "@/lib/sessao";
import { AoVivo } from "@/components/ao-vivo";
import { iniciarExameDaConsulta, novoPaciente } from "./actions";

const FUSO = "-03:00";
function hojeBR(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}
function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

export default async function FilaDoConsultorio({ searchParams }: { searchParams: Promise<{ q?: string; erro?: string }> }) {
  const sessao = await exigirArea("consultorio");
  const { q, erro } = await searchParams;
  const busca = (q ?? "").trim().replace(/[%,()]/g, "");
  const supabase = await criarClienteServidor();
  const hoje = hojeBR();
  const amanha = new Date(new Date(`${hoje}T12:00:00${FUSO}`).getTime() + 86_400_000).toISOString().slice(0, 10);

  const [consultasR, andamentoR, pacientesR] = await Promise.all([
    supabase
      .from("consultas")
      .select("id, inicio, status, origem, nome_contato, clientes(nome), exames(id, status)")
      .gte("inicio", `${hoje}T00:00:00${FUSO}`)
      .lt("inicio", `${amanha}T00:00:00${FUSO}`)
      .not("status", "in", "(cancelada,remarcada)")
      .order("inicio")
      .returns<{ id: string; inicio: string; status: string; origem: string; nome_contato: string | null; clientes: { nome: string } | null; exames: { id: string; status: string }[] }[]>(),
    supabase
      .from("exames")
      .select("id, criado_em, clientes(nome)")
      .eq("status", "em_andamento")
      .order("criado_em")
      .returns<{ id: string; criado_em: string; clientes: { nome: string } | null }[]>(),
    busca
      ? supabase.from("clientes").select("id, nome, telefone").or(`nome.ilike.%${busca}%,telefone.ilike.%${busca}%`).order("nome").limit(20)
      : Promise.resolve({ data: [] as { id: string; nome: string; telefone: string | null }[] }),
  ]);

  return (
    <>
      <AoVivo tabelas={["consultas", "exames"]} />
      <div>
        <h1>Fila do dia</h1>
        <p className="subtitulo">Ao concluir o exame, a receita é gerada e o paciente aparece para a loja montar o orçamento.</p>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="duas-colunas">
        <section className="bloco">
          <h2>Agendados para hoje</h2>
          {sessao.pode("agenda") ? null : <p className="vazio">Seu perfil não vê a agenda.</p>}
          {(consultasR.data ?? []).length === 0 && <p className="vazio">Nenhuma consulta marcada hoje.</p>}
          {(consultasR.data ?? []).map((c) => {
            const exame = c.exames?.[0];
            return (
              <div key={c.id} className="linha-valor">
                <span>
                  <strong>{hora(c.inicio)}</strong> {c.clientes?.nome ?? c.nome_contato}
                  {c.origem === "site" ? " · pelo site" : ""} · {c.status}
                </span>
                {exame ? (
                  <Link className="botao-secundario" href={`/consultorio/exame/${exame.id}`}>{exame.status === "concluido" ? "Ver exame" : "Continuar exame"}</Link>
                ) : (
                  <form action={iniciarExameDaConsulta.bind(null, c.id)}>
                    <button className="botao" type="submit">Iniciar exame</button>
                  </form>
                )}
              </div>
            );
          })}
        </section>

        <section className="bloco">
          <h2>Exames em andamento</h2>
          {(andamentoR.data ?? []).length === 0 && <p className="vazio">Nenhum exame aberto.</p>}
          {(andamentoR.data ?? []).map((e) => (
            <Link key={e.id} href={`/consultorio/exame/${e.id}`} className="linha-valor">
              <span>{e.clientes?.nome}</span>
              <small>aberto às {hora(e.criado_em)}</small>
            </Link>
          ))}
        </section>
      </div>

      <div className="duas-colunas">
        <section className="bloco">
          <h2>Paciente sem agendamento</h2>
          <form action="/consultorio" method="get" className="linha">
            <input className="campo" type="search" name="q" defaultValue={busca} placeholder="Buscar nome ou telefone" aria-label="Buscar paciente" />
            <button className="botao-secundario" type="submit">Buscar</button>
          </form>
          {(pacientesR.data ?? []).map((p) => (
            <Link key={p.id} href={`/consultorio/paciente/${p.id}`} className="linha-valor">
              <span>{p.nome}</span>
              <small>{p.telefone ?? ""}</small>
            </Link>
          ))}
          {busca && (pacientesR.data ?? []).length === 0 && <p className="vazio">Ninguém encontrado. Cadastre ao lado.</p>}
        </section>

        <section className="bloco">
          <h2>Cadastrar e examinar</h2>
          <form action={novoPaciente} className="formulario">
            <label className="rotulo">Nome<input className="campo" name="nome" required /></label>
            <div className="linha">
              <label className="rotulo">Telefone<input className="campo" name="telefone" inputMode="tel" /></label>
              <label className="rotulo">Nascimento<input className="campo" type="date" name="nascimento" /></label>
            </div>
            <label className="marcar"><input type="checkbox" name="lgpd" /> Paciente autorizou o uso dos dados de saúde (LGPD)</label>
            <div className="janela-botoes"><button className="botao" type="submit">Cadastrar e abrir exame</button></div>
          </form>
        </section>
      </div>
    </>
  );
}
