/**
 * Leitura de planilha (CSV) para importar clientes e produtos.
 * Tudo roda no navegador: a pessoa vê a prévia e os erros antes de mandar para o banco,
 * que confere de novo (importar_clientes / importar_produtos).
 *
 * Aceita o CSV do Excel brasileiro (separado por ";", acentos em Windows-1252) e o do
 * Google Planilhas (separado por ",", UTF-8).
 */

export type TipoImportacao = "clientes" | "produtos";

export type LinhaCliente = {
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  nascimento: string | null; // aaaa-mm-dd
  endereco: string | null;
};

export type LinhaProduto = {
  categoria: string;
  nome: string;
  preco: number | null;
  marca: string | null;
  codigo: string | null;
};

export type Leitura<T> = {
  linhas: T[];
  /** Colunas da planilha que foram reconhecidas: campo -> título original. */
  colunas: Record<string, string>;
  /** Problemas que impedem a importação (ex.: falta a coluna de nome). */
  avisos: string[];
};

/** Bytes do arquivo -> texto. Tenta UTF-8; se tiver byte inválido, é Windows-1252 (Excel). */
export function decodificar(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** CSV -> matriz de células. Respeita aspas ("a;b" é uma célula) e aspas duplas dentro delas. */
export function lerCsv(texto: string): string[][] {
  texto = texto.replace(/^\uFEFF/, "");
  const primeira = texto.split(/\r?\n/, 1)[0] ?? "";
  const contar = (c: string) => primeira.split(c).length - 1;
  const sep = contar(";") >= contar(",") && contar(";") >= contar("\t") ? ";" : contar("\t") > contar(",") ? "\t" : ",";

  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else celula += ch;
    } else if (ch === '"' && celula === "") aspas = true;
    else if (ch === sep) {
      linha.push(celula);
      celula = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      linha.push(celula);
      linhas.push(linha);
      linha = [];
      celula = "";
    } else celula += ch;
  }
  if (celula !== "" || linha.length > 0) {
    linha.push(celula);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

/** "Data de Nascimento" -> "data de nascimento" (sem acento, minúsculo, espaço único). */
export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NOMES_COLUNAS: Record<TipoImportacao, Record<string, string[]>> = {
  clientes: {
    nome: ["nome", "nome completo", "cliente", "nome do cliente", "paciente"],
    telefone: ["telefone", "celular", "whatsapp", "fone", "tel", "telefone celular", "contato"],
    email: ["email", "e mail"],
    cpf: ["cpf"],
    nascimento: ["nascimento", "data de nascimento", "data nascimento", "aniversario", "dt nascimento"],
    endereco: ["endereco", "endereco completo", "rua"],
  },
  produtos: {
    categoria: ["categoria", "tipo", "grupo"],
    nome: ["nome", "produto", "descricao", "nome do produto", "modelo"],
    preco: ["preco", "valor", "preco de venda", "preco venda", "valor de venda", "pv"],
    marca: ["marca", "fabricante", "grife"],
    codigo: ["codigo", "cod", "referencia", "ref", "codigo de barras", "ean", "sku"],
  },
};

/** Acha cada campo pelo título da coluna. */
function mapearColunas(tipo: TipoImportacao, titulos: string[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  const norm = titulos.map(normalizar);
  for (const [campo, nomes] of Object.entries(NOMES_COLUNAS[tipo])) {
    const i = norm.findIndex((t) => nomes.includes(t));
    if (i >= 0) mapa[campo] = i;
  }
  return mapa;
}

/** "31/12/1980", "31-12-80", "1980-12-31" -> "1980-12-31". Data inválida volta como veio (o banco recusa). */
export function dataIso(t: string): string | null {
  const s = t.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (!m) return s;
  let ano = Number(m[3]);
  if (m[3].length === 2) ano += ano > new Date().getFullYear() % 100 ? 1900 : 2000;
  return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** "R$ 1.234,56", "1234.56", "350" -> número. Vazio ou lixo -> null. */
export function precoNumero(t: string): number | null {
  let s = t.replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "Armações", "lente de contato", "Serviço" -> chave do banco. Desconhecida volta normalizada (o banco recusa). */
export function categoriaChave(t: string): string {
  const s = normalizar(t);
  if (/^armac/.test(s) || s === "oculos de sol" || s === "solar") return "armacao";
  if (/^lentes? de contato/.test(s) || s === "lc") return "lente_contato";
  if (/^lente/.test(s)) return "lente";
  if (/^tratamento/.test(s)) return "tratamento";
  if (/^acessorio/.test(s)) return "acessorio";
  if (/^servico/.test(s)) return "servico";
  return s;
}

function texto(c: string | undefined): string | null {
  const t = (c ?? "").trim();
  return t === "" ? null : t;
}

export function lerClientes(matriz: string[][]): Leitura<LinhaCliente> {
  const [titulos = [], ...dados] = matriz;
  const mapa = mapearColunas("clientes", titulos);
  const avisos = mapa.nome === undefined ? ['Não achei a coluna "Nome". A primeira linha da planilha precisa ter os títulos.'] : [];
  const pegar = (l: string[], campo: string) => (mapa[campo] === undefined ? null : texto(l[mapa[campo]]));
  return {
    colunas: Object.fromEntries(Object.entries(mapa).map(([c, i]) => [c, titulos[i]])),
    avisos,
    linhas: dados.map((l) => ({
      nome: pegar(l, "nome") ?? "",
      telefone: pegar(l, "telefone"),
      email: pegar(l, "email"),
      cpf: pegar(l, "cpf"),
      nascimento: dataIso(pegar(l, "nascimento") ?? ""),
      endereco: pegar(l, "endereco"),
    })),
  };
}

export function lerProdutos(matriz: string[][], categoriaPadrao: string | null): Leitura<LinhaProduto> {
  const [titulos = [], ...dados] = matriz;
  const mapa = mapearColunas("produtos", titulos);
  const avisos: string[] = [];
  if (mapa.nome === undefined) avisos.push('Não achei a coluna "Nome" (ou "Produto").');
  if (mapa.preco === undefined) avisos.push('Não achei a coluna "Preço" (ou "Valor").');
  if (mapa.categoria === undefined && !categoriaPadrao) avisos.push('Não achei a coluna "Categoria": escolha a categoria de todos os itens.');
  const pegar = (l: string[], campo: string) => (mapa[campo] === undefined ? null : texto(l[mapa[campo]]));
  return {
    colunas: Object.fromEntries(Object.entries(mapa).map(([c, i]) => [c, titulos[i]])),
    avisos,
    linhas: dados.map((l) => ({
      categoria: categoriaChave(pegar(l, "categoria") ?? categoriaPadrao ?? ""),
      nome: pegar(l, "nome") ?? "",
      preco: precoNumero(pegar(l, "preco") ?? ""),
      marca: pegar(l, "marca"),
      codigo: pegar(l, "codigo"),
    })),
  };
}

/** Planilha de exemplo para baixar e preencher. */
export const MODELOS: Record<TipoImportacao, string> = {
  clientes: "Nome;Telefone;E-mail;CPF;Nascimento;Endereço\nMaria da Silva;(27) 99999-0000;maria@email.com;123.456.789-01;31/12/1980;Rua das Flores, 10\n",
  produtos: "Categoria;Nome;Preço;Marca;Código\nArmação;Armação acetato preta;350,00;Vitral;AR-001\nLente;Visão simples 1.56 antirreflexo;180,00;;\n",
};
