import { grau } from "@/lib/formatar";

export type FichaOS = {
  lente: string | null;
  tratamentos: string | null;
  armacao: string | null;
  armacao_tipo: string | null;
  aro: number | null;
  ponte: number | null;
  diagonal_maior: number | null;
  dnp_od: number | null;
  dnp_oe: number | null;
  altura_od: number | null;
  altura_oe: number | null;
  obs_tecnica: string | null;
};

export type OlhoReceita = {
  olho: "OD" | "OE";
  distancia: string;
  esferico: number | null;
  cilindrico: number | null;
  eixo: number | null;
  adicao: number | null;
};

export const TIPO_ARMACAO: Record<string, string> = {
  aro_fechado: "Aro fechado",
  fio_nylon: "Fio de nylon",
  parafusada: "Parafusada",
  outro: "Outro",
};

const v = (n: number | null | undefined, sufixo = "") => (n === null || n === undefined ? "—" : `${n}${sufixo}`);

/** Ficha técnica para leitura (loja). O laboratório edita em /producao/os/[id]. */
export function FichaTecnica({ ficha, olhos }: { ficha: FichaOS; olhos: OlhoReceita[] }) {
  return (
    <section className="bloco">
      <h2>Ficha técnica</h2>
      <div className="ficha-grade">
        <span><small>Lente</small>{ficha.lente ?? "—"}</span>
        <span><small>Tratamentos</small>{ficha.tratamentos ?? "—"}</span>
        <span><small>Armação</small>{ficha.armacao ?? "—"}{ficha.armacao_tipo ? ` · ${TIPO_ARMACAO[ficha.armacao_tipo]}` : ""}</span>
        <span><small>Aro / ponte / diagonal</small>{v(ficha.aro)} / {v(ficha.ponte)} / {v(ficha.diagonal_maior)}</span>
        <span><small>DNP OD / OE</small>{v(ficha.dnp_od)} / {v(ficha.dnp_oe)}</span>
        <span><small>Altura OD / OE</small>{v(ficha.altura_od)} / {v(ficha.altura_oe)}</span>
      </div>
      <TabelaGrau olhos={olhos} />
      {ficha.obs_tecnica && <p className="anotacao">{ficha.obs_tecnica}</p>}
    </section>
  );
}

export function TabelaGrau({ olhos }: { olhos: OlhoReceita[] }) {
  if (olhos.length === 0) return <p className="vazio">OS sem receita ligada.</p>;
  return (
    <div className="tabela-receita tabela-grau" role="table" aria-label="Grau da receita">
      {["", "Esf.", "Cil.", "Eixo", "Adição"].map((t) => <span key={t} className="th">{t}</span>)}
      {[...olhos].sort((a, b) => (a.olho === "OD" ? -1 : 1) - (b.olho === "OD" ? -1 : 1)).map((o) => (
        <div key={o.olho + o.distancia} style={{ display: "contents" }}>
          <span className="td"><strong>{o.olho}</strong>{o.distancia === "perto" ? " perto" : ""}</span>
          <span className="td">{grau(o.esferico)}</span>
          <span className="td">{grau(o.cilindrico)}</span>
          <span className="td">{o.eixo ?? "—"}°</span>
          <span className="td">{grau(o.adicao)}</span>
        </div>
      ))}
    </div>
  );
}
