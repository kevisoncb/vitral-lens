# Vitra (vitral-lens)

> **Leia este arquivo antes de mexer no projeto e atualize-o ao terminar.**
> Ele é o mapa do projeto: o que existe, o que foi testado, o que falta e o que mudou.
> Toda sessão (sua ou do Claude) começa aqui e termina atualizando as seções
> **Estado**, **Checklist** e **Histórico**.

**Vitra é o sistema que une as três partes de uma ótica num fluxo só:**
**consultório** (exame → receita) → **loja** (orçamento → pagamento) → **laboratório** (ficha técnica → construção do óculos → entrega).
Tudo ligado ao mesmo cliente, sem redigitar nada, com os cards passando de uma área para outra em tempo real.

Plano único de **R$ 99/mês** com tudo incluído. Adicionais pagos: nota fiscal e lojas extras. Foco inicial: óticas pequenas do interior; depois, cidades grandes.

Stack: Next.js 15 (App Router) + React 19 + TypeScript, Supabase (Postgres, Auth, Storage, Realtime), Vercel. CSS puro em `src/app/globals.css`.

---

## 1. Estado

Legenda: ✅ testado · 🟡 escrito, nunca executado · ⬜ não existe

### Banco (`supabase/migrations/`), testado em Postgres 16 e no CI

| Migração | O que faz | Situação |
|---|---|---|
| 0001 | Estrutura multiempresa, RLS, perfis, funil, OS, agenda, tabelas de PDV e financeiro | ✅ |
| 0002 | `otica_id` automático, total do orçamento, `registrar_pagamento()` (sinal/saldo → OS) | ✅ |
| 0003 | Pasta privada das receitas (Storage) | 🟡 só roda no Supabase |
| 0004 | Site, orçamento pelo site, agendamento online, "Sem retorno" automático, proteção do Dono | ✅ |
| 0005 | Consultório (exame → receita), ficha técnica da OS, etapas de produção | ✅ |
| 0006 | Áreas por perfil, quem move cada etapa, cards que conversam, recados, Realtime, plano único + adicionais, produto cadastrado na venda | ✅ |
| 0007 | Fotos de produtos (Storage público) | 🟡 só roda no Supabase |
| 0008 | Desempenho: RLS com `(select ...)`, índices, busca por pedaço do nome | ✅ (teste de carga: `docs/ESCALA.md`) |
| 0009 | Foto do produto: quem cadastrou na venda põe a primeira | ✅ |
| 0010 | Versão 2: importar clientes e produtos de planilha (pula repetidos), lista de espera do Vitra | ✅ |

### Telas (`src/`): todas 🟡, compilam (`typecheck` e `build` passam) mas ainda não foram abertas com um Supabase de verdade

| Área | Tela | Rota |
|---|---|---|
| Todas | Login, Minha conta | `/login`, `/conta` |
| Loja e gestão | Início (consultas de hoje, saídos do consultório, pedidos do site, óculos para avisar, sem retorno) | `/inicio` |
| Loja e gestão | Funil de vendas (Kanban ao vivo, motivo de perda, WhatsApp) | `/vendas` |
| Loja e gestão | Novo atendimento (catálogo ou **produto novo na hora**, receita do cliente) | `/vendas/novo` |
| Loja e gestão | Atendimento: orçamento, sinal/saldo, mover etapa (para celular) | `/vendas/[id]` |
| Loja e gestão | Clientes, ficha com **linha do tempo**, receitas, anotações | `/clientes`, `/clientes/[id]` |
| Loja e gestão | Ordens de serviço: acompanha, avisa e entrega; recados com o laboratório | `/laboratorio`, `/laboratorio/[id]` |
| Loja e gestão | Agenda interna | `/agenda` |
| Loja e gestão | Catálogo com fotos; foto da armação depois da venda | `/catalogo`, `/catalogo/fotos` |
| Gestão | Relatórios do mês | `/relatorios` |
| Gestão | Configurações: ótica e site, lojas, usuários, perfis (área + permissões), horários e bloqueios, funil e motivos | `/configuracoes/...` |
| Consultório | Fila do dia, exame (anamnese, AV, refração, conduta), histórico do paciente | `/consultorio`, `/consultorio/exame/[id]`, `/consultorio/paciente/[id]` |
| Laboratório | Quadro de produção (ao vivo), OS com ficha técnica editável, etapas da construção, recados | `/producao`, `/producao/os/[id]` |
| Laboratório (gerente) | Indicadores: prazo, retrabalho, espera, produção por pessoa | `/producao/indicadores` |
| Gestão | Importar planilha (CSV do Excel ou do Google): clientes e produtos, com prévia e relatório de erros | `/configuracoes/importar` |
| Público | Site da ótica + pedido de orçamento; agendamento online | `/site/[slug]`, `/site/[slug]/agendar` |
| Público | Site do Vitra com preço e lista de espera (quem está logado vai para o sistema) | `/` |
| — | PDV e financeiro (Versão 4) | ⬜ só as tabelas |
| — | Nota fiscal, estoque, comissões (Versão 3) | ⬜ |
| — | Painel do Vitra (criar ótica, adicionais) | ⬜ hoje é SQL |

**Consultas conferidas:** `supabase/tests/conferir_consultas.mjs` lê todo o `src/` e confere, contra o banco com as migrações aplicadas, cada `.from(...).select(...)`, filtro, ordem, insert/update, relação embutida (inclusive ambígua) e `rpc(...)`. Hoje: 128 consultas e 10 chamadas, nenhum problema. Roda no CI.

**Por que tudo 🟡:** `npm install`, `npm run typecheck` e `npm run build` já passam (Next 15.5, 32 rotas), e o servidor sobe: `/login` abre e as rotas protegidas mandam para o login. Falta abrir cada tela ligada a um projeto Supabase real. Os retornos do Supabase ainda não têm tipos gerados (vêm como `any`), então erros de nome de coluna só aparecem rodando.

---

## 2. Checklist (próximos passos, em ordem)

Marque com `[x]` quando terminar e anote no Histórico.

- [x] `npm install`, `npm run typecheck`, corrigir os erros. Commitar `package-lock.json`.
- [ ] `npm audit` aponta o `postcss` embutido no Next 15 (só afeta o build, não o site no ar); a correção só vem no Next 16. Avaliar a migração depois da Versão 1.
- [ ] Criar o projeto no Supabase **na região São Paulo (sa-east-1)**, na conta do dono do produto, e rodar as migrações 0001 → 0009 no SQL Editor.
- [ ] Criar a Ótica Ômega, a loja e o usuário dono (SQL na seção 4).
- [ ] Rodar `supabase/seed_catalogo.sql` (ajustar os preços antes).
- [x] Conferir as consultas das telas contra o banco sem o Supabase (`conferir_consultas.mjs`, no CI).
- [ ] `.env.local` com as chaves e `npm run dev`. Abrir cada tela da tabela acima e trocar 🟡 por ✅.
- [ ] Testar o fluxo das três áreas com três logins (consultório, balcão, laboratório) em três abas:
  - [ ] exame → concluir → card aparece no funil da loja;
  - [ ] orçamento (com um produto novo e foto da armação) → sinal → OS aparece em "Pago" na produção, ao vivo;
  - [ ] laboratório puxa, registra etapas, manda recado, move para "Chegou na loja";
  - [ ] loja vê o recado, avisa pelo WhatsApp, entrega.
- [ ] Testar o site: `/site/omega` publicado, pedido de orçamento vira card; cadastrar horários e testar `/site/omega/agendar`.
- [ ] Testar no celular e no tablet: mover cards pelo botão "Mover para" (arrastar não funciona no toque).
- [ ] (Opcional) pg_cron: `select cron.schedule('sem-retorno', '0 * * * *', 'select mover_sem_retorno()');`
- [ ] Deploy na Vercel (conta do dono, região `gru1`), variáveis de ambiente, domínio da Ômega em `SITE_DOMINIOS`.
- [ ] Gerar tipos: `npx supabase gen types typescript --project-id <id> > src/lib/supabase/tipos.ts` e usar nos clientes.
- [ ] Definir o preço dos adicionais: nota fiscal (sugestão: +R$ 50) e loja extra.
- [ ] Ideias da concorrência para depois: assinatura digital da OS pelo link, medida de DNP pela câmera, entrada de produtos por XML, etiqueta com código de barras.
- [x] Versão 2: importação de planilha (clientes e produtos) e site do Vitra com lista de espera.
- [ ] Importar a planilha de clientes da Ômega (pedir o arquivo do sistema antigo) e conferir o relatório de erros.
- [ ] Planilha `.xlsx` direto (hoje pede salvar como CSV; precisaria de uma biblioteca de leitura de Excel).
- [ ] Ler a lista de espera: hoje só pelo SQL Editor (`select * from lista_espera order by criado_em desc`), até existir o painel do Vitra.
- [ ] Depois: painel do Vitra, PDV e financeiro, nota fiscal via API (Focus NFe, NFe.io).

---

## 3. Regras do produto (não mudar sem combinar)

- **Diferencial:** consultório, loja e laboratório num fluxo só. Cada parte com tela própria; os cards passam de uma para outra.
- **Áreas:** todo perfil tem uma área (`perfis.area`).
  - **Loja:** balcão. Agenda, vendas, clientes, catálogo, acompanhar e entregar a OS.
  - **Consultório:** só exames e histórico do paciente.
  - **Laboratório:** só produção. Não vê valores nem o cadastro de clientes; o nome vem na OS.
  - **Gestão:** tudo, e entra em qualquer área.
  - Quem é do consultório ou do laboratório cai direto na sua tela e não abre a da loja. O **gerente de laboratório** é da área laboratório, com `laboratorio:excluir`, e vê os indicadores.
- **Cards que conversam:**
  - exame concluído → receita → card em "Atendimento" na loja;
  - pagamento → OS em "Pago" no laboratório;
  - laboratório move até "Chegou na loja" → a loja avisa e entrega;
  - recados no card (`os_mensagens`);
  - tudo ao vivo (Supabase Realtime).
- **Quem move cada etapa da OS:** "Pago", "Cliente avisado" e "Entregue" são da loja; "No laboratório", "Em montagem" e "Chegou na loja" são do laboratório; a gestão move qualquer uma. Quem confere é o banco (`os_etapa_permitida`).
- **Exame concluído não muda mais** (é prontuário). Correção = novo exame.
- **Multiempresa:** toda tabela de negócio tem `otica_id` e RLS. Receita e exame são dados de saúde (LGPD).
- **Permissões:** perfil × módulo × ação (`ver`, `criar`, `editar`, `excluir`). Quem decide é o banco (`acesso()`); a tela só esconde botões. O perfil Dono não perde acesso e a ótica nunca fica sem Dono ativo.
- **Plano único:** tudo incluído. Adicionais em `recursos_adicionais` / `otica_adicionais`: nota fiscal e lojas extras (o banco bloqueia a 2ª loja sem o adicional).
- **Produto na venda:** se não estiver no catálogo, o balcão cadastra ali mesmo e ele entra no catálogo. Armação pede foto (reduzida no aparelho antes de enviar); lente não.
- **WhatsApp:** nunca automático. Só link `wa.me` com mensagem pronta (`src/lib/whatsapp.ts`).
- **Funil:** Atendimento → Orçamento enviado → Sem retorno → Recuperado / Perdido. Perdido exige motivo. Card parado vai sozinho para a etapa seguinte.
- **Pagamento:** o primeiro pagamento move o card para a etapa ganha e cria a OS uma única vez.
- **Agenda:** o mesmo horário nunca é marcado duas vezes. O site só vê horários livres.
- **Site público:** só funções `security definer` liberadas para `anon`, com limite de uso e aceite LGPD.
- **Importação de planilha:** nunca apaga nem sobrescreve; cliente repetido (mesmo telefone ou CPF) e produto repetido (mesmo código, ou mesmo nome na categoria) são pulados. O banco confere a permissão de quem importa.
- **Agilidade:**
  - o card muda na tela antes de o banco confirmar;
  - as telas atualizam sozinhas;
  - aparece um esqueleto na troca de tela;
  - toda regra de segurança nova usa `(select função())`, para não ficar lenta com muitas óticas.
- **Service role** só no servidor e só para o Auth (criar login).
- Código, domínio, Supabase e Vercel ficam no nome do dono do produto.

---

## 4. Como rodar

1. Supabase (região São Paulo) → SQL Editor: rode `supabase/migrations/0001` a `0009`, em ordem.
2. Primeira ótica e usuário dono (Authentication → Users → criar usuário; depois no SQL Editor):

```sql
insert into oticas (nome, status, slug) values ('Ótica Ômega', 'ativa', 'omega') returning id;
insert into lojas (otica_id, nome) values ('<id da ótica>', 'Loja Centro');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select '<id do usuário no Auth>', '<id da ótica>', id, 'Nome do dono', 'email@exemplo.com'
from perfis where otica_id = '<id da ótica>' and chave = 'dono';
-- adicional contratado (exemplo): insert into otica_adicionais (otica_id, recurso) values ('<id>', 'nota_fiscal');
```

3. `supabase/seed_catalogo.sql` para o catálogo de exemplo.
4. `cp .env.example .env.local`, preencher as chaves, `npm install`, `npm run dev`.
5. Funcionários: o dono cria em **Configurações → Usuários** e escolhe o perfil. A área do perfil decide a tela da pessoa. O sistema gera uma senha temporária; a pessoa troca em **Minha conta**.

## 5. Testar o banco sem Supabase

```bash
psql -f supabase/tests/stub_supabase.sql
for m in supabase/migrations/0*.sql; do psql -v ON_ERROR_STOP=1 -f "$m"; done
psql -f supabase/tests/rls_smoke.sql          # permissões e isolamento
psql -f supabase/tests/pagamento_smoke.sql    # sinal, saldo, OS automática
psql -f supabase/tests/site_smoke.sql         # site, agendamento online, Sem retorno, Dono
psql -f supabase/tests/consultorio_smoke.sql  # exame → receita → OS com ficha → produção
psql -f supabase/tests/areas_smoke.sql        # áreas, cards que conversam, plano, produto na venda
psql -f supabase/tests/versao2_smoke.sql      # importação de planilhas, lista de espera
node supabase/tests/conferir_consultas.mjs    # as consultas das telas batem com o banco (precisa do npm install)
```

Cada teste imprime as linhas esperadas e alguns erros de propósito: eles provam que o bloqueio funciona. O GitHub Actions (`.github/workflows/ci.yml`) roda tudo a cada push e confere as linhas. O teste de carga (1.000 óticas) está em `supabase/carga/` e os resultados em `docs/ESCALA.md`.

## 6. Mapa do código

```
supabase/migrations/   uma migração por mudança; nunca editar uma já aplicada em produção
supabase/tests/        testes do banco (stub do Supabase + testes de fumaça)
supabase/carga/        teste de carga (gerar dados, medir telas, usuários simultâneos)
docs/ESCALA.md         capacidade medida, custo por fase, plano de crescimento
src/lib/               supabase (servidor, navegador, público, admin), sessão e áreas, permissões, OS, formatação, WhatsApp
src/components/        barra das áreas, tempo real (AoVivo), linha do tempo, OS (quadro, ficha, recados, painel)
src/app/acoes/         Server Actions compartilhadas (OS)
src/app/(app)/         tela da loja e da gestão (menu lateral)
src/app/consultorio/   tela do consultório
src/app/producao/      tela do laboratório
src/app/site/[slug]/   site público da ótica e agendamento online (sem login)
src/app/conta/         minha conta (qualquer área)
```

---

## 7. Histórico

Mais recente em cima. Uma linha por sessão: data, o que mudou, o que ficou pendente.

- **2026-10-29 (7)** — Versão 2: migração 0010 (importar_clientes, importar_produtos, lista_espera + entrar_lista_espera, índices por telefone/CPF só com números), teste `versao2_smoke.sql` no CI. Telas: importar planilha (`/configuracoes/importar`, leitura do CSV no navegador em `src/lib/planilha.ts`) e site do Vitra em `/`.
  - Pendente: `.xlsx` direto; tela para ler a lista de espera (painel do Vitra).
- **2026-10-29 (6)** — Conferidor das consultas (`supabase/tests/conferir_consultas.mjs`, no CI): 128 consultas e 10 rpc das telas batem com o banco. Não deu para subir o Supabase local (registros de imagem Docker bloqueados e download do PostgREST/GoTrue barrado neste ambiente).
  - Pendente: abrir as telas com um Supabase de verdade.
- **2026-10-29 (5)** — Primeiro `npm install` (Next 15.5.28, React 19.3, supabase-js 2.118, @supabase/ssr 0.6.1); `package-lock.json` commitado. Typecheck tinha só 10 erros (parâmetro `setAll` sem tipo em `servidor.ts` e `middleware.ts`), corrigidos. `npm run build` passa e `next start` responde. CI do aplicativo agora usa `npm ci` e roda também o build.
  - Pendente: Supabase real, `.env.local` e abrir cada tela; tipos gerados do banco.
- **2026-10-29 (4)** — Novo posicionamento: consultório + loja + laboratório num fluxo só; plano único de R$ 99 com adicionais (nota fiscal, lojas extras).
  - Migrações 0005 a 0009: consultório (exame que gera receita), ficha técnica e produção da OS, áreas por perfil, quem move cada etapa, cards que conversam, recados, Realtime, gerente de laboratório, produto cadastrado na venda com foto, desempenho.
  - Teste de carga com 1.000 óticas: funil de 366 ms para 2 ms; cerca de 1.100 telas por segundo com 100 conexões. Resultados em `docs/ESCALA.md`.
  - Telas novas: consultório, produção, indicadores do lab, OS com recados, linha do tempo do cliente, foto da armação, mover etapa pelo celular, esqueleto de carregamento.
  - Pendente: compilar e rodar (sem npm no ambiente).
- **2026-10-29 (3)** — Migração 0004 (site, orçamento pelo site, agendamento online, Sem retorno automático, proteção do Dono). Telas: Início, Catálogo, Configurações, Relatórios, Minha conta, site público e agendamento. README virou documento vivo.
- **2026-10-29 (2)** — Migrações 0002 (pagamento, OS automática) e 0003 (Storage). Telas de clientes, receitas, novo atendimento, pagamento, laboratório e agenda.
- **2026-10-29 (1)** — Base: migração 0001 testada, login, menu, funil Kanban, CI, CLAUDE.md.
