import { criarClienteServidor } from "@/lib/supabase/servidor";
import { dataHoraBR } from "@/lib/formatar";
import { Abas } from "../abas";
import { criarBloqueio, criarHorario, excluirBloqueio, excluirHorario } from "./actions";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function ConfigAgenda({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await criarClienteServidor();
  const [horariosR, bloqueiosR, lojasR, equipeR] = await Promise.all([
    supabase.from("horarios_trabalho").select("id, dia_semana, inicio, fim, duracao_min, usuarios(nome), lojas(nome)").order("dia_semana").order("inicio")
      .returns<{ id: string; dia_semana: number; inicio: string; fim: string; duracao_min: number; usuarios: { nome: string } | null; lojas: { nome: string } | null }[]>(),
    supabase.from("bloqueios_agenda").select("id, inicio, fim, motivo").gte("fim", new Date().toISOString()).order("inicio"),
    supabase.from("lojas").select("id, nome").eq("ativa", true).order("criado_em"),
    supabase.from("usuarios").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const lojas = lojasR.data ?? [];

  const seletorLoja = (
    <label className="rotulo">Loja
      <select className="campo" name="loja_id" defaultValue={lojas[0]?.id}>
        {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
      </select>
    </label>
  );
  const seletorProfissional = (
    <label className="rotulo">Profissional
      <select className="campo" name="profissional_id" defaultValue="">
        <option value="">Toda a loja</option>
        {(equipeR.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
      </select>
    </label>
  );

  return (
    <>
      <h1>Configurações</h1>
      <Abas atual="/configuracoes/agenda" />
      {erro && <p className="erro" role="alert">{erro}</p>}

      <section className="bloco">
        <h2>Horários de atendimento</h2>
        <p className="vazio">O agendamento pelo site oferece só os horários cadastrados aqui.</p>
        {(horariosR.data ?? []).map((h) => (
          <form key={h.id} action={excluirHorario.bind(null, h.id)} className="linha-valor">
            <span>
              <strong>{DIAS[h.dia_semana]}</strong> {h.inicio.slice(0, 5)}–{h.fim.slice(0, 5)} · consultas de {h.duracao_min} min
              {h.usuarios ? ` · ${h.usuarios.nome}` : ""} {h.lojas ? ` · ${h.lojas.nome}` : ""}
            </span>
            <button className="botao-secundario" type="submit">Remover</button>
          </form>
        ))}
        <form action={criarHorario} className="formulario formulario-largo">
          <fieldset className="dias-semana">
            <legend className="rotulo">Dias</legend>
            {DIAS.map((d, i) => (
              <label key={d} className="marcar"><input type="checkbox" name="dia_semana" value={i} defaultChecked={i >= 1 && i <= 5} /> {d}</label>
            ))}
          </fieldset>
          <div className="linha">
            <label className="rotulo">Das<input className="campo" type="time" name="inicio" defaultValue="09:00" required /></label>
            <label className="rotulo">Até<input className="campo" type="time" name="fim" defaultValue="18:00" required /></label>
            <label className="rotulo">Duração (min)<input className="campo" name="duracao_min" inputMode="numeric" defaultValue="30" /></label>
            {seletorLoja}
            {seletorProfissional}
          </div>
          <div className="janela-botoes"><button className="botao" type="submit">Adicionar horário</button></div>
        </form>
      </section>

      <section className="bloco">
        <h2>Dias e horários bloqueados</h2>
        <p className="vazio">Feriado, folga, curso. Bloqueia na agenda e no site ao mesmo tempo.</p>
        {(bloqueiosR.data ?? []).map((b) => (
          <form key={b.id} action={excluirBloqueio.bind(null, b.id)} className="linha-valor">
            <span>{dataHoraBR(b.inicio)} até {dataHoraBR(b.fim)}{b.motivo ? ` · ${b.motivo}` : ""}</span>
            <button className="botao-secundario" type="submit">Remover</button>
          </form>
        ))}
        <form action={criarBloqueio} className="formulario formulario-largo">
          <div className="linha">
            <label className="rotulo">De<input className="campo" type="date" name="de" required /></label>
            <label className="rotulo">Até<input className="campo" type="date" name="ate" /></label>
            <label className="rotulo">Hora inicial (opcional)<input className="campo" type="time" name="hora_inicio" /></label>
            <label className="rotulo">Hora final (opcional)<input className="campo" type="time" name="hora_fim" /></label>
          </div>
          <div className="linha">
            <label className="rotulo">Motivo<input className="campo" name="motivo" placeholder="Ex.: feriado" /></label>
            {seletorLoja}
            {seletorProfissional}
          </div>
          <div className="janela-botoes"><button className="botao" type="submit">Bloquear</button></div>
        </form>
      </section>
    </>
  );
}
