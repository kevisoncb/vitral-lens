# Vitra: contexto do projeto

Sistema web (SaaS) para óticas, criado por um freelancer para o cliente piloto **Ótica Ômega** e depois vendido a outras óticas. Nome do produto: **Vitra**. Repositório: `vitral-lens` ("lens" é só diferencial do nome do repositório).

Idioma: português do Brasil em tudo (interface, tabelas, colunas, nomes de variáveis do domínio, commits).

## Stack

Next.js 15 (App Router) + React 19 + TypeScript, Supabase (Postgres, Auth, Storage), hospedagem na Vercel. CSS simples em `src/app/globals.css` (sem Tailwind). Somente web, responsivo (computador, tablet, celular), com PWA no futuro.

## Regras do produto (não mudar sem combinar)

- **Multiempresa:** toda tabela de negócio tem `otica_id` e RLS. Uma ótica nunca vê dados de outra. Receita é dado de saúde (LGPD).
- **Permissões:** por perfil e por módulo (`ver`, `criar`, `editar`, `excluir`) em `perfis.permissoes`, mais liberação por plano em `plano_recursos`. A checagem real é no banco (`acesso()`); o menu só esconde o que não pode.
- **WhatsApp:** nunca automático. Só link `wa.me` com mensagem pronta (`src/lib/whatsapp.ts`). Confirmação de consulta também é manual.
- **Funil de vendas:** Atendimento → Orçamento enviado → Sem retorno → Recuperado / Perdido. Mover para Perdido exige motivo (regra no banco, trigger `atendimento_mudou`).
- **Laboratório:** Pago → No laboratório → Em montagem → Chegou na loja → Cliente avisado → Entregue. Ao marcar o atendimento como pago, a OS é criada por `criar_os_do_atendimento()`. O laboratório não vê valores.
- **Agenda:** o mesmo horário nunca é marcado duas vezes (constraint `consulta_sem_conflito`). O site de agendamento usa `horarios_ocupados()`, que expõe só os horários.
- **Planos:** Essencial (clientes, receitas, funil, laboratório), Profissional (+ agenda, agendamento online, relatórios, PDV e financeiro) e Rede (sob orçamento, versão aprimorada de PDV e financeiro, multiloja, comissões, nota fiscal).
- **PDV e financeiro (Versão 4):** módulos separados no mesmo projeto, com login e menu próprios. O PDV mostra só vendas; o financeiro (gerente) tem contas a pagar e a receber, custos, impostos e acesso do contador. As tabelas já existem; as telas ainda não.
- Código, domínio, Supabase e Vercel ficam no nome do dono do produto, nunca do freelancer.

## Fases

1. **Versão 1 (Ótica Ômega):** contas e permissões, clientes e receitas, funil, laboratório, agenda interna, site institucional da ótica.
2. **Versão 2:** agendamento online pelo site, relatórios, multiloja, importação de planilhas, site e lista de espera do Vitra.
3. **Versão 3:** nota fiscal, estoque, comissões.
4. **Versão 4:** PDV e financeiro.

## Estado atual

Pronto e testado: `supabase/migrations/0001_base_multiempresa.sql` (testado em Postgres 16 com `supabase/tests`, também rodado no CI).

Escrito mas **nunca compilado nem executado** (foi feito sem acesso ao npm): `src/` com login, middleware, menu por permissão e plano, funil de vendas em Kanban com arrastar e soltar. O primeiro passo é `npm install`, `npm run typecheck` e `npm run dev`, corrigindo o que aparecer.

Ainda não existem telas de: clientes e receitas, laboratório, agenda, configurações, relatórios, PDV, financeiro. O menu já aponta para elas e hoje mostra "em construção" (`src/app/(app)/[modulo]/page.tsx`).

## Próximos passos, em ordem

1. Instalar, rodar e corrigir o que o TypeScript e o navegador apontarem. Commitar `package-lock.json`.
2. Criar o projeto no Supabase, rodar a migração e criar a ótica Ômega e o usuário dono (passo a passo no `README.md`).
3. Clientes e ficha de receita (OD/OE, esférico, cilíndrico, eixo, adição, DNP, altura, prisma, base; lente de contato; anexo da foto da receita).
4. Kanban do laboratório, com botão de WhatsApp em "Chegou na loja".
5. Cadastro de atendimento novo, orçamento com catálogo e registro de pagamento (sinal e saldo) no funil.
6. Agenda interna.
7. Site institucional da Ótica Ômega, com formulário de orçamento que vira card em Atendimento.

## Telas de referência

O desenho das telas (login, funil, laboratório, ficha do cliente, agenda, agendamento no celular, PDV e financeiro) foi feito num canvas e exportado como imagens e PDF. Cores: verde-escuro `#12302C`, verde `#0F6E64`, fundo `#F4F6F4`; fonte Plus Jakarta Sans. As variáveis estão em `src/app/globals.css`.

## Como trabalhar aqui

- Mudou o banco? Crie uma nova migração em `supabase/migrations/` (nunca edite a antiga depois de aplicada em produção) e rode o teste: `psql -f supabase/tests/stub_supabase.sql` e depois a migração e `supabase/tests/rls_smoke.sql`. Os erros "row-level security" e "Informe o motivo da perda" nessa saída são esperados.
- Toda tabela nova de negócio: `otica_id`, RLS e entrada na lista do bloco `do $$` do final da migração (ou política própria).
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no navegador. Nunca commitar `.env*` (só `.env.example`).
- Commits e comentários em português.
