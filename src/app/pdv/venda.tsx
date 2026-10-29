"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moeda } from "@/lib/formatar";
import { buscarClientes, registrarVenda, type PagamentoVenda, type ResultadoVenda } from "./actions";

export type ProdutoPdv = { id: string; nome: string; codigo: string | null; preco: number; saldo: number | null };

const FORMAS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Débito",
  credito: "Crédito",
  crediario: "Crediário",
};

type Linha = { produto: ProdutoPdv; quantidade: number };
type Pagamento = { forma: string; valor: string; parcelas: number; vencimento: string };

const numero = (t: string) => {
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const texto = (n: number) => n.toFixed(2).replace(".", ",");

/** Venda rápida: busca por nome ou leitor de código de barras (digita o código e Enter). */
export function Venda({ caixaId, produtos }: { caixaId: string; produtos: ProdutoPdv[] }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [desconto, setDesconto] = useState("");
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([{ forma: "dinheiro", valor: "", parcelas: 1, vencimento: "" }]);
  const [recebido, setRecebido] = useState("");
  const [cliente, setCliente] = useState<{ id: string; nome: string } | null>(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientes, setClientes] = useState<{ id: string; nome: string; telefone: string | null }[]>([]);
  const [resultado, setResultado] = useState<ResultadoVenda>(null);
  const [enviando, iniciar] = useTransition();
  const campoBusca = useRef<HTMLInputElement>(null);

  const sugestoes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return produtos.filter((p) => p.nome.toLowerCase().includes(q) || p.codigo?.toLowerCase() === q).slice(0, 8);
  }, [busca, produtos]);

  const subtotal = linhas.reduce((s, l) => s + l.quantidade * l.produto.preco, 0);
  const valorDesconto = Math.min(numero(desconto), subtotal);
  const total = Math.round((subtotal - valorDesconto) * 100) / 100;
  // a primeira forma fica com o que falta; as outras a pessoa digita
  const outras = pagamentos.slice(1).map((p) => numero(p.valor));
  const valores = [Math.max(0, Math.round((total - outras.reduce((s, v) => s + v, 0)) * 100) / 100), ...outras];
  const pago = Math.round(valores.reduce((s, v) => s + v, 0) * 100) / 100;
  const emDinheiro = pagamentos.reduce((s, p, i) => s + (p.forma === "dinheiro" ? valores[i] : 0), 0);
  const troco = recebido && emDinheiro > 0 ? numero(recebido) - emDinheiro : 0;

  function adicionar(p: ProdutoPdv) {
    setLinhas((ls) => {
      const i = ls.findIndex((l) => l.produto.id === p.id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, quantidade: l.quantidade + 1 } : l));
      return [...ls, { produto: p, quantidade: 1 }];
    });
    setBusca("");
    setResultado(null);
    campoBusca.current?.focus();
  }

  function aoDigitar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = busca.trim().toLowerCase();
    const exato = produtos.find((p) => p.codigo?.toLowerCase() === q);
    if (exato) adicionar(exato);
    else if (sugestoes.length === 1) adicionar(sugestoes[0]);
  }

  async function procurarCliente(q: string) {
    setBuscaCliente(q);
    setClientes(q.trim().length >= 2 ? await buscarClientes(q) : []);
  }

  function finalizar() {
    const pg: PagamentoVenda[] = pagamentos.map((p, i) => ({
      forma: p.forma,
      valor: valores[i],
      parcelas: p.forma === "credito" ? p.parcelas : 1,
      vencimento: p.forma === "crediario" ? p.vencimento || null : null,
    }));
    iniciar(async () => {
      const r = await registrarVenda(caixaId, {
        clienteId: cliente?.id ?? null,
        itens: linhas.map((l) => ({ item_id: l.produto.id, quantidade: l.quantidade })),
        desconto: valorDesconto,
        pagamentos: pg.filter((p) => p.valor > 0),
        observacao: null,
      });
      setResultado(r);
      if (r?.ok) {
        setLinhas([]);
        setDesconto("");
        setPagamentos([{ forma: "dinheiro", valor: "", parcelas: 1, vencimento: "" }]);
        setRecebido("");
        setCliente(null);
        router.refresh();
        campoBusca.current?.focus();
      }
    });
  }

  const precisaCliente = pagamentos.some((p) => p.forma === "crediario") && !cliente;
  const podeFinalizar = linhas.length > 0 && Math.abs(pago - total) < 0.005 && !precisaCliente && !enviando;

  return (
    <section className="bloco pdv-venda">
      <h2>Nova venda</h2>
      <div className="pdv-busca">
        <input
          ref={campoBusca}
          className="campo"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={aoDigitar}
          placeholder="Nome do produto ou código de barras"
          aria-label="Buscar produto"
          autoFocus
        />
        {sugestoes.length > 0 && (
          <ul className="pdv-sugestoes" role="listbox">
            {sugestoes.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => adicionar(p)}>
                  <span>{p.nome}{p.codigo ? <small> · {p.codigo}</small> : null}</span>
                  <strong>{moeda(p.preco)}</strong>
                  {p.saldo !== null && <small className={p.saldo <= 0 ? "erro-texto" : undefined}>estoque {p.saldo}</small>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {linhas.length > 0 ? (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead><tr><th>Produto</th><th className="numero">Qtd.</th><th className="numero so-largo">Preço</th><th className="numero">Total</th><th /></tr></thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.produto.id}>
                  <td>{l.produto.nome}</td>
                  <td className="numero">
                    <input
                      className="campo pdv-qtd"
                      type="number"
                      min={1}
                      value={l.quantidade}
                      onChange={(e) => {
                        const q = Math.max(1, Math.floor(Number(e.target.value) || 1));
                        setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, quantidade: q } : x)));
                      }}
                      aria-label={`Quantidade de ${l.produto.nome}`}
                    />
                  </td>
                  <td className="numero so-largo">{moeda(l.produto.preco)}</td>
                  <td className="numero">{moeda(l.quantidade * l.produto.preco)}</td>
                  <td><button type="button" className="botao-link" onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}>Tirar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="vazio">Leia o código de barras ou busque o produto pelo nome.</p>
      )}

      <div className="linha">
        <label className="rotulo" style={{ flex: "2 1 220px" }}>Cliente (opcional; obrigatório no crediário)
          {cliente ? (
            <span className="pdv-cliente">{cliente.nome} <button type="button" className="botao-link" onClick={() => setCliente(null)}>trocar</button></span>
          ) : (
            <span className="pdv-busca">
              <input className="campo" value={buscaCliente} onChange={(e) => procurarCliente(e.target.value)} placeholder="Nome, telefone ou CPF" />
              {clientes.length > 0 && (
                <ul className="pdv-sugestoes">
                  {clientes.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => { setCliente(c); setClientes([]); setBuscaCliente(""); }}>
                        <span>{c.nome}</span><small>{c.telefone ?? ""}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </span>
          )}
        </label>
        <label className="rotulo" style={{ flex: "0 1 140px" }}>Desconto (R$)
          <input className="campo" inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" />
        </label>
      </div>

      <div className="pdv-total">
        <span>Subtotal {moeda(subtotal)}{valorDesconto > 0 && ` · desconto ${moeda(valorDesconto)}`}</span>
        <strong>{moeda(total)}</strong>
      </div>

      <fieldset className="sem-borda">
        <legend className="rotulo">Pagamento</legend>
        {pagamentos.map((p, i) => (
          <div key={i} className="linha">
            <select
              className="campo"
              value={p.forma}
              onChange={(e) => setPagamentos((ps) => ps.map((x, j) => (j === i ? { ...x, forma: e.target.value } : x)))}
              aria-label="Forma de pagamento"
            >
              {Object.entries(FORMAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
            {i > 0 ? (
              <input
                className="campo"
                inputMode="decimal"
                value={p.valor}
                onChange={(e) => setPagamentos((ps) => ps.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
                placeholder="Valor"
                aria-label="Valor"
              />
            ) : (
              <span className="pdv-valor">{moeda(valores[0])}</span>
            )}
            {p.forma === "credito" && (
              <select
                className="campo"
                value={p.parcelas}
                onChange={(e) => setPagamentos((ps) => ps.map((x, j) => (j === i ? { ...x, parcelas: Number(e.target.value) } : x)))}
                aria-label="Parcelas"
              >
                {Array.from({ length: 12 }, (_, n) => <option key={n + 1} value={n + 1}>{n + 1}x</option>)}
              </select>
            )}
            {p.forma === "crediario" && (
              <input
                className="campo"
                type="date"
                value={p.vencimento}
                onChange={(e) => setPagamentos((ps) => ps.map((x, j) => (j === i ? { ...x, vencimento: e.target.value } : x)))}
                aria-label="Vencimento (vazio = 30 dias)"
                title="Vencimento (vazio = 30 dias)"
              />
            )}
            {i > 0 && (
              <button type="button" className="botao-link" onClick={() => setPagamentos((ps) => ps.filter((_, j) => j !== i))}>Tirar</button>
            )}
          </div>
        ))}
        <div className="linha">
          <button
            type="button"
            className="botao-secundario"
            onClick={() => setPagamentos((ps) => [...ps, { forma: "pix", valor: "", parcelas: 1, vencimento: "" }])}
          >
            + Dividir em outra forma
          </button>
          {emDinheiro > 0 && (
            <label className="rotulo" style={{ flex: "0 1 160px" }}>Recebido em dinheiro
              <input className="campo" inputMode="decimal" value={recebido} onChange={(e) => setRecebido(e.target.value)} placeholder={texto(emDinheiro)} />
            </label>
          )}
          {troco > 0 && <strong className="pdv-troco">Troco {moeda(troco)}</strong>}
        </div>
        {Math.abs(pago - total) >= 0.005 && <p className="erro">As outras formas passam do total ({moeda(pago)} de {moeda(total)}).</p>}
        {precisaCliente && <p className="erro">Escolha o cliente para vender no crediário.</p>}
      </fieldset>

      {resultado && (
        <p className={resultado.ok ? "ok" : "erro"} role="status">
          {resultado.mensagem}
          {resultado.vendaId && <> <a href={`/cupom/${resultado.vendaId}?imprimir=1`} target="_blank" rel="noopener">Imprimir cupom</a></>}
        </p>
      )}
      <div className="janela-botoes">
        <button type="button" className="botao-secundario" onClick={() => { setLinhas([]); setResultado(null); }} disabled={linhas.length === 0 || enviando}>Limpar</button>
        <button type="button" className="botao pdv-finalizar" onClick={finalizar} disabled={!podeFinalizar}>
          {enviando ? "Registrando…" : `Finalizar venda · ${moeda(total)}`}
        </button>
      </div>
    </section>
  );
}
