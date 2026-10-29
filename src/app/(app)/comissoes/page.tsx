import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigirArea } from "@/lib/sessao";
import { dataBR, mesAnterior, mesDoParametro, moeda, nomeMes, proximoMes } from "@/lib/formatar";
import { apagarRegra, pagarComissoes, salvarRegra } from "./actions";

const CATEGORIAS: Record<string, string> = {
  armacao: "Armações",
  lente: "Lentes",
  tratamento: "Tratamentos",
  lente_contato: "Lentes de contato",
  acessorio: "Acessórios",
  servico: "Serviços",
};

type Comissao = {
  id: string;
  usuario_id: string;
  atendimento_id: string | null;
  base: number;
  valor: number;
  status: "aberta" | "paga" | "cancelada";
  paga_em: string | null;
  criado_em: string;
  usuarios: { nome: string } | null;
  atendimentos: { descricao: string | null; clientes: { nome: string } | null } | null;
};

type Regra = { id: string; usuario_id: string | null; categoria: string | null; percentual: number; usuarios: { nome: string } | null };

export default async function PaginaComissoes({ searchParams }: { searchParams: Promise<{ mes?: string; erro?: string; ok?: string }> }) {
  const { mes: mesParam, erro, ok } = await searchParams;
  const sessao = await exigirArea("loja", "gestao");
  if (!sessao.pode("comissoes")) {
    return (
      <>
        <h1>Comissões</h1>
        <p className="subtitulo">Seu perfil não tem acesso às comissões.</p>
      </>
    );
  }
  const mes = mesDoParametro(mesParam);
  const gestor = sessao.pode("comissoes", "editar");
  const supabase = await criarClienteServidor();

  const [comR, regrasR, equipeR] = await Promise.all([
    // o banco só devolve as do próprio vendedor, a não ser para quem edita comissões
    supabase
      .from("comissoes")
      .select("id, usuario_id, atendimento_id, base, valor, status, paga_em, criado_em, usuarios(nome), atendimentos(descricao, clientes(nome))")
      .eq("competencia", `${mes}-01`)
      .neq("status", "cancelada")
      .order("criado_em", { ascending: false })
      .returns<Comissao[]>(),
    supabase.from("comissao_regras").select("id, usuario_id, categoria, percentual, usuarios(nome)").returns<Regra[]>(),
    gestor ? supabase.from("usuarios").select("id, nome").eq("ativo", true).order("nome") : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);
  const comissoes = comR.data ?? [];

  const porVendedor = new Map<string, { nome: string; vendas: number; base: number; valor: number; abertas: string[]; aberto: number }>();
  for (const c of comissoes) {
    const v = porVendedor.get(c.usuario_id) ?? { nome: c.usuarios?.nome ?? "—", vendas: 0, base: 0, valor: 0, abertas: [], aberto: 0 };
    v.vendas++;
    v.base += Number(c.base);
    v.valor += Number(c.valor);
    if (c.status === "aberta") {
      v.abertas.push(c.id);
      v.aberto += Number(c.valor);
    }
    porVendedor.set(c.usuario_id, v);
  }
  const total = comissoes.reduce((s, c) => s + Number(c.valor), 0);
  const aberto = comissoes.filter((c) => c.status === "aberta").reduce((s, c) => s + Number(c.valor), 0);

  const regras = [...(regrasR.data ?? [])].sort(
    (a, b) => Number(!!b.usuario_id) - Number(!!a.usuario_id) || Number(!!b.categoria) - Number(!!a.categoria) || (a.usuarios?.nome ?? "").localeCompare(b.usuarios?.nome ?? ""),
  );

  return (
    <>
      <div className="topo">
        <div>
          <h1>Comissões</h1>
          <p className="subtitulo">
            {gestor ? "Calculadas sozinhas no primeiro pagamento de cada venda, pelas regras abaixo." : "Suas comissões, calculadas no primeiro pagamento de cada venda."}
          </p>
        </div>
        <nav className="topo-acoes" aria-label="Mês">
          <Link className="botao-secundario" href={`/comissoes?mes=${mesAnterior(mes)}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }} aria-label="Mês anterior">←</Link>
          <strong style={{ textTransform: "capitalize" }}>{nomeMes(mes)}</strong>
          <Link className="botao-secundario" href={`/comissoes?mes=${proximoMes(mes)}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }} aria-label="Próximo mês">→</Link>
        </nav>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">Salvo.</p>}

      <div className="resumo">
        <div className="resumo-cartao"><span>Vendas com comissão</span><strong>{comissoes.length}</strong></div>
        <div className="resumo-cartao"><span>Comissão do mês</span><strong>{moeda(total)}</strong></div>
        <div className="resumo-cartao"><span>A pagar</span><strong>{moeda(aberto)}</strong></div>
      </div>

      {gestor && porVendedor.size > 0 && (
        <section className="bloco">
          <h2>Por vendedor</h2>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr><th>Vendedor</th><th className="numero">Vendas</th><th className="numero">Base</th><th className="numero">Comissão</th><th className="numero">A pagar</th><th /></tr>
              </thead>
              <tbody>
                {[...porVendedor.entries()].sort((a, b) => b[1].valor - a[1].valor).map(([id, v]) => (
                  <tr key={id}>
                    <td>{v.nome}</td>
                    <td className="numero">{v.vendas}</td>
                    <td className="numero">{moeda(v.base)}</td>
                    <td className="numero">{moeda(v.valor)}</td>
                    <td className="numero">{moeda(v.aberto)}</td>
                    <td>
                      {v.abertas.length > 0 && (
                        <form action={pagarComissoes.bind(null, mes, v.abertas)}>
                          <button className="botao-secundario" type="submit">Marcar como pagas</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="bloco">
        <h2>Vendas do mês</h2>
        {comissoes.length > 0 ? (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr><th>Data</th>{gestor && <th>Vendedor</th>}<th>Venda</th><th className="numero">Base</th><th className="numero">Comissão</th><th>Situação</th></tr>
              </thead>
              <tbody>
                {comissoes.map((c) => (
                  <tr key={c.id}>
                    <td>{dataBR(c.criado_em)}</td>
                    {gestor && <td>{c.usuarios?.nome ?? "—"}</td>}
                    <td>
                      {c.atendimento_id ? (
                        <Link href={`/vendas/${c.atendimento_id}`}>{c.atendimentos?.clientes?.nome ?? c.atendimentos?.descricao ?? "Venda"}</Link>
                      ) : "Venda no PDV"}
                    </td>
                    <td className="numero">{moeda(c.base)}</td>
                    <td className="numero">{moeda(c.valor)}</td>
                    <td>{c.status === "paga" ? <span className="etiqueta etiqueta-ok">paga em {dataBR(c.paga_em)}</span> : <span className="etiqueta">a pagar</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">Nenhuma comissão neste mês.{regras.length === 0 && gestor ? " Cadastre uma regra abaixo para começar a calcular." : ""}</p>
        )}
      </section>

      <section className="bloco">
        <h2>Regras</h2>
        <p className="vazio">Vale a mais específica: vendedor e categoria, depois só vendedor, depois só categoria, depois a regra de todos. Mudar uma regra vale para as próximas vendas.</p>
        {regras.length > 0 ? (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Vendedor</th><th>Categoria</th><th className="numero">Percentual</th>{gestor && <th />}</tr></thead>
              <tbody>
                {regras.map((r) => (
                  <tr key={r.id}>
                    <td>{r.usuario_id ? (r.usuarios?.nome ?? "—") : "Todos"}</td>
                    <td>{r.categoria ? CATEGORIAS[r.categoria] : "Todas"}</td>
                    <td className="numero">{String(r.percentual).replace(".", ",")}%</td>
                    {gestor && (
                      <td>
                        <form action={apagarRegra.bind(null, mes, r.id)}>
                          <button className="botao-link" type="submit">Remover</button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">Nenhuma regra ainda: sem regra, a venda não gera comissão.</p>
        )}
        {gestor && (
          <form action={salvarRegra.bind(null, mes)} className="linha">
            <label className="rotulo">Vendedor
              <select className="campo" name="usuario_id" defaultValue="">
                <option value="">Todos</option>
                {(equipeR.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </label>
            <label className="rotulo">Categoria
              <select className="campo" name="categoria" defaultValue="">
                <option value="">Todas</option>
                {Object.entries(CATEGORIAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
            <label className="rotulo" style={{ flex: "0 1 120px" }}>Percentual
              <input className="campo" name="percentual" inputMode="decimal" placeholder="5" required />
            </label>
            <button className="botao" type="submit">Salvar regra</button>
          </form>
        )}
      </section>
    </>
  );
}
