// Gera src/lib/supabase/tipos.ts a partir do banco (mesmo formato do `supabase gen types typescript`),
// sem precisar do Docker nem do projeto no Supabase: basta um Postgres com as migrações aplicadas.
// Uso: PGHOST=... PGUSER=... PGDATABASE=... node supabase/gerar_tipos.mjs
//      node supabase/gerar_tipos.mjs --conferir   (falha se o arquivo estiver desatualizado; usado no CI)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const destino = new URL("../src/lib/supabase/tipos.ts", import.meta.url).pathname;

function sql(consulta) {
  const saida = execFileSync("psql", ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", consulta], { encoding: "utf8" });
  return JSON.parse(saida.trim() || "null") ?? [];
}

const enums = sql(`select coalesce(json_agg(json_build_object('nome', t.typname,
    'valores', (select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid))), '[]')
  from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e'`);
const nomesEnum = new Set(enums.map((e) => e.nome));

const colunas = sql(`select coalesce(json_agg(json_build_object(
    'tabela', c.table_name, 'coluna', c.column_name, 'tipo', c.udt_name, 'nulo', c.is_nullable = 'YES',
    'padrao', c.column_default is not null or c.is_identity = 'YES', 'gerada', c.is_generated = 'ALWAYS' or c.identity_generation = 'ALWAYS'
  ) order by c.table_name, c.ordinal_position), '[]')
  from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE'`);

// chaves estrangeiras: um-para-um quando as colunas de origem são a chave primária ou únicas
const fks = sql(`select coalesce(json_agg(json_build_object('nome', c.conname, 'de', r.relname, 'para', f.relname,
    'cols', (select json_agg(a.attname order by k.i) from unnest(c.conkey) with ordinality k(n, i) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n),
    'refs', (select json_agg(a.attname order by k.i) from unnest(c.confkey) with ordinality k(n, i) join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.n),
    'umParaUm', exists (select 1 from pg_constraint u where u.conrelid = c.conrelid and u.contype in ('p', 'u')
                         and (select array_agg(x order by x) from unnest(u.conkey) x) = (select array_agg(x order by x) from unnest(c.conkey) x))
  ) order by r.relname, c.conname), '[]')
  from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_class f on f.oid = c.confrelid
  join pg_namespace n on n.oid = r.relnamespace where c.contype = 'f' and n.nspname = 'public'`);

// funções do schema public chamáveis pelo app (as de trigger ficam de fora)
const funcoes = sql(`select coalesce(json_agg(json_build_object('nome', p.proname,
    'args', coalesce((select json_agg(json_build_object('nome', a.nome, 'tipo', a.tipo, 'opcional', a.n > p.pronargs - p.pronargdefaults) order by a.n)
      from (select u.nome, format_type(u.tipo, null) as tipo, row_number() over (order by u.i) as n
            from unnest(p.proargnames, coalesce(p.proallargtypes, p.proargtypes::oid[]),
                        coalesce(p.proargmodes, array_fill('i'::"char", array[p.pronargs::int]))) with ordinality as u(nome, tipo, modo, i)
            where u.modo in ('i', 'b', 'v')) a
      where a.nome is not null and a.nome <> ''), '[]'),
    'retorno', format_type(p.prorettype, null), 'conjunto', p.proretset, 'tipoRetorno', t.typtype, 'relRetorno', rt.relname,
    'colunasRetorno', (select json_agg(json_build_object('nome', u.nome, 'tipo', format_type(u.tipo, null)) order by u.i)
      from unnest(p.proargnames, p.proallargtypes, p.proargmodes) with ordinality as u(nome, tipo, modo, i) where u.modo = 't')
  ) order by p.proname, p.oid), '[]')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype
  left join pg_class rt on rt.oid = t.typrelid
  where n.nspname = 'public' and p.prokind = 'f' and t.typname not in ('trigger', 'event_trigger')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`);

function tipoTs(udt) {
  const arr = udt.startsWith("_") || udt.endsWith("[]");
  const base = udt.replace(/^_/, "").replace(/\[\]$/, "");
  let t;
  if (nomesEnum.has(base)) t = `Database["public"]["Enums"]["${base}"]`;
  else if (["int2", "int4", "int8", "float4", "float8", "numeric", "smallint", "integer", "bigint", "real", "double precision"].includes(base)) t = "number";
  else if (["bool", "boolean"].includes(base)) t = "boolean";
  else if (["json", "jsonb"].includes(base)) t = "Json";
  else if (base === "void") t = "undefined";
  else if (["uuid", "text", "varchar", "character varying", "bpchar", "date", "time", "timestamptz", "timestamp", "timestamp with time zone",
    "timestamp without time zone", "time without time zone", "tstzrange", "interval", "name"].includes(base)) t = "string";
  else t = "unknown";
  return arr ? `${t}[]` : t;
}

// colunas que um trigger "before insert" preenche (otica_id via preencher_otica()) podem faltar no insert
const preenchidas = new Set(sql(`select coalesce(json_agg(distinct c.relname), '[]') from pg_trigger t
  join pg_class c on c.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and p.proname = 'preencher_otica' and not t.tgisinternal`).map((t) => `${t}.otica_id`));
// o trigger catalogo_controla_estoque (0011) decide pela categoria quando não vem
preenchidas.add("catalogo_itens.controla_estoque");

const tabelas = new Map();
for (const c of colunas) {
  if (!tabelas.has(c.tabela)) tabelas.set(c.tabela, []);
  tabelas.get(c.tabela).push(c);
}

const linhas = [];
const L = (s) => linhas.push(s);
L("// Gerado por supabase/gerar_tipos.mjs a partir das migrações. Não edite à mão: rode `npm run tipos`.");
L("export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];");
L("");
L("export type Database = {");
L("  public: {");
L("    Tables: {");
for (const [tabela, cols] of tabelas) {
  L(`      ${tabela}: {`);
  L("        Row: {");
  for (const c of cols) L(`          ${c.coluna}: ${tipoTs(c.tipo)}${c.nulo ? " | null" : ""};`);
  L("        };");
  L("        Insert: {");
  for (const c of cols) {
    if (c.gerada) L(`          ${c.coluna}?: never;`);
    else L(`          ${c.coluna}${c.nulo || c.padrao || preenchidas.has(`${tabela}.${c.coluna}`) ? "?" : ""}: ${tipoTs(c.tipo)}${c.nulo ? " | null" : ""};`);
  }
  L("        };");
  L("        Update: {");
  for (const c of cols) {
    if (c.gerada) L(`          ${c.coluna}?: never;`);
    else L(`          ${c.coluna}?: ${tipoTs(c.tipo)}${c.nulo ? " | null" : ""};`);
  }
  L("        };");
  L("        Relationships: [");
  for (const f of fks.filter((x) => x.de === tabela)) {
    L("          {");
    L(`            foreignKeyName: "${f.nome}";`);
    L(`            columns: [${f.cols.map((x) => `"${x}"`).join(", ")}];`);
    L(`            isOneToOne: ${f.umParaUm};`);
    L(`            referencedRelation: "${f.para}";`);
    L(`            referencedColumns: [${f.refs.map((x) => `"${x}"`).join(", ")}];`);
    L("          },");
  }
  L("        ];");
  L("      };");
}
L("    };");
L("    Views: {");
L("      [_ in never]: never;");
L("    };");
L("    Functions: {");
const porNome = new Map();
for (const f of funcoes) {
  if (!porNome.has(f.nome)) porNome.set(f.nome, []);
  porNome.get(f.nome).push(f);
}
for (const [nome, versoes] of porNome) {
  const corpos = versoes.map((f) => {
    const args = f.args.length
      ? `{ ${f.args.map((a) => `${a.nome}${a.opcional ? "?" : ""}: ${tipoTs(a.tipo)} | null`).join("; ")} }`
      : "Record<PropertyKey, never>";
    let ret;
    if (f.colunasRetorno?.length) ret = `{ ${f.colunasRetorno.map((c) => `${c.nome}: ${tipoTs(c.tipo)}`).join("; ")} }[]`;
    else if (f.tipoRetorno === "c" && f.relRetorno) ret = `Database["public"]["Tables"]["${f.relRetorno}"]["Row"]${f.conjunto ? "[]" : ""}`;
    else ret = `${tipoTs(f.retorno)}${f.conjunto ? "[]" : ""}`;
    return `{ Args: ${args}; Returns: ${ret} }`;
  });
  L(`      ${nome}: ${corpos.length > 1 ? corpos.map((c) => `\n        | ${c}`).join("") : corpos[0]};`);
}
L("    };");
L("    Enums: {");
for (const e of enums) L(`      ${e.nome}: ${e.valores.map((v) => `"${v}"`).join(" | ")};`);
L("    };");
L("    CompositeTypes: {");
L("      [_ in never]: never;");
L("    };");
L("  };");
L("};");
L("");
L('export type Tabela<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];');
L("");

const texto = linhas.join("\n");
if (process.argv.includes("--conferir")) {
  let atual = "";
  try { atual = readFileSync(destino, "utf8"); } catch { /* ainda não existe */ }
  if (atual !== texto) {
    console.error("src/lib/supabase/tipos.ts está desatualizado: rode `npm run tipos` e commite.");
    process.exit(1);
  }
  console.log("tipos.ts em dia com as migrações");
} else {
  writeFileSync(destino, texto);
  console.log(`tipos.ts gerado: ${tabelas.size} tabelas, ${porNome.size} funções, ${enums.length} enums`);
}
