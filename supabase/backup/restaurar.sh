#!/usr/bin/env bash
# Restaura um backup do Vitral num projeto Supabase NOVO (vazio). Nunca use no banco que está no ar.
#
# Uso:  supabase/backup/restaurar.sh vitral-AAAA-MM-DD.tar.gpg "postgresql://...session pooler do projeto novo..."
# Pede a BACKUP_SENHA (ou lê de BACKUP_SENHA no ambiente). Passo a passo: supabase/backup/RESTAURAR.md
# Tudo ou nada: se der erro no meio, o banco fica como estava e dá para tentar de novo.
set -euo pipefail

arquivo="${1:?informe o arquivo .tar.gpg}"
url="${2:?informe a connection string do projeto novo}"

trabalho="$(mktemp -d)"
trap 'rm -rf "$trabalho"' EXIT

if [ -n "${BACKUP_SENHA:-}" ]; then
  gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt --output "$trabalho/vitral.tar" "$arquivo" 3<<<"$BACKUP_SENHA"
else
  gpg --quiet --decrypt --output "$trabalho/vitral.tar" "$arquivo"
fi
tar -xf "$trabalho/vitral.tar" -C "$trabalho"
cat "$trabalho/LEIA.txt"

# só restaura num banco vazio
if [ "$(psql "$url" -Atc "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'oticas'")" != "0" ] \
   || { [ -f "$trabalho/auth.dump" ] && [ "$(psql "$url" -Atc 'select count(*) from auth.users')" != "0" ]; }; then
  echo "Este banco não está vazio (já tem óticas ou logins). Restaure num projeto Supabase novo." >&2
  exit 1
fi

# Monta um SQL só, nesta ordem:
#   1. extensões; 2. logins; 3. tudo das óticas, sem as permissões (e sem criar o schema public, que o projeto novo já tem);
#   4. zera as permissões que o projeto novo dá sozinho a cada tabela e função criada;
#   5. aplica as permissões do backup. Sem o passo 4, as tabelas que só mudam por funções do banco
#      (estoque, comissões, vendas, notas) voltariam aceitando gravação direta.
pg_restore --list "$trabalho/public.dump" | grep -vE ' (SCHEMA|COMMENT|ACL) - (SCHEMA )?public ' > "$trabalho/lista.txt"
grep -v ' ACL ' "$trabalho/lista.txt" > "$trabalho/lista_objetos.txt"
grep ' ACL ' "$trabalho/lista.txt" > "$trabalho/lista_permissoes.txt" || true
{
  cat "$trabalho/extensoes.sql"
  if [ -f "$trabalho/auth.dump" ]; then pg_restore --data-only --no-owner --file=- "$trabalho/auth.dump"; fi
  pg_restore --no-owner --use-list="$trabalho/lista_objetos.txt" --file=- "$trabalho/public.dump"
  cat "$(dirname "$0")/zerar_permissoes.sql"
  pg_restore --no-owner --use-list="$trabalho/lista_permissoes.txt" --file=- "$trabalho/public.dump"
} > "$trabalho/restaurar.sql"

psql "$url" --quiet --no-psqlrc -v ON_ERROR_STOP=1 --single-transaction -f "$trabalho/restaurar.sql" > /dev/null
echo "restaurado: $(psql "$url" -Atc 'select count(*) from oticas') óticas, $(psql "$url" -Atc 'select count(*) from clientes') clientes, $(psql "$url" -Atc 'select count(*) from auth.users') logins"
