#!/usr/bin/env bash
# Testa o backup de ponta a ponta: faz o backup do banco de teste, restaura num banco vazio que imita
# um projeto Supabase novo e confere que ficou tudo igual (dados, logins, regras, gatilhos, funções e permissões).
# Uso (com PGHOST/PGUSER/PGPASSWORD do banco de teste, já com as migrações e os testes rodados):
#   supabase/tests/backup_teste.sh [banco de origem]
set -euo pipefail
cd "$(dirname "$0")/../.."

origem="${1:-${PGDATABASE:-postgres}}"
url_base="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}"
pasta="$(mktemp -d)"
trap 'rm -rf "$pasta"' EXIT
export BACKUP_SENHA="senha-de-teste-do-ci"

# logins de exemplo (no Supabase, auth.users e auth.identities já existem)
auth_sql="create table if not exists auth.users (id uuid primary key, email text, encrypted_password text, created_at timestamptz default now());
create table if not exists auth.identities (id uuid primary key, user_id uuid references auth.users(id), provider text);"
psql -q -d "$origem" -c "$auth_sql" 2>/dev/null
psql -q -d "$origem" -c "insert into auth.users (id, email, encrypted_password) values ('b0000000-0000-0000-0000-000000000001', 'dono@teste.com', 'hash') on conflict do nothing;
insert into auth.identities values ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'email') on conflict do nothing;"

SUPABASE_DB_URL="$url_base/$origem" supabase/backup/fazer_backup.sh "$pasta"
arquivo="$(ls "$pasta"/vitral-*.tar.gpg)"

# senha errada não abre
if gpg --batch --quiet --pinentry-mode loopback --passphrase errada --decrypt "$arquivo" > /dev/null 2>&1; then
  echo "FALHA: o backup abriu com a senha errada"; exit 1
fi
echo "senha errada não abre"

# "projeto Supabase novo": papéis, schema auth e as permissões padrão que o Supabase dá a tudo que é criado
psql -q -d postgres -c 'drop database if exists vitral_restaurado' -c 'create database vitral_restaurado'
psql -q -d vitral_restaurado -v ON_ERROR_STOP=1 -f supabase/tests/stub_supabase.sql
psql -q -d vitral_restaurado -c "$auth_sql"
psql -q -d vitral_restaurado -c "alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;"

supabase/backup/restaurar.sh "$arquivo" "$url_base/vitral_restaurado"

psql -q -d "$origem" -f supabase/tests/retrato_banco.sql > "$pasta/original.txt"
psql -q -d vitral_restaurado -f supabase/tests/retrato_banco.sql > "$pasta/restaurado.txt"
if ! diff "$pasta/original.txt" "$pasta/restaurado.txt"; then
  echo "FALHA: o banco restaurado é diferente do original"; exit 1
fi
echo "restaurado igual ao original: $(grep -c '^tabela ' "$pasta/original.txt") tabelas, $(grep -c '^funcao ' "$pasta/original.txt") funções, permissões e logins"

# restaurar de novo por cima: recusado
if supabase/backup/restaurar.sh "$arquivo" "$url_base/vitral_restaurado" > /dev/null 2>&1; then
  echo "FALHA: restaurou por cima de um banco que já tinha dados"; exit 1
fi
echo "não restaura por cima de banco com dados"
