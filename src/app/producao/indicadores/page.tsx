import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigirArea } from "@/lib/sessao";
import { NOME_ETAPA_PRODUCAO } from "@/lib/os";

/** Para o gerente de laboratório: prazo, retrabalho e produção por pessoa. Sem valores. */
export default async function IndicadoresLab({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const sessao = await exigirArea("laboratorio");
  if (sessao.area !== "gestao" && !sessao.pode("laboratorio", "excluir")) redirect("/producao");
  const { dias: d } = await searchParams;
  const dias = [7, 30, 90].includes(Number(d)) ? Number(d) : 30;
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const supabase = await criarClienteServidor();

  const [osR, prodR] = await Promise.all([
    supabase.from("ordens_servico").select("id, criado_em, puxada_em, data_prometida, data_entrega, retrabalho, etapa_desde, os_etapas(nome, area, final)")
      .gte("criado_em", desde)
      .returns<{ id: string; criado_em: string; puxada_em: string | null; data_prometida: string | null; data_entrega: string | null; retrabalho: boolean; etapa_desde: string; os_etapas: { nome: string; area: string; final: boolean } | null }[]>(),
    supabase.from("os_producao").select("etapa, aprovado, usuarios(nome)").gte("feito_em", desde)
      .returns<{ etapa: string; aprovado: boolean; usuarios: { nome: string } | null }[]>(),
  ]);
  const os = osR.data ?? [];
  const prod = prodR.data ?? [];

  const noLab = os.filter((o) => o.os_etapas?.area === "laboratorio" && o.os_etapas.nome !== "Chegou na loja");
  const atrasadas = noLab.filter((o) => o.data_prometida && o.data_prometida < new Date().toISOString().slice(0, 10));
  const entregues = os.filter((o) => o.data_entrega);
  const noPrazo = entregues.filter((o) => !o.data_prometida || o.data_entrega! <= o.data_prometida).length;
  const esperas = os.filter((o) => o.puxada_em).map((o) => (Date.parse(o.puxada_em!) - Date.parse(o.criado_em)) / 3_600_000);
  const esperaMedia = esperas.length ? esperas.reduce((a, b) => a + b, 0) / esperas.length : 0;

  const porPessoa = Object.entries(
    prod.reduce<Record<string, { feitas: number; reprovadas: number }>>((acc, p) => {
      const k = p.usuarios?.nome ?? "?";
      acc[k] ??= { feitas: 0, reprovadas: 0 };
      acc[k].feitas += 1;
      if (!p.aprovado) acc[k].reprovadas += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1].feitas - a[1].feitas);
  const porEtapa = Object.entries(prod.reduce<Record<string, number>>((acc, p) => ((acc[p.etapa] = (acc[p.etapa] ?? 0) + 1), acc), {}));

  const cartoes = [
    { r: "OS no período", v: String(os.length), n: `${noLab.length} em produção agora` },
    { r: "Atrasadas", v: String(atrasadas.length), n: "em produção com prazo vencido" },
    { r: "Entregues no prazo", v: entregues.length ? `${Math.round((noPrazo / entregues.length) * 100)}%` : "—", n: `${entregues.length} entregues` },
    { r: "Retrabalho", v: os.length ? `${Math.round((os.filter((o) => o.retrabalho).length / os.length) * 100)}%` : "—", n: `${os.filter((o) => o.retrabalho).length} OS` },
    { r: "Espera até puxar", v: `${esperaMedia.toFixed(1)} h`, n: "do pagamento até o lab pegar" },
  ];

  return (
    <>
      <div className="topo">
        <div>
          <h1>Indicadores do laboratório</h1>
          <p className="subtitulo">Últimos {dias} dias.</p>
        </div>
        <div className="topo-acoes">
          {[7, 30, 90].map((n) => (
            <a key={n} className={n === dias ? "botao" : "botao-secundario"} href={`/producao/indicadores?dias=${n}`}>{n} dias</a>
          ))}
        </div>
      </div>
      <section className="resumo">
        {cartoes.map((c) => (
          <div key={c.r} className="resumo-cartao"><span>{c.r}</span><strong>{c.v}</strong><small>{c.n}</small></div>
        ))}
      </section>
      <div className="duas-colunas">
        <section className="bloco">
          <h2>Produção por pessoa</h2>
          {porPessoa.length === 0 && <p className="vazio">Nada registrado no período.</p>}
          {porPessoa.map(([nome, v]) => (
            <div key={nome} className="linha-valor"><span>{nome}</span><strong>{v.feitas} etapas{v.reprovadas ? ` · ${v.reprovadas} reprovadas` : ""}</strong></div>
          ))}
        </section>
        <section className="bloco">
          <h2>Etapas registradas</h2>
          {porEtapa.map(([etapa, n]) => (
            <div key={etapa} className="linha-valor"><span>{NOME_ETAPA_PRODUCAO[etapa] ?? etapa}</span><strong>{n}</strong></div>
          ))}
        </section>
      </div>
    </>
  );
}
