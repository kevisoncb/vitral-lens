import { criarClienteServidor } from "@/lib/supabase/servidor";
import { moeda } from "@/lib/formatar";

const FUSO = "-03:00";

type Atend = {
  valor_total: number;
  origem: string;
  responsavel_id: string | null;
  funil_etapas: { tipo: "aberta" | "ganha" | "perdida" } | null;
  motivos_perda: { nome: string } | null;
};

function mesAtual(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7);
}
function proximoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

export default async function Relatorios({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? (mesParam as string) : mesAtual();
  const de = `${mes}-01T00:00:00${FUSO}`;
  const ate = `${proximoMes(mes)}-01T00:00:00${FUSO}`;
  const supabase = await criarClienteServidor();

  // relatórios dependem do perfil: quem decide é o banco
  const { data: liberado } = await supabase.rpc("acesso", { modulo: "relatorios", acao: "ver" });
  if (!liberado) {
    return (
      <>
        <h1>Relatórios</h1>
        <p className="subtitulo">Seu perfil não tem acesso aos relatórios. Fale com o responsável pela ótica.</p>
      </>
    );
  }

  const [atendR, pagR, osR, equipeR, consultasR] = await Promise.all([
    supabase.from("atendimentos")
      .select("valor_total, origem, responsavel_id, funil_etapas(tipo), motivos_perda(nome)")
      .gte("criado_em", de).lt("criado_em", ate).returns<Atend[]>(),
    supabase.from("pagamentos").select("valor, forma").gte("pago_em", de).lt("pago_em", ate),
    supabase.from("ordens_servico").select("criado_em, data_entrega, data_prometida, retrabalho").gte("criado_em", de).lt("criado_em", ate),
    supabase.from("usuarios").select("id, nome"),
    supabase.from("consultas").select("status, origem").gte("inicio", de).lt("inicio", ate),
  ]);

  const atend = atendR.data ?? [];
  const ganhos = atend.filter((a) => a.funil_etapas?.tipo === "ganha");
  const perdidos = atend.filter((a) => a.funil_etapas?.tipo === "perdida");
  const fechados = ganhos.length + perdidos.length;
  const conversao = fechados ? Math.round((ganhos.length / fechados) * 100) : 0;
  const recebido = (pagR.data ?? []).reduce((s, p) => s + Number(p.valor), 0);
  const ticket = ganhos.length ? ganhos.reduce((s, a) => s + Number(a.valor_total), 0) / ganhos.length : 0;
  const emAberto = atend.filter((a) => a.funil_etapas?.tipo === "aberta").reduce((s, a) => s + Number(a.valor_total), 0);

  const contar = <T,>(lista: T[], chave: (x: T) => string) =>
    Object.entries(lista.reduce<Record<string, number>>((acc, x) => ((acc[chave(x)] = (acc[chave(x)] ?? 0) + 1), acc), {}))
      .sort((a, b) => b[1] - a[1]);

  const motivos = contar(perdidos, (a) => a.motivos_perda?.nome ?? "Sem motivo");
  const nomes = new Map((equipeR.data ?? []).map((u) => [u.id, u.nome]));
  const porVendedor = Object.entries(
    ganhos.reduce<Record<string, { qtd: number; valor: number }>>((acc, a) => {
      const k = nomes.get(a.responsavel_id ?? "") ?? "Sem responsável";
      acc[k] = { qtd: (acc[k]?.qtd ?? 0) + 1, valor: (acc[k]?.valor ?? 0) + Number(a.valor_total) };
      return acc;
    }, {}),
  ).sort((a, b) => b[1].valor - a[1].valor);
  const formas = Object.entries(
    (pagR.data ?? []).reduce<Record<string, number>>((acc, p) => ((acc[p.forma] = (acc[p.forma] ?? 0) + Number(p.valor)), acc), {}),
  ).sort((a, b) => b[1] - a[1]);

  const os = osR.data ?? [];
  const entregues = os.filter((o) => o.data_entrega);
  const noPrazo = entregues.filter((o) => !o.data_prometida || o.data_entrega! <= o.data_prometida).length;
  const consultas = consultasR.data ?? [];
  const faltas = consultas.filter((c) => c.status === "faltou").length;

  const cartoes = [
    { r: "Atendimentos", v: String(atend.length), n: `${atend.filter((a) => a.origem === "site").length} pelo site` },
    { r: "Conversão", v: `${conversao}%`, n: `${ganhos.length} ganhos de ${fechados} fechados` },
    { r: "Recebido no mês", v: moeda(recebido), n: `ticket médio ${moeda(ticket)}` },
    { r: "Em negociação", v: moeda(emAberto), n: "orçamentos ainda abertos" },
    { r: "OS entregues no prazo", v: entregues.length ? `${Math.round((noPrazo / entregues.length) * 100)}%` : "—", n: `${entregues.length} entregues, ${os.filter((o) => o.retrabalho).length} retrabalhos` },
    { r: "Consultas", v: String(consultas.length), n: `${faltas} faltas, ${consultas.filter((c) => c.origem === "site").length} pelo site` },
  ];

  const maiorMotivo = motivos[0]?.[1] ?? 1;

  return (
    <>
      <div className="topo">
        <div>
          <h1>Relatórios</h1>
          <p className="subtitulo">Atendimentos criados no mês escolhido.</p>
        </div>
        <form method="get" className="topo-acoes">
          <input className="campo" type="month" name="mes" defaultValue={mes} aria-label="Mês" />
          <button className="botao-secundario" type="submit">Ver</button>
        </form>
      </div>

      <section className="resumo">
        {cartoes.map((c) => (
          <div key={c.r} className="resumo-cartao">
            <span>{c.r}</span>
            <strong>{c.v}</strong>
            <small>{c.n}</small>
          </div>
        ))}
      </section>

      <div className="duas-colunas">
        <section className="bloco">
          <h2>Por que não fecharam</h2>
          {motivos.length === 0 && <p className="vazio">Nenhuma perda no mês.</p>}
          {motivos.map(([nome, qtd]) => (
            <div key={nome} className="barra">
              <div className="linha-valor"><span>{nome}</span><strong>{qtd}</strong></div>
              <div className="barra-fundo"><div style={{ width: `${(qtd / maiorMotivo) * 100}%` }} /></div>
            </div>
          ))}
        </section>
        <section className="bloco">
          <h2>Vendas por vendedor</h2>
          {porVendedor.length === 0 && <p className="vazio">Nenhuma venda no mês.</p>}
          {porVendedor.map(([nome, v]) => (
            <div key={nome} className="linha-valor"><span>{nome} · {v.qtd}</span><strong>{moeda(v.valor)}</strong></div>
          ))}
          <h2>Recebido por forma</h2>
          {formas.map(([forma, valor]) => (
            <div key={forma} className="linha-valor"><span style={{ textTransform: "capitalize" }}>{forma}</span><strong>{moeda(valor)}</strong></div>
          ))}
        </section>
      </div>
    </>
  );
}
