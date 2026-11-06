import { criarClienteServidor } from "@/lib/supabase/servidor";
import { dataHoraBR, moeda } from "@/lib/formatar";

type Caixa = {
  id: string;
  aberto_em: string;
  fechado_em: string | null;
  valor_abertura: number;
  valor_fechamento: number | null;
  valor_esperado: number | null;
  observacao: string | null;
  lojas: { nome: string } | null;
  usuarios: { nome: string } | null;
};

/** Conferência dos caixas: quanto devia ter na gaveta e quanto foi contado. */
export default async function CaixasFechados({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("caixas")
    .select("id, aberto_em, fechado_em, valor_abertura, valor_fechamento, valor_esperado, observacao, lojas(nome), usuarios(nome)")
    .order("aberto_em", { ascending: false })
    .limit(60)
    .returns<Caixa[]>();
  const caixas = data ?? [];

  return (
    <>
      <h1>Caixas</h1>
      {ok && <p className="ok" role="status">{ok}</p>}
      <section className="bloco">
        {caixas.length > 0 ? (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr><th>Aberto</th><th>Fechado</th><th>Operador</th><th>Loja</th><th className="numero">Abertura</th><th className="numero">Esperado</th><th className="numero">Contado</th><th className="numero">Diferença</th></tr>
              </thead>
              <tbody>
                {caixas.map((c) => {
                  const dif = c.valor_fechamento !== null && c.valor_esperado !== null ? Number(c.valor_fechamento) - Number(c.valor_esperado) : null;
                  return (
                    <tr key={c.id} title={c.observacao ?? undefined}>
                      <td>{dataHoraBR(c.aberto_em)}</td>
                      <td>{c.fechado_em ? dataHoraBR(c.fechado_em) : <span className="etiqueta etiqueta-ok">aberto</span>}</td>
                      <td>{c.usuarios?.nome ?? "—"}</td>
                      <td>{c.lojas?.nome ?? "—"}</td>
                      <td className="numero">{moeda(c.valor_abertura)}</td>
                      <td className="numero">{c.valor_esperado !== null ? moeda(c.valor_esperado) : "—"}</td>
                      <td className="numero">{c.valor_fechamento !== null ? moeda(c.valor_fechamento) : "—"}</td>
                      <td className="numero">
                        {dif === null ? "—" : Math.abs(dif) < 0.005 ? <span className="etiqueta etiqueta-ok">ok</span>
                          : <span className="etiqueta etiqueta-erro">{dif > 0 ? "+" : "−"}{moeda(Math.abs(dif))}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">Nenhum caixa aberto ainda.</p>
        )}
      </section>
    </>
  );
}
