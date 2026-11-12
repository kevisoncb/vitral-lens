#!/usr/bin/env bash
# Devolve as fotos de um backup para o Storage de um projeto Supabase (novo ou o mesmo).
# Não apaga nada que já esteja lá: só envia o que falta ou mudou.
#
# Uso:  SUPABASE_S3_ENDPOINT=... SUPABASE_S3_REGIAO=sa-east-1 AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
#       supabase/backup/restaurar_fotos.sh vitral-fotos-AAAA-MM-DD.tar.gpg
# Os buckets (receitas, produtos) precisam existir: rode as migrações 0003 e 0007 antes.
set -euo pipefail

arquivo="${1:?informe o arquivo .tar.gpg}"
: "${SUPABASE_S3_ENDPOINT:?falta SUPABASE_S3_ENDPOINT}"
regiao="${SUPABASE_S3_REGIAO:-sa-east-1}"
trabalho="$(mktemp -d)"
trap 'rm -rf "$trabalho"' EXIT

if [ -n "${BACKUP_SENHA:-}" ]; then
  gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt --output "$trabalho/fotos.tar" "$arquivo" 3<<<"$BACKUP_SENHA"
else
  gpg --quiet --decrypt --output "$trabalho/fotos.tar" "$arquivo"
fi
tar -xf "$trabalho/fotos.tar" -C "$trabalho"
cat "$trabalho/fotos/LEIA.txt"
for pasta in "$trabalho"/fotos/*/; do
  b="$(basename "$pasta")"
  aws s3 sync "$pasta" "s3://$b" --endpoint-url "$SUPABASE_S3_ENDPOINT" --region "$regiao" --only-show-errors
  echo "$b: $(find "$pasta" -type f | wc -l) arquivos enviados"
done
