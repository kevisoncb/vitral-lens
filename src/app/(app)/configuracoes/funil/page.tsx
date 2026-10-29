import { criarClienteServidor } from "@/lib/supabase/servidor";
import { Abas } from "../abas";
import { alternarMotivo, criarMotivo, salvarEtapa } from "./actions";

export default async function ConfigFunil() {
  const supabase = await criarClienteServidor();
  const [etapasR, motivosR] = await Promise.all([
    supabase.from("funil_etapas").select("id, nome, tipo, ordem, dias_para_sem_retorno").order("ordem"),
    supabase.from("motivos_perda").select("id, nome, ativo").order("nome"),
  ]);
  const etapas = etapasR.data ?? [];

  return (
    <>
      <h1>Configurações</h1>
      <Abas atual="/configuracoes/funil" />

      <section className="bloco">
        <h2>Etapas do funil</h2>
        <p className="vazio">“Dias parado” move o card sozinho para a etapa seguinte (ex.: Orçamento enviado → Sem retorno após 3 dias).</p>
        {etapas.map((e, i) => (
          <form key={e.id} action={salvarEtapa.bind(null, e.id)} className="linha">
            <input className="campo" name="nome" defaultValue={e.nome} aria-label="Nome da etapa" />
            {e.tipo === "aberta" && etapas[i + 1]?.tipo === "aberta" ? (
              <label className="rotulo">Dias parado até ir para “{etapas[i + 1].nome}”
                <input className="campo" name="dias" inputMode="numeric" defaultValue={e.dias_para_sem_retorno ?? ""} placeholder="não mover" />
              </label>
            ) : (
              <span className="vazio">{e.tipo === "ganha" ? "Etapa de venda fechada" : e.tipo === "perdida" ? "Etapa de perda (pede motivo)" : ""}</span>
            )}
            <button className="botao-secundario" type="submit">Salvar</button>
          </form>
        ))}
      </section>

      <section className="bloco">
        <h2>Motivos de perda</h2>
        {(motivosR.data ?? []).map((m) => (
          <form key={m.id} action={alternarMotivo.bind(null, m.id, !m.ativo)} className="linha-valor">
            <span>{m.nome}{m.ativo ? "" : " (desativado)"}</span>
            <button className="botao-secundario" type="submit">{m.ativo ? "Desativar" : "Reativar"}</button>
          </form>
        ))}
        <form action={criarMotivo} className="linha">
          <input className="campo" name="nome" placeholder="Novo motivo" aria-label="Novo motivo" required />
          <button className="botao" type="submit">Adicionar</button>
        </form>
      </section>
    </>
  );
}
