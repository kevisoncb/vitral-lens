# Vitra (vitral-lens)

Sistema web para óticas: funil de vendas, laboratório, clientes com receitas e agenda. Multiempresa (uma instalação atende várias óticas) e responsivo (computador, tablet e celular).

Stack: Next.js (React + TypeScript) e Supabase (Postgres, login e permissões).

## Estado atual

- `supabase/migrations/0001_base_multiempresa.sql`: banco completo com isolamento entre óticas (RLS), perfis e permissões por módulo, liberação de recursos por plano, auditoria, regra do motivo de perda, OS automática, agenda sem horário duplicado e tabelas já preparadas do PDV e do financeiro (Versão 4). **Testado** em Postgres 16 (`supabase/tests`).
- `src/`: login, menu por permissão e plano, funil de vendas em Kanban com arrastar e soltar. **Ainda não foi compilado nem executado**: foi escrito sem acesso ao npm. No primeiro `npm install` podem aparecer ajustes de tipos.
- Ainda não existem: laboratório, clientes e receitas, agenda, PDV e financeiro (só as tabelas).

## Como rodar

1. Crie um projeto no Supabase e rode `supabase/migrations/0001_base_multiempresa.sql` no SQL Editor.
2. Copie `.env.example` para `.env.local` e preencha as chaves.
3. `npm install` e `npm run dev`.
4. Crie a primeira ótica e o usuário dono pelo painel do Supabase (service role). Exemplo:

```sql
insert into oticas (nome, plano, status) values ('Ótica Ômega', 'profissional', 'ativa') returning id;
-- crie o usuário em Authentication > Users e depois:
insert into lojas (otica_id, nome) values ('<id da ótica>', 'Loja Centro');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select '<id do usuário>', '<id da ótica>', id, 'Nome do dono', 'email@exemplo.com'
from perfis where otica_id = '<id da ótica>' and chave = 'dono';
```

## Testar o banco sem Supabase

```bash
psql -f supabase/tests/stub_supabase.sql
psql -f supabase/migrations/0001_base_multiempresa.sql
psql -f supabase/tests/rls_smoke.sql   # os erros "row-level security" são esperados
```

## Regras do produto

- WhatsApp: só link com mensagem pronta (`src/lib/whatsapp.ts`); nada é enviado automaticamente.
- Planos: Essencial, Profissional (inclui agenda, relatórios, PDV e financeiro) e Rede (sob orçamento). O que cada plano libera fica na tabela `plano_recursos`.
- Cada módulo é liberado por perfil (`perfis.permissoes`) e pelo plano da ótica.
