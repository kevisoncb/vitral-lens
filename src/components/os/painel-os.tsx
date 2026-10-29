import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { carregarOS, NOME_ETAPA_PRODUCAO } from "@/lib/os";
import { dataBR, dataHoraBR } from "@/lib/formatar";
import { linkWhatsApp, mensagemOculosPronto } from "@/lib/whatsapp";
import type { Sessao } from "@/lib/sessao";
import { moverOSFormulario, registrarProducao, salvarFicha } from "@/app/acoes/os";
import { AoVivo } from "@/components/ao-vivo";
import { FichaTecnica, TabelaGrau, TIPO_ARMACAO } from "./ficha-tecnica";
import { RecadosOS } from "./recados";

/**
 * Detalhe da OS. A loja vê a ficha para conferir e entregar; o laboratório edita a ficha
 * e registra cada etapa da produção. Os dois conversam pelos recados.
 */
export async function PainelOS({ id, sessao, modo, voltar }: { id: string; sessao: Sessao; modo: "loja" | "laboratorio"; voltar: string }) {
  const supabase = await criarClienteServidor();
  const dados = await carregarOS(supabase, id);
  if (!dados) notFound();
  const { os, olhos, producao, historico, etapas } = dados;

  const podeMover = (area: string) => sessao.area === "gestao" || sessao.area === area;
  const atual = etapas.find((e) => e.id === os.etapa_id);
  const proximas = etapas.filter((e) => e.id !== os.etapa_id && podeMover(e.area));
  const ficha = { ...os };

  let zap: string | null = null;
  if (modo === "loja" && sessao.pode("clientes")) {
    const { data: c } = await supabase.from("clientes").select("telefone").eq("id", os.cliente_id).maybeSingle();
    zap = linkWhatsApp(c?.telefone, mensagemOculosPronto(os.cliente_nome ?? "", sessao.oticaNome));
  }

  return (
    <>
      <AoVivo tabelas={["ordens_servico", "os_mensagens", "os_producao"]} />
      <div className="topo">
        <div>
          <Link href={voltar}>← Voltar ao quadro</Link>
          <h1>OS {os.numero} · {os.cliente_nome}</h1>
          <p className="subtitulo">
            {atual?.nome}
            {os.data_prometida ? ` · entrega prometida ${dataBR(os.data_prometida)}` : ""}
            {os.responsavel ? ` · com ${os.responsavel.nome}` : " · ainda não puxada pelo laboratório"}
            {os.garantia_ate ? ` · garantia até ${dataBR(os.garantia_ate)}` : ""}
          </p>
          {os.retrabalho && <p className="erro">Retrabalho: {os.motivo_retrabalho}</p>}
        </div>
        <div className="topo-acoes">
          {modo === "loja" && sessao.pode("clientes") && <Link className="botao-secundario" href={`/clientes/${os.cliente_id}`}>Ficha do cliente</Link>}
          {zap && <a className="botao-secundario" href={zap} target="_blank" rel="noreferrer">Avisar no WhatsApp</a>}
        </div>
      </div>

      {proximas.length > 0 && (
        <section className="bloco">
          <h2>Mover para</h2>
          <div className="topo-acoes">
            {proximas.map((e) => (
              <form key={e.id} action={moverOSFormulario.bind(null, os.id, e.id)}>
                <button className={e.ordem === (atual?.ordem ?? 0) + 1 ? "botao" : "botao-secundario"} type="submit">{e.nome}</button>
              </form>
            ))}
          </div>
        </section>
      )}

      {modo === "laboratorio" ? (
        <form action={salvarFicha.bind(null, os.id)} className="bloco">
          <h2>Ficha técnica</h2>
          <TabelaGrau olhos={olhos} />
          <div className="linha">
            <label className="rotulo">Lente<input className="campo" name="lente" defaultValue={ficha.lente ?? ""} /></label>
            <label className="rotulo">Tratamentos<input className="campo" name="tratamentos" defaultValue={ficha.tratamentos ?? ""} /></label>
          </div>
          <div className="linha">
            <label className="rotulo">Armação<input className="campo" name="armacao" defaultValue={ficha.armacao ?? ""} /></label>
            <label className="rotulo">Tipo
              <select className="campo" name="armacao_tipo" defaultValue={ficha.armacao_tipo ?? ""}>
                <option value="">—</option>
                {Object.entries(TIPO_ARMACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
            <label className="rotulo">Aro (mm)<input className="campo" name="aro" inputMode="decimal" defaultValue={ficha.aro ?? ""} /></label>
            <label className="rotulo">Ponte<input className="campo" name="ponte" inputMode="decimal" defaultValue={ficha.ponte ?? ""} /></label>
            <label className="rotulo">Diagonal maior<input className="campo" name="diagonal_maior" inputMode="decimal" defaultValue={ficha.diagonal_maior ?? ""} /></label>
          </div>
          <div className="linha">
            <label className="rotulo">DNP OD<input className="campo" name="dnp_od" inputMode="decimal" defaultValue={ficha.dnp_od ?? ""} /></label>
            <label className="rotulo">DNP OE<input className="campo" name="dnp_oe" inputMode="decimal" defaultValue={ficha.dnp_oe ?? ""} /></label>
            <label className="rotulo">Altura OD<input className="campo" name="altura_od" inputMode="decimal" defaultValue={ficha.altura_od ?? ""} /></label>
            <label className="rotulo">Altura OE<input className="campo" name="altura_oe" inputMode="decimal" defaultValue={ficha.altura_oe ?? ""} /></label>
          </div>
          <div className="linha">
            <label className="rotulo">Laboratório (interno ou fornecedor)<input className="campo" name="laboratorio_nome" defaultValue={os.laboratorio_nome ?? ""} /></label>
            <label className="rotulo">Entrega prometida<input className="campo" type="date" name="data_prometida" defaultValue={os.data_prometida ?? ""} /></label>
          </div>
          <label className="rotulo">Observação técnica<textarea className="campo" name="obs_tecnica" rows={2} defaultValue={ficha.obs_tecnica ?? ""} /></label>
          <div className="janela-botoes"><button className="botao" type="submit">Salvar ficha</button></div>
        </form>
      ) : (
        <FichaTecnica ficha={ficha} olhos={olhos} />
      )}

      <section className="bloco">
        <h2>Construção do óculos</h2>
        {producao.length === 0 && <p className="vazio">Nenhuma etapa de produção registrada ainda.</p>}
        {producao.map((p) => (
          <div key={p.id} className="linha-valor">
            <span>
              <strong>{NOME_ETAPA_PRODUCAO[p.etapa]}</strong>
              {p.aprovado ? "" : " · reprovado"} {p.observacao ? ` · ${p.observacao}` : ""}
            </span>
            <small>{p.usuarios?.nome} · {dataHoraBR(p.feito_em)}</small>
          </div>
        ))}
        {modo === "laboratorio" && (
          <form action={registrarProducao.bind(null, os.id)} className="linha">
            <label className="rotulo">Etapa feita
              <select className="campo" name="etapa" defaultValue="surfacagem">
                {Object.entries(NOME_ETAPA_PRODUCAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
            <label className="rotulo">Resultado
              <select className="campo" name="resultado" defaultValue="aprovado">
                <option value="aprovado">OK</option>
                <option value="reprovado">Reprovado (retrabalho)</option>
              </select>
            </label>
            <label className="rotulo" style={{ flex: "2 1 220px" }}>Observação<input className="campo" name="observacao" /></label>
            <button className="botao" type="submit">Registrar</button>
          </form>
        )}
      </section>

      <RecadosOS osId={os.id} />

      <section className="bloco">
        <h2>Caminho da OS</h2>
        {historico.length === 0 && <p className="vazio">Ainda na primeira etapa.</p>}
        {historico.map((h) => (
          <div key={h.id} className="linha-valor">
            <span>→ {h.para?.nome}</span>
            <small>{h.usuarios?.nome ?? ""} · {dataHoraBR(h.em)}</small>
          </div>
        ))}
      </section>
    </>
  );
}
