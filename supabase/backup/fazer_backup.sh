#!/usr/bin/env bash
# Backup do banco do Vitral: dados das óticas (schema public) e logins (auth.users, auth.identities),
# num arquivo só, criptografado com senha (AES-256). Receita é dado de saúde: o arquivo nunca sai sem senha.
#
# Uso:  SUPABASE_DB_URL=... BACKUP_SENHA=... supabase/backup/fazer_backup.sh <pasta de saída>
# Gera: <pasta>/vitral-AAAA-MM-DD.tar.gpg
# Restaurar: supabase/backup/RESTAURAR.md
set -euo pipefail

saida="${1:?informe a pasta de saída}"
: "${SUPABASE_DB_URL:?falta SUPABASE_DB_URL (connection string do Session pooler do Supabase)}"
: "${BACKUP_SENHA:?falta BACKUP_SENHA (senha para criptografar o backup)}"

dia="$(TZ=America/Sao_Paulo date +%F)"
trabalho="$(mktemp -d)"
trap 'rm -rf "$trabalho"' EXIT
mkdir -p "$saida"

# 1. Tudo das óticas: tabelas, funções, regras de segurança, permissões (quem executa cada função) e dados
pg_dump "$SUPABASE_DB_URL" --format=custom --schema=public --no-owner --file="$trabalho/public.dump"

# 2. Logins (só os dados; as tabelas já existem em qualquer projeto Supabase)
tem_auth="$(psql "$SUPABASE_DB_URL" -Atc "select count(*) from information_schema.tables where table_schema = 'auth' and table_name in ('users', 'identities')")"
if [ "$tem_auth" = "2" ]; then
  pg_dump "$SUPABASE_DB_URL" --format=custom --data-only --table=auth.users --table=auth.identities --no-owner --no-privileges --file="$trabalho/auth.dump"
fi

# 3. Extensões (o pg_dump do schema public não leva): a restauração cria antes de tudo
psql "$SUPABASE_DB_URL" -Atc "select format('create extension if not exists %I with schema %I;', e.extname, n.nspname)
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname <> 'plpgsql' order by 1" > "$trabalho/extensoes.sql"

# 4. Confere que os arquivos abrem antes de guardar (backup que não restaura não é backup)
for f in "$trabalho"/*.dump; do
  pg_restore --list "$f" > /dev/null
done
tabelas="$(pg_restore --list "$trabalho/public.dump" | grep -c ' TABLE DATA ' || true)"
echo "public.dump: $tabelas tabelas com dados$( [ -f "$trabalho/auth.dump" ] && echo '; auth.dump: logins' )"

# 5. Um arquivo, criptografado
printf '%s\n' "dia=$dia" "tabelas=$tabelas" > "$trabalho/LEIA.txt"
tar -C "$trabalho" -cf "$trabalho/vitral.tar" $(cd "$trabalho" && ls *.dump extensoes.sql LEIA.txt)
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 \
    --output "$saida/vitral-$dia.tar.gpg" "$trabalho/vitral.tar" 3<<<"$BACKUP_SENHA"
echo "backup pronto: $saida/vitral-$dia.tar.gpg ($(du -h "$saida/vitral-$dia.tar.gpg" | cut -f1))"
