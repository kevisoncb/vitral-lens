import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { criarCategoria, excluirCategoria, salvarCategoria } from "../actions";

const TIPOS: Record<string, string> = {
  fornecedor: "Fornecedor",
  fixo: "Custo fixo",
  imposto: "Imposto",
  servico: "Serviço",
  comissao: "Comissão",
  outro: "Outro",
};

/** Categorias de custo: o tipo "imposto" alimenta o quadro de impostos da visão do mês. */
export default async function Categorias({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { erro, ok } = await searchParams;
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("categorias_custo").select("id, nome, tipo").order("tipo").order("nome");
  const categorias = data ?? [];
  const podeEditar = sessao?.pode("financeiro", "editar") ?? false;

  return (
    <>
      <h1>Categorias de custo</h1>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}
      <section className="bloco">
        {categorias.map((c) =>
          podeEditar ? (
            <form key={c.id} action={salvarCategoria.bind(null, c.id)} className="linha">
              <input className="campo" name="nome" defaultValue={c.nome} aria-label="Nome" style={{ flex: "3 1 240px" }} />
              <select className="campo" name="tipo" defaultValue={c.tipo} aria-label="Tipo">
                {Object.entries(TIPOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
              <button className="botao-secundario" type="submit">Salvar</button>
              {sessao?.pode("financeiro", "excluir") && (
                <button className="botao-link" type="submit" formAction={excluirCategoria.bind(null, c.id)}>Excluir</button>
              )}
            </form>
          ) : (
            <div key={c.id} className="linha-valor"><span>{c.nome}</span><span>{TIPOS[c.tipo] ?? c.tipo}</span></div>
          ),
        )}
        {categorias.length === 0 && <p className="vazio">Nenhuma categoria.</p>}
        {sessao?.pode("financeiro", "criar") && (
          <form action={criarCategoria} className="linha">
            <input className="campo" name="nome" placeholder="Nova categoria" aria-label="Nome da nova categoria" required style={{ flex: "3 1 240px" }} />
            <select className="campo" name="tipo" defaultValue="fornecedor" aria-label="Tipo">
              {Object.entries(TIPOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
            <button className="botao" type="submit">Adicionar</button>
          </form>
        )}
      </section>
    </>
  );
}
