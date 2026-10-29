import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigirArea } from "@/lib/sessao";
import { dataBR, grau } from "@/lib/formatar";
import { iniciarExameDoPaciente } from "../../actions";

type ExameH = {
  id: string;
  status: string;
  criado_em: string;
  queixa: string | null;
  conduta: string | null;
  usuarios: { nome: string } | null;
  exame_olhos: { olho: string; av_cc: string | null; esferico: number | null; cilindrico: number | null; eixo: number | null; adicao: number | null }[];
};

/** Histórico clínico do paciente (só exames e receitas; nada de compras). */
export default async function HistoricoPaciente({ params }: { params: Promise<{ id: string }> }) {
  await exigirArea("consultorio");
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const [clienteR, examesR, externasR] = await Promise.all([
    supabase.from("clientes").select("id, nome, nascimento, telefone").eq("id", id).maybeSingle(),
    supabase
      .from("exames")
      .select("id, status, criado_em, queixa, conduta, usuarios(nome), exame_olhos(olho, av_cc, esferico, cilindrico, eixo, adicao)")
      .eq("cliente_id", id)
      .order("criado_em", { ascending: false })
      .returns<ExameH[]>(),
    supabase.from("receitas").select("id, data_receita, medico, tipo").eq("cliente_id", id).is("exame_id", null).order("data_receita", { ascending: false }),
  ]);
  const c = clienteR.data;
  if (!c) notFound();

  return (
    <>
      <div className="topo">
        <div>
          <Link href="/consultorio">← Fila do dia</Link>
          <h1>{c.nome}</h1>
          <p className="subtitulo">{c.nascimento ? `Nasc. ${dataBR(c.nascimento)} · ` : ""}{c.telefone ?? ""}</p>
        </div>
        <form action={iniciarExameDoPaciente.bind(null, id)}>
          <button className="botao" type="submit">Novo exame</button>
        </form>
      </div>

      <section className="bloco">
        <h2>Exames</h2>
        {(examesR.data ?? []).length === 0 && <p className="vazio">Nenhum exame feito aqui.</p>}
        {(examesR.data ?? []).map((e) => (
          <Link key={e.id} href={`/consultorio/exame/${e.id}`} className="receita cartao-link">
            <header>
              <strong>{dataBR(e.criado_em)}</strong>
              <span>{e.usuarios?.nome}</span>
              <span className="etiqueta">{e.status === "concluido" ? "Concluído" : "Em andamento"}</span>
            </header>
            {e.queixa && <small>Queixa: {e.queixa}</small>}
            {e.exame_olhos.map((o) => (
              <small key={o.olho}>
                <strong>{o.olho}</strong> {grau(o.esferico)} {grau(o.cilindrico)} × {o.eixo ?? "—"}° · add {grau(o.adicao)} · AV {o.av_cc ?? "—"}
              </small>
            ))}
            {e.conduta && <small>Conduta: {e.conduta}</small>}
          </Link>
        ))}
      </section>

      {(externasR.data ?? []).length > 0 && (
        <section className="bloco">
          <h2>Receitas de fora</h2>
          {(externasR.data ?? []).map((r) => (
            <div key={r.id} className="linha-valor"><span>{dataBR(r.data_receita)} · {r.medico ?? "—"}</span><small>{r.tipo === "contato" ? "Lente de contato" : "Óculos"}</small></div>
          ))}
        </section>
      )}
    </>
  );
}
