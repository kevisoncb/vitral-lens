#!/usr/bin/env bash
# Testa o backup das fotos contra um S3 falso (moto): sobe arquivos, faz o backup, apaga tudo,
# restaura e confere que voltou byte a byte. Precisa do aws e do moto_server no PATH.
set -euo pipefail
cd "$(dirname "$0")/../.."

porta=5099
moto_server -p "$porta" > /dev/null 2>&1 &
servidor=$!
pasta="$(mktemp -d)"
trap 'kill $servidor 2>/dev/null; rm -rf "$pasta"' EXIT
for _ in $(seq 1 50); do curl -s "http://127.0.0.1:$porta" > /dev/null && break; sleep 0.2; done

export SUPABASE_S3_ENDPOINT="http://127.0.0.1:$porta" SUPABASE_S3_REGIAO=sa-east-1
export AWS_ACCESS_KEY_ID=teste AWS_SECRET_ACCESS_KEY=teste BACKUP_SENHA=senha-de-teste-das-fotos
s3() { aws --endpoint-url "$SUPABASE_S3_ENDPOINT" --region sa-east-1 "$@"; }

# fotos de exemplo, com pastas por ótica como no sistema
mkdir -p "$pasta/origem/receitas/otica-a" "$pasta/origem/produtos/otica-a/armacoes"
head -c 50000 /dev/urandom > "$pasta/origem/receitas/otica-a/receita 1.jpg"
head -c 20000 /dev/urandom > "$pasta/origem/receitas/otica-a/receita-2.pdf"
head -c 80000 /dev/urandom > "$pasta/origem/produtos/otica-a/armacoes/ray-ban.webp"
for b in receitas produtos; do
  s3 s3 mb "s3://$b" > /dev/null
  s3 s3 sync "$pasta/origem/$b" "s3://$b" --only-show-errors
done

supabase/backup/fotos.sh "$pasta/backup"
arquivo="$(ls "$pasta"/backup/vitral-fotos-*.tar.gpg)"
if gpg --batch --quiet --pinentry-mode loopback --passphrase errada --decrypt "$arquivo" > /dev/null 2>&1; then
  echo "FALHA: o backup das fotos abriu com a senha errada"; exit 1
fi

# "projeto novo": buckets vazios
for b in receitas produtos; do s3 s3 rm "s3://$b" --recursive --only-show-errors; done
supabase/backup/restaurar_fotos.sh "$arquivo"

mkdir -p "$pasta/volta"
for b in receitas produtos; do s3 s3 sync "s3://$b" "$pasta/volta/$b" --only-show-errors; done
if ! diff -r "$pasta/origem" "$pasta/volta"; then
  echo "FALHA: as fotos restauradas são diferentes das originais"; exit 1
fi
echo "fotos restauradas iguais às originais: $(find "$pasta/volta" -type f | wc -l) arquivos"
