import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { linkWhatsApp } from "@/lib/whatsapp";
import { marcarConsulta, mudarStatus } from "./actions";

const FUSO = "-03:00";
const STATUS: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  compareceu: "Compareceu",
  faltou: "Faltou",
  remarcada: "Remarcada",
  cancelada: "Cancelada",
};

function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00${FUSO}`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function hojeBR(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}
function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

type Consulta = {
  id: string;
  inicio: string;
  fim: string;
  status: string;
  origem: string;
  nome_contato: string | null;
  telefone_contato: string | null;
  clientes: { nome: string; telefone: string | null } | null;
  usuarios: { nome: string } | null;
};

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; erro?: string }>;
}) {
  const { dia: diaParam, erro } = await searchParams;
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(diaParam ?? "") ? (diaParam as string) : hojeBR();
  const supabase = await criarClienteServidor();

  const [consultasR, clientesR, equipeR, oticaR] = await Promise.all([
    supabase
      .from("consultas")
      .select("id, inicio, fim, status, origem, nome_contato, telefone_contato, clientes(nome, telefone), usuarios!consultas_profissional_id_fkey(nome)")
      .gte("inicio", `${dia}T00:00:00${FUSO}`)
      .lt("inicio", `${somarDias(dia, 1)}T00:00:00${FUSO}`)
      .order("inicio")
      .returns<Consulta[]>(),
    supabase.from("clientes").select("id, nome").order("nome").limit(500),
    supabase.from("usuarios").select("id, nome").order("nome"),
    supabase.from("oticas").select("nome").maybeSingle(),
  ]);

  const titulo = new Date(`${dia}T12:00:00${FUSO}`).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <>
      <div className="topo">
        <div>
          <h1>Agenda</h1>
          <p className="subtitulo" style={{ textTransform: "capitalize" }}>{titulo}</p>
        </div>
        <div className="topo-acoes">
          <Link className="botao-secundario" href={`/agenda?dia=${somarDias(dia, -1)}`}>← Dia anterior</Link>
          <Link className="botao-secundario" href={`/agenda?dia=${hojeBR()}`}>Hoje</Link>
          <Link className="botao-secundario" href={`/agenda?dia=${somarDias(dia, 1)}`}>Próximo dia →</Link>
        </div>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      <section className="bloco">
        <h2>Consultas do dia</h2>
        {(consultasR.data ?? []).length === 0 && <p className="vazio">Nenhuma consulta neste dia.</p>}
        {(consultasR.data ?? []).map((c) => {
          const nome = c.clientes?.nome ?? c.nome_contato ?? "Sem nome";
          const tel = c.clientes?.telefone ?? c.telefone_contato;
          const zap = linkWhatsApp(
            tel,
            `Olá ${nome.split(" ")[0]}, tudo bem? Aqui é da ${oticaR.data?.nome ?? "ótica"}. Sua consulta está marcada para ${hora(c.inicio)}. Pode confirmar presença?`,
          );
          return (
            <article key={c.id} className="receita">
              <header>
                <strong>{hora(c.inicio)}–{hora(c.fim)}</strong>
                <span>{nome}</span>
                <span className="etiqueta">{STATUS[c.status]}</span>
                {c.origem === "site" && <span className="etiqueta">pelo site</span>}
                {c.usuarios && <span>com {c.usuarios.nome}</span>}
              </header>
              <div className="topo-acoes">
                {zap && <a className="botao-secundario" href={zap} target="_blank" rel="noreferrer">Pedir confirmação (WhatsApp)</a>}
                {(["confirmada", "compareceu", "faltou", "cancelada"] as const)
                  .filter((s) => s !== c.status)
                  .map((s) => (
                    <form key={s} action={mudarStatus.bind(null, c.id, dia, s)}>
                      <button className="botao-secundario" type="submit">{STATUS[s]}</button>
                    </form>
                  ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="bloco">
        <h2>Marcar consulta</h2>
        <form action={marcarConsulta} className="formulario formulario-largo">
          <input type="hidden" name="dia" value={dia} />
          <div className="linha">
            <label className="rotulo">Horário
              <input className="campo" type="time" name="hora" step={900} required />
            </label>
            <label className="rotulo">Duração (min)
              <input className="campo" name="duracao" inputMode="numeric" defaultValue="30" />
            </label>
            <label className="rotulo">Profissional
              <select className="campo" name="profissional_id" defaultValue="">
                <option value="">Eu mesmo(a)</option>
                {(equipeR.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="linha">
            <label className="rotulo">Cliente cadastrado
              <select className="campo" name="cliente_id" defaultValue="">
                <option value="">— ou informe abaixo —</option>
                {(clientesR.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </label>
            <label className="rotulo">Nome (sem cadastro)
              <input className="campo" name="nome_contato" />
            </label>
            <label className="rotulo">Telefone
              <input className="campo" name="telefone_contato" inputMode="tel" />
            </label>
          </div>
          <div className="janela-botoes">
            <button className="botao" type="submit">Marcar</button>
          </div>
        </form>
      </section>
    </>
  );
}
