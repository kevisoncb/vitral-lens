# Vitra (vitral-lens)

> **Leia este arquivo antes de mexer no projeto e atualize-o ao terminar.**
> Ele é o mapa do projeto: o que existe, o que foi testado, o que falta e o que mudou.
> Toda sessão (sua ou do Claude) começa aqui e termina atualizando as seções
> **Estado**, **Checklist** e **Histórico**.

Sistema web para óticas: funil de vendas, laboratório, clientes com receitas, agenda e site institucional com pedido de orçamento e agendamento online. Multiempresa (uma instalação atende várias óticas), responsivo (computador, tablet, celular). Cliente piloto: **Ótica Ômega**.

Stack: Next.js 15 (App Router) + React 19 + TypeScript, Supabase (Postgres, Auth, Storage), Vercel. CSS puro em `src/app/globals.css`.

---

## 1. Estado

Legenda: ✅ testado · 🟡 escrito, nunca executado · ⬜ não existe

| Parte | Situação | Onde |
|---|---|---|
| Banco: estrutura, RLS, perfis, planos, funil, OS, agenda | ✅ | `supabase/migrations/0001_base_multiempresa.sql` |
| Banco: pagamento sinal/saldo, OS automática, total do orçamento | ✅ | `0002_pagamento_e_atalhos.sql` |
| Banco: pasta privada das receitas (Storage) | 🟡 só roda no Supabase | `0003_storage_receitas.sql` |
| Banco: site, orçamento pelo site, agendamento online, Sem retorno automático, proteção do Dono | ✅ | `0004_site_e_agendamento.sql` |
| Login, middleware, menu por perfil e plano | 🟡 | `src/middleware.ts`, `src/app/login`, `src/app/(app)/layout.tsx` |
| Início (o que fazer hoje) | 🟡 | `/inicio` |
| Funil de vendas (Kanban, motivo de perda, WhatsApp) | 🟡 | `/vendas` |
| Novo atendimento com orçamento por catálogo | 🟡 | `/vendas/novo` |
| Detalhe do atendimento, sinal e saldo | 🟡 | `/vendas/[id]` |
| Clientes, ficha, anotações | 🟡 | `/clientes`, `/clientes/[id]` |
| Receita (OD/OE, lente de contato, anexo) | 🟡 | `/clientes/[id]/receita/nova` |
| Laboratório (Kanban de OS, prazos, WhatsApp em "Chegou na loja") | 🟡 | `/laboratorio` |
| Agenda interna (dia, status, confirmação manual) | 🟡 | `/agenda` |
| Catálogo | 🟡 | `/catalogo` |
| Configurações: ótica e site, lojas | 🟡 | `/configuracoes` |
| Configurações: usuários (cria login com senha temporária) | 🟡 | `/configuracoes/usuarios` |
| Configurações: perfis e permissões (matriz) | 🟡 | `/configuracoes/perfis` |
| Configurações: horários de atendimento e bloqueios | 🟡 | `/configuracoes/agenda` |
| Configurações: etapas do funil e motivos de perda | 🟡 | `/configuracoes/funil` |
| Relatórios do mês | 🟡 | `/relatorios` |
| Minha conta (trocar senha) | 🟡 | `/conta` |
| Site público da ótica + pedido de orçamento | 🟡 | `/site/[slug]` |
| Agendamento online pelo site | 🟡 | `/site/[slug]/agendar` |
| PDV e financeiro (Versão 4) | ⬜ só as tabelas | `[modulo]` mostra "em construção" |
| Nota fiscal, estoque, comissões (Versão 3) | ⬜ | |
| Painel do Vitra (super admin: criar ótica, mudar plano) | ⬜ | hoje é SQL na mão |

**Por que tanta coisa 🟡:** o código de `src/` foi escrito num ambiente sem acesso ao npm. A sintaxe de todos os arquivos foi conferida, mas nunca rodou `npm install`, `typecheck` nem o navegador. Espere erros de tipo pequenos no primeiro `npm run typecheck` (principalmente nos retornos do Supabase, que ainda não têm tipos gerados).

---

## 2. Checklist (próximos passos, em ordem)

Marque com `[x]` quando terminar e anote no Histórico.

- [ ] `npm install`, `npm run typecheck`, corrigir os erros. Commitar `package-lock.json`.
- [ ] Criar o projeto no Supabase (conta do dono do produto) e rodar as migrações 0001 → 0004 no SQL Editor.
- [ ] Criar a Ótica Ômega, a loja e o usuário dono (SQL na seção 4). Definir o slug: `update oticas set slug = 'omega' where nome = 'Ótica Ômega';`
- [ ] Rodar `supabase/seed_catalogo.sql` (ajustar os preços antes).
- [ ] `.env.local` com as chaves e `npm run dev`. Abrir cada tela da tabela acima e trocar 🟡 por ✅.
- [ ] Testar o fluxo inteiro: cliente → receita → atendimento → orçamento → sinal → OS no laboratório → "Chegou na loja" → WhatsApp → Entregue.
- [ ] Testar o site: `/site/omega` publicado, pedido de orçamento vira card em Atendimento; cadastrar horários e testar `/site/omega/agendar`.
- [ ] (Opcional) Ativar o pg_cron no Supabase: `select cron.schedule('sem-retorno', '0 * * * *', 'select mover_sem_retorno()');` (sem ele, o "Sem retorno" é aplicado quando alguém abre o funil).
- [ ] Deploy na Vercel (conta do dono), variáveis de ambiente, domínio da Ômega em `SITE_DOMINIOS`.
- [ ] Gerar tipos: `npx supabase gen types typescript --project-id <id> > src/lib/supabase/tipos.ts` e usar nos clientes.
- [ ] Depois: painel do Vitra (super admin), importação de planilha, multiloja, PDV e financeiro.

---

## 3. Regras do produto (não mudar sem combinar)

- **Multiempresa:** toda tabela de negócio tem `otica_id` e RLS. Receita é dado de saúde (LGPD).
- **Permissões:** perfil × módulo × ação (`ver`, `criar`, `editar`, `excluir`) em `perfis.permissoes`, e o plano libera módulos em `plano_recursos`. Quem decide é o banco (`acesso()`); a tela só esconde botões. O perfil Dono não pode perder acesso e a ótica nunca fica sem Dono ativo (triggers da 0004).
- **WhatsApp:** nunca automático. Só link `wa.me` com mensagem pronta (`src/lib/whatsapp.ts`).
- **Funil:** Atendimento → Orçamento enviado → Sem retorno → Recuperado / Perdido. Perdido exige motivo. Card parado além de "dias parado" vai sozinho para a etapa seguinte.
- **Pagamento:** o primeiro pagamento (sinal ou total) move o card para a etapa ganha e cria a OS uma única vez (`registrar_pagamento()`).
- **Laboratório:** Pago → No laboratório → Em montagem → Chegou na loja → Cliente avisado → Entregue. O laboratório não vê valores. Entregue grava a data e a garantia de 6 meses.
- **Agenda:** o mesmo horário nunca é marcado duas vezes. O site só vê horários livres, nunca nomes.
- **Site público:** só funções `security definer` liberadas para `anon` (`site_da_otica`, `pedido_orcamento_site`, `horarios_livres`, `agendar_pelo_site`), com limite de pedidos por telefone e por hora, e aceite LGPD obrigatório.
- **Planos:** Essencial (clientes, receitas, funil, laboratório), Profissional (+ agenda, agendamento online, relatórios, PDV e financeiro), Rede (sob orçamento: multiloja, comissões, nota fiscal, PDV e financeiro aprimorados).
- **Service role** (`SUPABASE_SERVICE_ROLE_KEY`) só no servidor e só para o Auth (criar login). Nunca no navegador, nunca em commit.
- Código, domínio, Supabase e Vercel ficam no nome do dono do produto.

---

## 4. Como rodar

1. Supabase → SQL Editor, nesta ordem: `0001_base_multiempresa.sql`, `0002_pagamento_e_atalhos.sql`, `0003_storage_receitas.sql`, `0004_site_e_agendamento.sql`.
2. Primeira ótica e usuário dono (Authentication → Users → criar usuário; depois no SQL Editor):

```sql
insert into oticas (nome, plano, status, slug) values ('Ótica Ômega', 'profissional', 'ativa', 'omega') returning id;
insert into lojas (otica_id, nome) values ('<id da ótica>', 'Loja Centro');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select '<id do usuário no Auth>', '<id da ótica>', id, 'Nome do dono', 'email@exemplo.com'
from perfis where otica_id = '<id da ótica>' and chave = 'dono';
```

3. `supabase/seed_catalogo.sql` para o catálogo de exemplo.
4. `cp .env.example .env.local`, preencher as chaves, `npm install`, `npm run dev`.
5. Funcionários: o dono cria em **Configurações → Usuários** (gera senha temporária; a pessoa troca em **Minha conta**).

## 5. Testar o banco sem Supabase

```bash
psql -f supabase/tests/stub_supabase.sql
for m in supabase/migrations/000*.sql; do psql -v ON_ERROR_STOP=1 -f "$m"; done
psql -f supabase/tests/rls_smoke.sql        # erros "row-level security" e "Informe o motivo da perda" são esperados
psql -f supabase/tests/pagamento_smoke.sql  # erros "valor maior que zero" e "Sem permissão" são esperados
psql -f supabase/tests/site_smoke.sql       # erros de limite, horário ocupado e proteções do Dono são esperados
```

O GitHub Actions (`.github/workflows/ci.yml`) roda tudo isso a cada push e confere as linhas esperadas.

## 6. Mapa do código

```
supabase/migrations/   uma migração por mudança; nunca editar uma já aplicada em produção
supabase/tests/        testes do banco (stub do Supabase + testes de fumaça)
src/lib/               supabase (servidor, público, admin), permissões, sessão, formatação, WhatsApp
src/app/login/         tela de login
src/app/(app)/         sistema logado (menu lateral): inicio, vendas, clientes, laboratorio, agenda,
                       catalogo, relatorios, configuracoes, conta, [modulo] = "em construção"
src/app/site/[slug]/   site público da ótica e agendamento online (sem login)
```

---

## 7. Histórico

Mais recente em cima. Uma linha por sessão: data, o que mudou, o que ficou pendente.

- **2026-10-29 (3)** — Migração 0004 (site, orçamento pelo site, agendamento online, Sem retorno automático, proteção do Dono, revoke de funções para anon) com `site_smoke.sql` no CI. Telas: Início, Catálogo, Configurações (ótica/site, lojas, usuários, perfis, horários, bloqueios, funil, motivos), Relatórios, Minha conta, site público e agendamento. README virou este documento vivo. Pendente: compilar e rodar (sem npm no ambiente).
- **2026-10-29 (2)** — Migrações 0002 (pagamento, OS automática, otica_id automático) e 0003 (Storage). Telas de clientes, receitas, novo atendimento, pagamento, laboratório e agenda.
- **2026-10-29 (1)** — Base: migração 0001 testada, login, menu, funil Kanban, CI, CLAUDE.md.
