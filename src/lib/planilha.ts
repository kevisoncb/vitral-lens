/**
 * Leitura de planilha (CSV ou Excel .xlsx) para importar clientes e produtos.
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

// ---------------------------------------------------------------------------
// Excel (.xlsx): um ZIP com XMLs. Lê a primeira aba sem biblioteca externa; o navegador
// descompacta com DecompressionStream. O .xls antigo (binário) não é aceito.
// ---------------------------------------------------------------------------

type ArquivoZip = { metodo: number; tamanho: number; inicio: number };

function indiceZip(dados: Uint8Array): Map<string, ArquivoZip> {
  const v = new DataView(dados.buffer, dados.byteOffset, dados.byteLength);
  // fim do diretório central: assinatura 0x06054b50, procurada de trás para frente
  let fim = -1;
  for (let i = dados.length - 22; i >= Math.max(0, dados.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error("O arquivo não é uma planilha do Excel (.xlsx) válida.");
  const total = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const nomes = new TextDecoder();
  const arquivos = new Map<string, ArquivoZip>();
  for (let n = 0; n < total; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true);
    const tamanho = v.getUint32(p + 20, true);
    const tamNome = v.getUint16(p + 28, true);
    const tamExtra = v.getUint16(p + 30, true);
    const tamComentario = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nome = nomes.decode(dados.subarray(p + 46, p + 46 + tamNome));
    // o cabeçalho local tem nome e extra próprios: o conteúdo começa depois deles
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    arquivos.set(nome, { metodo, tamanho, inicio });
    p += 46 + tamNome + tamExtra + tamComentario;
  }
  return arquivos;
}

async function lerDoZip(dados: Uint8Array, arquivos: Map<string, ArquivoZip>, nome: string): Promise<string | null> {
  const a = arquivos.get(nome);
  if (!a) return null;
  const bruto = dados.slice(a.inicio, a.inicio + a.tamanho);
  if (a.metodo === 0) return new TextDecoder().decode(bruto);
  if (a.metodo !== 8) throw new Error("Compressão da planilha não suportada. Salve de novo no Excel ou como CSV.");
  const fluxo = new Blob([bruto]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(await new Response(fluxo).arrayBuffer());
}

function textoXml(t: string): string {
  return t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

/** "B" -> 1, "AA" -> 26 */
function indiceColuna(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** .xlsx -> matriz de células (primeira aba), no mesmo formato de lerCsv. */
export async function lerXlsx(bytes: ArrayBuffer): Promise<string[][]> {
  const dados = new Uint8Array(bytes);
  const arquivos = indiceZip(dados);

  // primeira aba: workbook.xml diz o id, o .rels diz o arquivo
  let aba = "xl/worksheets/sheet1.xml";
  const livro = await lerDoZip(dados, arquivos, "xl/workbook.xml");
  const rels = await lerDoZip(dados, arquivos, "xl/_rels/workbook.xml.rels");
  const rid = livro && /<(?:\w+:)?sheet\b[^>]*\br:id="([^"]+)"/.exec(livro)?.[1];
  if (rid && rels) {
    const alvo = new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1]
      ?? new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels)?.[1];
    if (alvo) aba = alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo}`;
  }
  const xml = await lerDoZip(dados, arquivos, aba);
  if (!xml) throw new Error("Não achei a primeira aba da planilha.");

  // textos repetidos ficam em sharedStrings.xml; cada <si> pode ter vários pedaços <t>
  const compartilhados: string[] = [];
  const sst = await lerDoZip(dados, arquivos, "xl/sharedStrings.xml");
  for (const si of sst?.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    compartilhados.push(textoXml((si.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("")));
  }

  const linhas: string[][] = [];
  for (const linha of xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const celulas: string[] = [];
    for (const c of linha.match(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
      const atributos = c.slice(0, c.indexOf(">"));
      const ref = /\br="([A-Z]+)\d+"/.exec(atributos)?.[1];
      const tipo = /\bt="(\w+)"/.exec(atributos)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(c)?.[1];
      let valor = "";
      if (tipo === "s" && v !== undefined) valor = compartilhados[Number(v)] ?? "";
      else if (tipo === "inlineStr") valor = textoXml((c.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join(""));
      else if (v !== undefined) valor = textoXml(v);
      const i = ref ? indiceColuna(ref) : celulas.length;
      while (celulas.length < i) celulas.push("");
      celulas[i] = valor;
    }
    if (celulas.some((x) => x.trim() !== "")) linhas.push(celulas);
  }
  return linhas;
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
  // data do Excel (.xlsx): número de dias desde 30/12/1899
  if (/^\d{4,5}(\.\d+)?$/.test(s) && Number(s) > 1000 && Number(s) < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000).toISOString().slice(0, 10);
  }
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

/** CPF guardado como número no Excel perde os zeros da frente: 1234567890 -> 01234567890. */
function cpfCompleto(t: string | null): string | null {
  if (t && /^\d{9,10}$/.test(t)) return t.padStart(11, "0");
  return t;
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
      cpf: cpfCompleto(pegar(l, "cpf")),
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
