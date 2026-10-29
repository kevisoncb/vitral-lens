"use client";

import { useState } from "react";
import {
  MODELOS,
  decodificar,
  lerClientes,
  lerCsv,
  lerProdutos,
  type Leitura,
  type LinhaCliente,
  type LinhaProduto,
  type TipoImportacao,
} from "@/lib/planilha";
import { importarLote, type ResultadoImportacao } from "./actions";

const LOTE = 1000;

const CATEGORIAS: Record<string, string> = {
  lente: "Lentes",
  tratamento: "Tratamentos",
  armacao: "Armações",
  lente_contato: "Lentes de contato",
  acessorio: "Acessórios",
  servico: "Serviços",
};

const CAMPOS: Record<TipoImportacao, Record<string, string>> = {
  clientes: { nome: "Nome", telefone: "Telefone", email: "E-mail", cpf: "CPF", nascimento: "Nascimento", endereco: "Endereço" },
  produtos: { categoria: "Categoria", nome: "Nome", preco: "Preço", marca: "Marca", codigo: "Código" },
};

type Linha = LinhaCliente | LinhaProduto;

export function Importador({ tipos }: { tipos: TipoImportacao[] }) {
  const [tipo, setTipo] = useState<TipoImportacao>(tipos[0]);
  const [categoriaPadrao, setCategoriaPadrao] = useState("");
  const [matriz, setMatriz] = useState<string[][] | null>(null);
  const [arquivo, setArquivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);

  const leitura: Leitura<Linha> | null = matriz
    ? tipo === "clientes"
      ? lerClientes(matriz)
      : lerProdutos(matriz, categoriaPadrao || null)
    : null;

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setResultado(null);
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) {
      setMatriz(null);
      setArquivo("");
      setResultado({ ok: false, mensagem: 'Salve a planilha como CSV antes: no Excel, "Salvar como" → "CSV (separado por vírgulas)"; no Google Planilhas, "Arquivo" → "Fazer download" → "CSV".', inseridos: 0, repetidos: 0, erros: [] });
      return;
    }
    setArquivo(f.name);
    setMatriz(lerCsv(decodificar(await f.arrayBuffer())));
  }

  function baixarModelo() {
    // BOM para o Excel abrir os acentos certos
    const blob = new Blob(["﻿" + MODELOS[tipo]], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `modelo-${tipo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importar() {
    if (!leitura) return;
    setEnviando(true);
    setProgresso(0);
    const total: ResultadoImportacao = { ok: true, inseridos: 0, repetidos: 0, erros: [] };
    for (let i = 0; i < leitura.linhas.length; i += LOTE) {
      const pedaco = leitura.linhas.slice(i, i + LOTE);
      const r = await importarLote(tipo, pedaco as LinhaCliente[] | LinhaProduto[]);
      if (!r.ok) {
        total.ok = false;
        total.mensagem = r.mensagem;
        break;
      }
      total.inseridos += r.inseridos;
      total.repetidos += r.repetidos;
      // linha da planilha = posição no lote + linhas anteriores + 1 (a linha dos títulos)
      total.erros.push(...r.erros.map((e) => ({ linha: e.linha + i + 1, motivo: e.motivo })));
      setProgresso(Math.min(leitura.linhas.length, i + LOTE));
    }
    setResultado(total);
    setEnviando(false);
    if (total.ok) setMatriz(null);
  }

  const campos = CAMPOS[tipo];
  const podeImportar = leitura && leitura.avisos.length === 0 && leitura.linhas.length > 0 && !enviando;

  return (
    <div className="formulario-largo">
      <section className="bloco">
        <h2>1. O que vai importar</h2>
        <div className="linha">
          <label className="rotulo">Tipo
            <select className="campo" value={tipo} onChange={(e) => { setTipo(e.target.value as TipoImportacao); setResultado(null); }}>
              {tipos.includes("clientes") && <option value="clientes">Clientes</option>}
              {tipos.includes("produtos") && <option value="produtos">Produtos do catálogo</option>}
            </select>
          </label>
          {tipo === "produtos" && (
            <label className="rotulo">Categoria (se a planilha não tiver)
              <select className="campo" value={categoriaPadrao} onChange={(e) => setCategoriaPadrao(e.target.value)}>
                <option value="">Vem da planilha</option>
                {Object.entries(CATEGORIAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
          )}
        </div>
        <p className="vazio">
          A primeira linha da planilha precisa ter os títulos das colunas ({Object.values(campos).join(", ")}). A ordem não importa e colunas a mais são ignoradas.{" "}
          <button type="button" className="botao-link" onClick={baixarModelo}>Baixar planilha modelo</button>
        </p>
      </section>

      <section className="bloco">
        <h2>2. Escolha o arquivo (CSV)</h2>
        <input className="campo" type="file" accept=".csv,text/csv,.txt,.xlsx,.xls" onChange={aoEscolher} aria-label="Arquivo da planilha" />
        <small className="vazio">
          {tipo === "clientes"
            ? "Clientes com o mesmo telefone ou CPF de alguém já cadastrado são pulados."
            : "Produtos com o mesmo código, ou o mesmo nome na mesma categoria, são pulados."}
        </small>
      </section>

      {leitura && (
        <section className="bloco">
          <h2>3. Confira e importe</h2>
          <p>
            <strong>{arquivo}</strong>: {leitura.linhas.length} {leitura.linhas.length === 1 ? "linha" : "linhas"}.{" "}
            Colunas reconhecidas: {Object.keys(leitura.colunas).length ? Object.entries(leitura.colunas).map(([c, t]) => `${campos[c]} ← "${t.trim()}"`).join(" · ") : "nenhuma"}.
          </p>
          {leitura.avisos.map((a) => <p key={a} className="erro" role="alert">{a}</p>)}
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr><th>Linha</th>{Object.values(campos).map((r) => <th key={r}>{r}</th>)}</tr>
              </thead>
              <tbody>
                {leitura.linhas.slice(0, 8).map((l, i) => (
                  <tr key={i}>
                    <td>{i + 2}</td>
                    {Object.keys(campos).map((c) => {
                      const v = (l as Record<string, unknown>)[c];
                      const exibir = c === "categoria" ? (CATEGORIAS[String(v)] ?? `${v} (?)`) : v;
                      return <td key={c}>{exibir === null || exibir === "" ? "—" : String(exibir)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {leitura.linhas.length > 8 && <small className="vazio">Mostrando as 8 primeiras.</small>}
          <div className="janela-botoes">
            <button className="botao" type="button" onClick={importar} disabled={!podeImportar}>
              {enviando ? `Importando… ${progresso} de ${leitura.linhas.length}` : `Importar ${leitura.linhas.length} ${tipo === "clientes" ? "clientes" : "produtos"}`}
            </button>
          </div>
        </section>
      )}

      {resultado && (
        <section className="bloco" role="status">
          {resultado.ok ? (
            <p className="ok">
              {resultado.inseridos} {resultado.inseridos === 1 ? "cadastro novo" : "cadastros novos"}
              {resultado.repetidos > 0 && ` · ${resultado.repetidos} já existiam e foram pulados`}
              {resultado.erros.length > 0 && ` · ${resultado.erros.length} com problema`}.
            </p>
          ) : (
            <p className="erro">{resultado.mensagem}{resultado.inseridos > 0 && ` (${resultado.inseridos} já tinham entrado)`}</p>
          )}
          {resultado.erros.length > 0 && (
            <ul className="lista-erros">
              {resultado.erros.slice(0, 50).map((e) => <li key={e.linha}>Linha {e.linha}: {e.motivo}</li>)}
              {resultado.erros.length > 50 && <li>… e mais {resultado.erros.length - 50}.</li>}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
