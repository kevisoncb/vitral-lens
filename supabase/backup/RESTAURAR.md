# Restaurar um backup do banco

O backup diário (`.github/workflows/backup.yml`) guarda por 30 dias, nos artefatos do GitHub Actions,
um arquivo `vitral-AAAA-MM-DD.tar.gpg` criptografado com a senha `BACKUP_SENHA`.

Ele tem:

- `public.dump`: tudo das óticas (tabelas, funções, regras de segurança, permissões e dados);
- `auth.dump`: os logins (`auth.users` e `auth.identities`); as senhas continuam as mesmas;
- `LEIA.txt`: dia e número de tabelas.

As **fotos** (armações, receitas) têm backup separado, todo domingo (`vitral-fotos-AAAA-MM-DD.tar.gpg`, guardado 14 dias). Veja a seção 4.

## 1. Baixar

GitHub → **Actions → Backup do banco** → escolha o dia → **Artifacts** → baixe e descompacte o `.zip`.
Dentro está o `vitral-AAAA-MM-DD.tar.gpg`.

Precisa do `psql`, `pg_restore` 17 ou mais novo (pacote `postgresql-client-17`) e do `gpg`.

## 2. Restaurar num projeto Supabase novo (vazio)

Use um projeto **novo**: o script recusa um banco que já tem óticas ou logins, para nunca restaurar por cima do que está no ar.

Pegue a connection string do projeto novo em **Connect → Session pooler** e rode, na pasta do repositório:

```bash
supabase/backup/restaurar.sh vitral-AAAA-MM-DD.tar.gpg "COLE_A_CONNECTION_STRING_AQUI"
```

Ele pede a `BACKUP_SENHA` e faz tudo numa transação só (se der erro no meio, o banco fica vazio como estava):

1. cria as extensões (`btree_gist`, `pg_trgm`);
2. restaura os logins;
3. restaura tudo das óticas;
4. zera as permissões que o projeto novo dá sozinho e aplica as do backup. Sem isso, tabelas que só mudam por funções do banco (estoque, comissões, vendas, notas) voltariam aceitando gravação direta.

As migrações **não** precisam ser rodadas: o backup já traz tudo. O CI testa esse caminho a cada push (`supabase/tests/backup_teste.sh`): restaura num banco vazio e confere que dados, regras, funções e permissões ficam iguais.

## 3. Depois de restaurar

- Ponha a URL e as chaves do projeto novo no Firebase (`firebase apphosting:secrets:set supabase-url` e as outras; README, seção 4) e no segredo `SUPABASE_DB_URL` do GitHub.
- Rode de novo as migrações 0003 e 0007, que criam as pastas do Storage (receitas e fotos), e devolva as fotos (seção 4).
- Entre com um login de dono e confira clientes, vendas e estoque.

## 4. Fotos (receitas e armações)

Baixe o artefato `fotos-...` do dia (Actions → Backup do banco), descompacte e, com as chaves S3 do Storage do projeto de destino
(Storage → S3 Connection), rode:

```bash
SUPABASE_S3_ENDPOINT="https://SEU-PROJETO.supabase.co/storage/v1/s3" SUPABASE_S3_REGIAO=sa-east-1 \
AWS_ACCESS_KEY_ID="..." AWS_SECRET_ACCESS_KEY="..." \
supabase/backup/restaurar_fotos.sh vitral-fotos-AAAA-MM-DD.tar.gpg
```

Ele pede a `BACKUP_SENHA`, não apaga nada do que já está lá e só envia o que falta. Precisa do `aws` (AWS CLI) instalado.
O CI testa esse caminho contra um S3 falso (`supabase/tests/backup_fotos_teste.sh`).
