import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigirArea } from "@/lib/sessao";
import { dataBR, dataHoraBR } from "@/lib/formatar";
import { salvarExame } from "../../actions";

type Olho = {
  olho: "OD" | "OE";
  av_sc: string | null;
  av_cc: string | null;
  esferico: number | null;
  cilindrico: number | null;
  eixo: number | null;
  adicao: number | null;
  dnp: number | null;
  altura: number | null;
};

const CAMPOS: { campo: keyof Olho; rotulo: string; texto?: boolean }[] = [
  { campo: "av_sc", rotulo: "AV s/ correção", texto: true },
  { campo: "av_cc", rotulo: "AV c/ correção", texto: true },
  { campo: "esferico", rotulo: "Esférico" },
  { campo: "cilindrico", rotulo: "Cilíndrico" },
  { campo: "eixo", rotulo: "Eixo" },
  { campo: "adicao", rotulo: "Adição" },
  { campo: "dnp", rotulo: "DNP" },
  { campo: "altura", rotulo: "Altura" },
];

export default async function Exame({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; salvo?: string; concluido?: string }>;
}) {
  await exigirArea("consultorio");
  const { id } = await params;
  const { erro, salvo, concluido } = await searchParams;
  const supabase = await criarClienteServidor();

  const [exameR, olhosR] = await Promise.all([
    supabase
      .from("exames")
      .select("*, clientes(id, nome, nascimento), usuarios(nome)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("exame_olhos").select("*").eq("exame_id", id).returns<Olho[]>(),
  ]);
  const e = exameR.data;
  if (!e) notFound();
  const travado = e.status === "concluido";
  const olho = (o: "OD" | "OE") => (olhosR.data ?? []).find((x) => x.olho === o);
  const salvar = salvarExame.bind(null, id);
  const simNao = (v: boolean | null) => (v === true ? "sim" : v === false ? "nao" : "");

  return (
    <>
      <div className="topo">
        <div>
          <Link href="/consultorio">← Fila do dia</Link>
          <h1>Exame · {e.clientes?.nome}</h1>
          <p className="subtitulo">
            {e.clientes?.nascimento ? `Nasc. ${dataBR(e.clientes.nascimento)} · ` : ""}
            Profissional: {e.usuarios?.nome ?? "—"} · aberto {dataHoraBR(e.criado_em)}
            {travado ? ` · concluído ${dataHoraBR(e.concluido_em)}` : ""}
          </p>
        </div>
        <div className="topo-acoes">
          <Link className="botao-secundario" href={`/consultorio/paciente/${e.cliente_id}`}>Histórico do paciente</Link>
        </div>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {salvo && <p className="ok" role="status">Rascunho salvo.</p>}
      {(concluido || travado) && (
        <p className="ok" role="status">Exame concluído. A receita foi gerada e o paciente já aparece no funil da loja.</p>
      )}

      <form action={salvar} className="formulario formulario-largo">
        <fieldset disabled={travado} className="sem-borda">
          <section className="bloco">
            <h2>Anamnese</h2>
            <label className="rotulo">Queixa principal<textarea className="campo" name="queixa" rows={2} defaultValue={e.queixa ?? ""} /></label>
            <label className="rotulo">Histórico (doenças, cirurgias, medicamentos, família)<textarea className="campo" name="historico" rows={3} defaultValue={e.historico ?? ""} /></label>
            <div className="linha">
              <label className="rotulo">Usa óculos?
                <select className="campo" name="usa_oculos" defaultValue={simNao(e.usa_oculos)}>
                  <option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option>
                </select>
              </label>
              <label className="rotulo">Usa lente de contato?
                <select className="campo" name="usa_lente_contato" defaultValue={simNao(e.usa_lente_contato)}>
                  <option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option>
                </select>
              </label>
              <label className="rotulo">Registro profissional<input className="campo" name="registro_profissional" defaultValue={e.registro_profissional ?? ""} placeholder="CRM / CBOO" /></label>
            </div>
          </section>

          {(["OD", "OE"] as const).map((o) => {
            const v = olho(o);
            return (
              <fieldset key={o} className="olho">
                <legend>{o === "OD" ? "Olho direito (OD)" : "Olho esquerdo (OE)"}</legend>
                <div className="grade-olho">
                  {CAMPOS.map(({ campo, rotulo, texto }) => (
                    <label key={campo} className="rotulo">{rotulo}
                      <input className="campo" name={`${o}_${campo}`} inputMode={texto ? "text" : "decimal"} placeholder={texto ? "20/20" : ""} defaultValue={v?.[campo] === null || v?.[campo] === undefined ? "" : String(v[campo])} />
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}

          <section className="bloco">
            <h2>Conclusão</h2>
            <label className="rotulo">Observações<textarea className="campo" name="observacoes" rows={2} defaultValue={e.observacoes ?? ""} /></label>
            <label className="rotulo">Conduta / orientação / encaminhamento<textarea className="campo" name="conduta" rows={2} defaultValue={e.conduta ?? ""} /></label>
            <label className="rotulo">Retorno em<input className="campo" type="date" name="retorno_em" defaultValue={e.retorno_em ?? ""} /></label>
          </section>

          {!travado && (
            <div className="janela-botoes">
              <button className="botao-secundario" type="submit" name="acao" value="rascunho">Salvar rascunho</button>
              <button className="botao" type="submit" name="acao" value="concluir">Concluir e gerar receita</button>
            </div>
          )}
        </fieldset>
      </form>

    </>
  );
}
