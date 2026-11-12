#!/usr/bin/env bash
# Backup das fotos do Storage do Supabase (receitas e armações), pela interface S3 do Storage.
# Usa as chaves S3 do Storage (só arquivos; não abrem o banco), nunca a service_role.
# Sai um arquivo criptografado com a mesma senha do backup do banco.
#
# Uso:  SUPABASE_S3_ENDPOINT=https://<projeto>.supabase.co/storage/v1/s3 SUPABASE_S3_REGIAO=sa-east-1 \
#       AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... BACKUP_SENHA=... supabase/backup/fotos.sh <pasta de saída>
# Gera: <pasta>/vitral-fotos-AAAA-MM-DD.tar.gpg       Restaurar: supabase/backup/RESTAURAR.md
set -euo pipefail

saida="${1:?informe a pasta de saída}"
: "${SUPABASE_S3_ENDPOINT:?falta SUPABASE_S3_ENDPOINT (Storage → S3 Connection → Endpoint)}"
: "${AWS_ACCESS_KEY_ID:?falta a chave S3 do Storage (Access key ID)}"
: "${AWS_SECRET_ACCESS_KEY:?falta a chave S3 do Storage (Secret access key)}"
: "${BACKUP_SENHA:?falta BACKUP_SENHA}"
regiao="${SUPABASE_S3_REGIAO:-sa-east-1}"
buckets="${BUCKETS:-receitas produtos}"

dia="$(TZ=America/Sao_Paulo date +%F)"
trabalho="$(mktemp -d)"
trap 'rm -rf "$trabalho"' EXIT
mkdir -p "$saida" "$trabalho/fotos"

total=0
for b in $buckets; do
  mkdir -p "$trabalho/fotos/$b"
  aws s3 sync "s3://$b" "$trabalho/fotos/$b" --endpoint-url "$SUPABASE_S3_ENDPOINT" --region "$regiao" --only-show-errors
  n="$(find "$trabalho/fotos/$b" -type f | wc -l)"
  echo "$b: $n arquivos"
  total=$((total + n))
done

printf '%s\n' "dia=$dia" "arquivos=$total" "buckets=$buckets" > "$trabalho/fotos/LEIA.txt"
tar -C "$trabalho" -cf "$trabalho/fotos.tar" fotos
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 \
    --output "$saida/vitral-fotos-$dia.tar.gpg" "$trabalho/fotos.tar" 3<<<"$BACKUP_SENHA"
echo "backup das fotos pronto: $saida/vitral-fotos-$dia.tar.gpg ($total arquivos, $(du -h "$saida/vitral-fotos-$dia.tar.gpg" | cut -f1))"
