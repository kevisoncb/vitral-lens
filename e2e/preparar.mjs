// Prepara o Supabase local para o teste das telas: uma ótica no Plano Especial, cinco logins (um por área),
// produtos com estoque. Lê as chaves do `supabase status -o json`. Grava e2e/.dados.json para os testes.
// Uso: node e2e/preparar.mjs   (depois de `npx supabase start`)
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

// SUPABASE_BIN: "supabase" (instalado, como no CI) ou "npx supabase" no seu computador
const [bin, ...antes] = (process.env.SUPABASE_BIN ?? "supabase").split(" ");
const status = JSON.parse(execFileSync(bin, [...antes, "status", "-o", "json"], { encoding: "utf8" }));
const API = status.API_URL;
const SERVICE = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
const DB = status.DB_URL;
if (!API || !SERVICE || !DB) throw new Error("Não achei API_URL, SERVICE_ROLE_KEY e DB_URL no `supabase status`.");

const SENHA = "Vitral-Teste-2026";
const OTICA = "e2e00000-0000-0000-0000-000000000001";
const pessoas = [
  { chave: "dono", nome: "Dona Nery", email: "dono@e2e.vitral" },
  { chave: "vendedor", nome: "Vera Balcão", email: "balcao@e2e.vitral" },
  { chave: "optometrista", nome: "Otto Optometrista", email: "consultorio@e2e.vitral" },
  { chave: "laboratorio", nome: "Lia Laboratório", email: "laboratorio@e2e.vitral" },
  { chave: "caixa", nome: "Caio Caixa", email: "caixa@e2e.vitral" },
];

function sql(texto) {
  return execFileSync("psql", [DB, "-v", "ON_ERROR_STOP=1", "-qAt", "-c", texto], { encoding: "utf8" }).trim();
}

async function criarLogin(email) {
  const r = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA, email_confirm: true }),
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(`criar ${email}: ${r.status} ${JSON.stringify(corpo)}`);
  return corpo.id;
}

sql(`insert into oticas (id, nome, status, slug, site_publicado) values ('${OTICA}', 'Óticas Teste', 'ativa', 'teste', true)`);
sql(`insert into lojas (otica_id, nome) values ('${OTICA}', 'Centro')`);
sql(`insert into otica_adicionais (otica_id, recurso) values ('${OTICA}', 'plano_especial')`);
for (const p of pessoas) {
  p.id = await criarLogin(p.email);
  sql(`insert into usuarios (id, otica_id, perfil_id, nome, email)
       select '${p.id}', '${OTICA}', id, '${p.nome}', '${p.email}' from perfis where otica_id = '${OTICA}' and chave = '${p.chave}'`);
}
sql(`insert into catalogo_itens (otica_id, categoria, nome, preco, codigo, controla_estoque) values
       ('${OTICA}', 'acessorio', 'Estojo rígido', 50, '7890001', true),
       ('${OTICA}', 'lente', 'Lente multifocal 1.67', 640, 'LM167', false),
       ('${OTICA}', 'armacao', 'Armação acetato preta', 300, '7890002', true)`);
sql(`insert into estoque_movimentos (otica_id, loja_id, item_id, tipo, quantidade, motivo)
     select c.otica_id, (select id from lojas where otica_id = c.otica_id), c.id, 'entrada', 10, 'Estoque inicial do teste'
     from catalogo_itens c where c.otica_id = '${OTICA}' and c.controla_estoque`);

writeFileSync(new URL("./.dados.json", import.meta.url), JSON.stringify({ senha: SENHA, otica: OTICA, pessoas }, null, 2));
console.log(`ótica de teste pronta: ${pessoas.length} logins, 3 produtos`);
