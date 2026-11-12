"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { codigoValido, svgCode128 } from "@/lib/codigo-barras";
import { moeda } from "@/lib/formatar";
import { gerarCodigos } from "./actions";

export type ProdutoEtiqueta = {
  id: string;
  nome: string;
  marca: string | null;
  codigo: string | null;
  preco: number;
  saldo: number | null; // null = não controla estoque
};

type Formato = "rolo" | "a4";

const FORMATOS: Record<Formato, string> = {
  rolo: "Impressora de etiquetas (50 × 25 mm)",
  a4: "Folha A4 de etiquetas adesivas (3 × 10, tipo Pimaco 6180)",
};

export function Etiquetas({ produtos, otica, podeGerar }: { produtos: ProdutoEtiqueta[]; otica: string; podeGerar: boolean }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [quantidade, setQuantidade] = useState<Record<string, number>>({});
  const [formato, setFormato] = useState<Formato>("rolo");
  const [mostrarPreco, setMostrarPreco] = useState(true);
  const [mensagem, setMensagem] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [gerando, iniciar] = useTransition();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? produtos.filter((p) => `${p.nome} ${p.marca ?? ""} ${p.codigo ?? ""}`.toLowerCase().includes(q)) : produtos;
  }, [busca, produtos]);

  const escolhidos = produtos.filter((p) => (quantidade[p.id] ?? 0) > 0);
  const semCodigo = escolhidos.filter((p) => !p.codigo);
  const etiquetas = escolhidos.filter((p) => p.codigo && codigoValido(p.codigo)).flatMap((p) => Array.from({ length: quantidade[p.id] }, () => p));
  const total = escolhidos.reduce((s, p) => s + (quantidade[p.id] ?? 0), 0);

  function marcar(p: ProdutoEtiqueta, q: number) {
    setQuantidade((atual) => ({ ...atual, [p.id]: Math.max(0, Math.min(500, Math.floor(q) || 0)) }));
  }

  function todosPeloEstoque() {
    setQuantidade(Object.fromEntries(filtrados.map((p) => [p.id, Math.max(0, p.saldo ?? 1)])));
  }

  function gerar() {
    iniciar(async () => {
      const r = await gerarCodigos(semCodigo.map((p) => p.id));
      setMensagem(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <>
      <section className="bloco nao-imprimir">
        <div className="linha">
          <label className="rotulo" style={{ flex: "3 1 240px" }}>Buscar
            <input className="campo" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, marca ou código" />
          </label>
          <label className="rotulo">Formato
            <select className="campo" value={formato} onChange={(e) => setFormato(e.target.value as Formato)}>
              {Object.entries(FORMATOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </label>
          <label className="marcar"><input type="checkbox" checked={mostrarPreco} onChange={(e) => setMostrarPreco(e.target.checked)} /> Mostrar o preço</label>
        </div>
        <div className="linha">
          <button type="button" className="botao-secundario" onClick={todosPeloEstoque}>Uma por peça em estoque</button>
          <button type="button" className="botao-secundario" onClick={() => setQuantidade({})}>Limpar</button>
          <button type="button" className="botao" onClick={() => window.print()} disabled={etiquetas.length === 0}>
            Imprimir {etiquetas.length} {etiquetas.length === 1 ? "etiqueta" : "etiquetas"}
          </button>
        </div>
        {semCodigo.length > 0 && (
          <p className="aviso">
            {semCodigo.length} {semCodigo.length === 1 ? "produto escolhido não tem código" : "produtos escolhidos não têm código"} e não sai na impressão.{" "}
            {podeGerar ? (
              <button type="button" className="botao-link" onClick={gerar} disabled={gerando}>{gerando ? "Gerando…" : "Gerar código interno"}</button>
            ) : "Peça a quem edita o catálogo para gerar os códigos."}
          </p>
        )}
        {mensagem && <p className={mensagem.ok ? "ok" : "erro"} role="status">{mensagem.mensagem}</p>}

        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr><th>Produto</th><th>Código</th><th className="numero">Estoque</th><th className="numero">Preço</th><th className="numero">Etiquetas</th></tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}{p.marca && <small className="vazio"> · {p.marca}</small>}</td>
                  <td>{p.codigo ? (codigoValido(p.codigo) ? p.codigo : <span className="etiqueta etiqueta-erro">{p.codigo} (acento)</span>) : <span className="vazio">sem código</span>}</td>
                  <td className="numero">{p.saldo ?? "—"}</td>
                  <td className="numero">{moeda(p.preco)}</td>
                  <td className="numero">
                    <input className="campo pdv-qtd" type="number" min={0} max={500} value={quantidade[p.id] ?? 0} onChange={(e) => marcar(p, Number(e.target.value))} aria-label={`Etiquetas de ${p.nome}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtrados.length === 0 && <p className="vazio">Nenhum produto encontrado.</p>}
        {total > 0 && <small className="vazio">Prévia abaixo; na impressão só as etiquetas saem.</small>}
      </section>

      {etiquetas.length > 0 && (
        <section className={`etiquetas-folha etiquetas-${formato}`} aria-label="Etiquetas para imprimir">
          {etiquetas.map((p, i) => (
            <div key={`${p.id}-${i}`} className="etiqueta-produto">
              <small>{otica}</small>
              <strong>{p.nome}</strong>
              {mostrarPreco && <span className="etiqueta-preco">{moeda(p.preco)}</span>}
              <span className="etiqueta-barras" dangerouslySetInnerHTML={{ __html: svgCode128(p.codigo as string) }} />
              <small className="etiqueta-codigo">{p.codigo}</small>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
