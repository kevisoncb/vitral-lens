import { criarClienteServidor } from "@/lib/supabase/servidor";
import { dataBR, moeda } from "@/lib/formatar";
import { mudarStatus, salvarAdicionais } from "./actions";
import { NovaOtica } from "./nova-otica";

const STATUS: Record<string, string> = { teste: "Em teste", ativa: "Ativa", suspensa: "Suspensa", cancelada: "Cancelada" };
const MENSALIDADE = 99;

/** Óticas do Vitra: criar com o login do dono, situação e adicionais (nota fiscal, lojas extras). */
export default async function PainelOticas({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { erro, ok } = await searchParams;
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("painel_oticas");
  const oticas = data ?? [];
  const ativas = oticas.filter((o) => o.status === "ativa");

  return (
    <>
      <div>
        <h1>Óticas</h1>
        <p className="subtitulo">Uma ótica nova começa “em teste”. Mude para “ativa” quando começar a pagar.</p>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}

      <div className="resumo">
        <div className="resumo-cartao"><span>Óticas</span><strong>{oticas.length}</strong><small>{oticas.filter((o) => o.status === "teste").length} em teste</small></div>
        <div className="resumo-cartao"><span>Ativas</span><strong>{ativas.length}</strong></div>
        <div className="resumo-cartao"><span>Mensalidades (plano)</span><strong>{moeda(ativas.length * MENSALIDADE)}</strong><small>sem os adicionais</small></div>
      </div>

      <details className="bloco">
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>+ Nova ótica</summary>
        <NovaOtica />
      </details>

      <section className="bloco">
        {oticas.length > 0 ? (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr><th>Ótica</th><th>Dono</th><th className="numero">Usuários</th><th className="numero">Lojas</th><th className="numero">Clientes</th><th>Situação</th><th>Adicionais</th></tr>
              </thead>
              <tbody>
                {oticas.map((o) => {
                  const adicionais = (o.adicionais ?? {}) as Record<string, number>;
                  return (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.nome}</strong>
                        <br /><small className="vazio">{o.slug ? `/site/${o.slug}` : "sem site"} · desde {dataBR(o.criado_em)}</small>
                      </td>
                      <td>{o.dono_email ?? "—"}</td>
                      <td className="numero">{o.usuarios}</td>
                      <td className="numero">{o.lojas}</td>
                      <td className="numero">{o.clientes}</td>
                      <td>
                        <form action={mudarStatus.bind(null, o.id)} className="linha" style={{ flexWrap: "nowrap" }}>
                          <select className="campo" name="status" defaultValue={o.status} aria-label={`Situação de ${o.nome}`} style={{ width: 130 }}>
                            {Object.entries(STATUS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                          </select>
                          <button className="botao-secundario" type="submit">Salvar</button>
                        </form>
                      </td>
                      <td>
                        <form action={salvarAdicionais.bind(null, o.id)} className="linha" style={{ flexWrap: "nowrap" }}>
                          <label className="marcar"><input type="checkbox" name="nota_fiscal" defaultChecked={!!adicionais.nota_fiscal} /> Nota fiscal</label>
                          <label className="marcar">Lojas extras
                            <input className="campo" name="multiloja" type="number" min={0} max={50} defaultValue={adicionais.multiloja ?? 0} style={{ width: 70 }} />
                          </label>
                          <button className="botao-secundario" type="submit">Salvar</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">Nenhuma ótica ainda. Crie a primeira acima.</p>
        )}
      </section>
    </>
  );
}
