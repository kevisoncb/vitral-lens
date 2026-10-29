// Confere as consultas das telas contra o banco de verdade, sem precisar do Supabase rodando.
// Lê todo o src/ com o compilador do TypeScript, acha cada supabase.from("tabela")... e .rpc("funcao", {...})
// e confere no Postgres (com as migrações aplicadas):
//   - a tabela existe; cada coluna do select, dos filtros, do order e do insert/update existe;
//   - cada relação embutida, ex. select("..., clientes(nome)"), tem chave estrangeira e não é ambígua
//     (o PostgREST recusa quando há duas chaves entre as mesmas tabelas e não se diz qual: tabela!coluna);
//   - a função do rpc existe e os nomes dos argumentos batem.
// Uso: PGHOST=... PGUSER=... PGDATABASE=... node supabase/tests/conferir_consultas.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const raiz = new URL("../..", import.meta.url).pathname;

function sql(consulta) {
  const saida = execFileSync("psql", ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", consulta], { encoding: "utf8" });
  return JSON.parse(saida.trim() || "null");
}

// ---------- esquema ----------
const colunas = new Map(); // tabela -> Set(colunas)
for (const { t, c } of sql(`select coalesce(json_agg(json_build_object('t', table_name, 'c', column_name)), '[]')
  from information_schema.columns where table_schema = 'public'`)) {
  if (!colunas.has(t)) colunas.set(t, new Set());
  colunas.get(t).add(c);
}
// chaves estrangeiras: de (tabela, colunas) para (tabela)
const fks = sql(`select coalesce(json_agg(json_build_object('nome', c.conname, 'de', r.relname, 'para', f.relname,
    'cols', (select array_agg(a.attname) from pg_attribute a where a.attrelid = c.conrelid and a.attnum = any(c.conkey)))), '[]')
  from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_class f on f.oid = c.confrelid
  join pg_namespace n on n.oid = r.relnamespace where c.contype = 'f' and n.nspname = 'public'`);
const funcoes = new Map(); // nome -> [lista de nomes de argumentos]
for (const { nome, args } of sql(`select coalesce(json_agg(json_build_object('nome', p.proname, 'args', coalesce(p.proargnames, '{}'),
    'modos', p.proargmodes)), '[]') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`)) {
  if (!funcoes.has(nome)) funcoes.set(nome, []);
  funcoes.get(nome).push(args);
}

// ---------- leitura do código ----------
function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

const problemas = [];
let consultas = 0;
let chamadas = 0;

function texto(no) {
  if (!no) return null;
  if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) return no.text;
  return null;
}

function chavesDoObjeto(no) {
  if (!no) return null;
  if (ts.isArrayLiteralExpression(no)) return no.elements.flatMap((e) => chavesDoObjeto(e) ?? []);
  if (!ts.isObjectLiteralExpression(no)) return null;
  const chaves = [];
  for (const p of no.properties) {
    if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
      const n = p.name;
      if (ts.isIdentifier(n) || ts.isStringLiteral(n)) chaves.push(n.text);
    }
    // espalhamento (...x): não dá para conferir sem rodar
  }
  return chaves;
}

/** Divide "a, b, rel(c, d)" no primeiro nível. */
function dividir(s) {
  const partes = [];
  let nivel = 0;
  let atual = "";
  for (const ch of s) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel--;
    if (ch === "," && nivel === 0) {
      partes.push(atual.trim());
      atual = "";
    } else atual += ch;
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes;
}

/** Acha a relação entre duas tabelas como o PostgREST faz. dica = coluna ou nome da chave depois do "!". */
function relacao(pai, alvo, dica, onde) {
  let candidatas = fks.filter((f) => (f.de === pai && f.para === alvo) || (f.de === alvo && f.para === pai));
  if (dica && dica !== "inner" && dica !== "left") {
    candidatas = candidatas.filter((f) => f.nome === dica || f.cols.includes(dica));
  }
  if (candidatas.length === 0) problemas.push(`${onde}: sem chave estrangeira entre "${pai}" e "${alvo}"${dica ? ` (dica !${dica})` : ""}`);
  else if (candidatas.length > 1)
    problemas.push(`${onde}: relação ambígua entre "${pai}" e "${alvo}" (${candidatas.map((f) => `${f.de}.${f.cols}`).join(" / ")}); use ${alvo}!coluna(...)`);
}

function conferirSelect(tabela, s, onde) {
  for (let parte of dividir(s)) {
    if (!parte || parte === "*") continue;
    const ap = parte.indexOf("(");
    if (ap >= 0) {
      // relação embutida: [apelido:]tabela[!dica][!inner](...)
      let cabeca = parte.slice(0, ap).trim();
      const dentro = parte.slice(ap + 1, parte.lastIndexOf(")"));
      if (cabeca.includes(":")) cabeca = cabeca.split(":")[1].trim();
      const [alvo, ...dicas] = cabeca.split("!");
      if (cabeca === "count") continue;
      if (!colunas.has(alvo)) {
        problemas.push(`${onde}: tabela embutida "${alvo}" não existe`);
        continue;
      }
      relacao(tabela, alvo, dicas.find((d) => d !== "inner" && d !== "left"), onde);
      conferirSelect(alvo, dentro, onde);
      continue;
    }
    // coluna: [apelido:]coluna[::tipo] ou coluna->>chave
    let col = parte.split("::")[0];
    if (col.includes(":")) col = col.split(":")[1];
    col = col.split("->")[0].trim();
    if (col === "count()" || col === "count") continue;
    if (!colunas.get(tabela)?.has(col)) problemas.push(`${onde}: coluna "${tabela}.${col}" não existe`);
  }
}

/** Coluna de filtro: "coluna" ou "tabela_embutida.coluna". */
function conferirColuna(tabela, col, onde) {
  if (!col) return;
  let t = tabela;
  let c = col.split("->")[0];
  if (c.includes(".")) [t, c] = c.split(".");
  if (!colunas.has(t)) problemas.push(`${onde}: tabela "${t}" (do filtro) não existe`);
  else if (!colunas.get(t).has(c)) problemas.push(`${onde}: coluna "${t}.${c}" (filtro/ordem) não existe`);
}

/** Filtro .or("nome.ilike.%x%,telefone.ilike.%x%"): confere o nome antes do primeiro ponto de cada condição. */
function conferirOr(tabela, s, onde) {
  for (const cond of dividir(s)) {
    const m = /^(?:and|or)\((.*)\)$/.exec(cond);
    if (m) {
      conferirOr(tabela, m[1], onde);
      continue;
    }
    conferirColuna(tabela, cond.split(".")[0], onde);
  }
}

const FILTROS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains", "containedBy", "not", "filter", "match", "order", "textSearch"]);

function analisar(caminho) {
  const fonte = ts.createSourceFile(caminho, readFileSync(caminho, "utf8"), ts.ScriptTarget.Latest, true);
  const rel = relative(raiz, caminho);

  function linha(no) {
    return `${rel}:${fonte.getLineAndCharacterOfPosition(no.getStart()).line + 1}`;
  }

  function visitar(no) {
    if (ts.isCallExpression(no) && ts.isPropertyAccessExpression(no.expression)) {
      const metodo = no.expression.name.text;
      const onde = linha(no);

      if (metodo === "from" && no.arguments.length === 1 && texto(no.arguments[0])) {
        const tabela = texto(no.arguments[0]);
        // .storage.from("bucket") não é tabela
        const antes = no.expression.expression;
        const ehStorage = ts.isPropertyAccessExpression(antes) && antes.name.text === "storage";
        if (!ehStorage) {
          consultas++;
          if (!colunas.has(tabela)) problemas.push(`${onde}: tabela "${tabela}" não existe`);
          else {
            // sobe pela cadeia: from(...).select(...).eq(...)...
            let atual = no;
            while (ts.isPropertyAccessExpression(atual.parent) && ts.isCallExpression(atual.parent.parent)) {
              const chamada = atual.parent.parent;
              const m = atual.parent.name.text;
              const a0 = chamada.arguments[0];
              const o = linha(chamada);
              if (m === "select" && texto(a0) != null) conferirSelect(tabela, texto(a0), o);
              else if (m === "or" && texto(a0) != null) conferirOr(tabela, texto(a0), o);
              else if (FILTROS.has(m) && texto(a0) != null) {
                const opcoes = chamada.arguments[1];
                // order("col", { referencedTable: "x" })
                let t = tabela;
                if (m === "order" && opcoes && ts.isObjectLiteralExpression(opcoes)) {
                  for (const p of opcoes.properties)
                    if (ts.isPropertyAssignment(p) && ["referencedTable", "foreignTable"].includes(p.name.getText()) && texto(p.initializer))
                      t = texto(p.initializer);
                }
                conferirColuna(t, texto(a0), o);
              } else if (m === "match" && a0) {
                for (const k of chavesDoObjeto(a0) ?? []) conferirColuna(tabela, k, o);
              } else if (["insert", "update", "upsert"].includes(m)) {
                const chaves = chavesDoObjeto(a0);
                for (const k of chaves ?? []) if (!colunas.get(tabela).has(k)) problemas.push(`${o}: ${m} em "${tabela}" com coluna "${k}" que não existe`);
                if (m === "upsert" && chamada.arguments[1] && ts.isObjectLiteralExpression(chamada.arguments[1])) {
                  for (const p of chamada.arguments[1].properties)
                    if (ts.isPropertyAssignment(p) && p.name.getText() === "onConflict" && texto(p.initializer))
                      for (const c of texto(p.initializer).split(",")) conferirColuna(tabela, c.trim(), o);
                }
              }
              atual = chamada;
            }
          }
        }
      }

      if (metodo === "rpc" && texto(no.arguments[0])) {
        chamadas++;
        const nome = texto(no.arguments[0]);
        const versoes = funcoes.get(nome);
        if (!versoes) problemas.push(`${onde}: função "${nome}" não existe`);
        else {
          const chaves = chavesDoObjeto(no.arguments[1]) ?? [];
          // basta uma versão (sobrecarga) aceitar todos os nomes
          const aceita = versoes.some((args) => chaves.every((k) => args.includes(k)));
          if (!aceita) problemas.push(`${onde}: rpc "${nome}" com argumentos {${chaves.join(", ")}}, a função espera (${versoes.map((a) => a.join(", ")).join(" | ")})`);
        }
      }
    }
    ts.forEachChild(no, visitar);
  }
  visitar(fonte);
}

for (const a of arquivos(join(raiz, "src"))) analisar(a);

console.log(`consultas conferidas: ${consultas}, chamadas rpc: ${chamadas}`);
if (problemas.length) {
  console.log(`\n${problemas.length} problema(s):`);
  for (const p of problemas) console.log(" - " + p);
  process.exit(1);
}
console.log("nenhum problema: todas as tabelas, colunas, relações e funções existem");
