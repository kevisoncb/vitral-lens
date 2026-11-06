import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { criarClientePublico } from "@/lib/supabase/publico";
import { dataBR, dataHoraBR, grau, moeda } from "@/lib/formatar";
import { QuadroAssinatura } from "./quadro-assinatura";

export const metadata: Metadata = { title: "Conferir e assinar a OS", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Olho = { olho: string; distancia: string; esferico: number | null; cilindrico: number | null; eixo: number | null; adicao: number | null };
type Resumo = {
  otica: string;
  os_numero: number | null;
  cliente: string | null;
  descricao: string | null;
  lente: string | null;
  tratamentos: string | null;
  armacao: string | null;
  data_prometida: string | null;
  receita: { data: string; medico: string | null; olhos: Olho[] } | null;
  itens: { descricao: string; quantidade: number; preco: number }[];
  total: number | null;
  pago: number;
};
type Dados = { resumo: Resumo; situacao: "pendente" | "assinada" | "expirada"; assinada_em: string | null; nome_assinante: string | null; expira_em: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Página que o cliente abre pelo link do WhatsApp: confere a OS e assina com o dedo. Sem login. */
export default async function AssinarOS({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  const { data } = await criarClientePublico().rpc("os_para_assinar", { p_token: token });
  if (!data) notFound();
  const { resumo: r, situacao, assinada_em, nome_assinante, expira_em } = data as unknown as Dados;
  const total = Number(r.total ?? 0);
  const falta = Math.max(0, total - Number(r.pago ?? 0));

  return (
    <main className="assinar">
      <header>
        <strong>{r.otica}</strong>
        <h1>Ordem de serviço{r.os_numero ? ` nº ${r.os_numero}` : ""}</h1>
        <p className="subtitulo">{r.cliente}</p>
      </header>

      <section className="bloco">
        <h2>Seus óculos</h2>
        {r.descricao && <p>{r.descricao}</p>}
        <dl className="assinar-dados">
          {r.lente && (<><dt>Lente</dt><dd>{r.lente}</dd></>)}
          {r.tratamentos && (<><dt>Tratamentos</dt><dd>{r.tratamentos}</dd></>)}
          {r.armacao && (<><dt>Armação</dt><dd>{r.armacao}</dd></>)}
          {r.data_prometida && (<><dt>Prazo de entrega</dt><dd>{dataBR(r.data_prometida)}</dd></>)}
        </dl>
      </section>

      {r.receita && r.receita.olhos.length > 0 && (
        <section className="bloco">
          <h2>Receita</h2>
          <small className="vazio">{dataBR(r.receita.data)}{r.receita.medico ? ` · ${r.receita.medico}` : ""}</small>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Olho</th><th className="numero">Esférico</th><th className="numero">Cilíndrico</th><th className="numero">Eixo</th><th className="numero">Adição</th></tr></thead>
              <tbody>
                {r.receita.olhos.map((o, i) => (
                  <tr key={i}>
                    <td>{o.olho === "OD" ? "Direito" : "Esquerdo"}{o.distancia === "perto" ? " (perto)" : ""}</td>
                    <td className="numero">{grau(o.esferico)}</td>
                    <td className="numero">{grau(o.cilindrico)}</td>
                    <td className="numero">{o.eixo ?? "—"}{o.eixo !== null ? "°" : ""}</td>
                    <td className="numero">{grau(o.adicao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {r.itens.length > 0 && (
        <section className="bloco">
          <h2>Valores</h2>
          {r.itens.map((i, n) => (
            <div key={n} className="linha-valor"><span>{i.quantidade > 1 ? `${i.quantidade} × ` : ""}{i.descricao}</span><span>{moeda(i.preco * i.quantidade)}</span></div>
          ))}
          <div className="linha-valor"><strong>Total</strong><strong>{moeda(total)}</strong></div>
          <div className="linha-valor"><span>Já pago</span><span>{moeda(r.pago)}</span></div>
          {falta > 0 && <div className="linha-valor"><span>Falta pagar na entrega</span><strong>{moeda(falta)}</strong></div>}
        </section>
      )}

      <section className="bloco">
        {situacao === "assinada" ? (
          <p className="ok" role="status">Assinado por {nome_assinante} em {assinada_em ? dataHoraBR(assinada_em) : ""}. Obrigado!</p>
        ) : situacao === "expirada" ? (
          <p className="erro" role="alert">Este link venceu. Peça um novo à {r.otica}.</p>
        ) : (
          <>
            <h2>Conferiu? Assine</h2>
            <small className="vazio">Este link vale até {dataBR(expira_em)}.</small>
            <QuadroAssinatura token={token} nomeSugerido={r.cliente ?? ""} />
          </>
        )}
      </section>
    </main>
  );
}
