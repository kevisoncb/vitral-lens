# Vitra: contexto do projeto

## Regra número 1: o README.md é o mapa

- **Antes de qualquer tarefa**, leia `README.md` inteiro (Estado, Checklist, Regras, Histórico).
- **Ao terminar**, atualize o `README.md` no mesmo commit: a tabela de Estado (✅ testado, 🟡 escrito sem rodar, ⬜ não existe), o Checklist (marque o que fez, acrescente o que descobriu) e uma linha nova no topo do Histórico com data, o que mudou e o que ficou pendente.
- Se uma regra do produto mudar, mude nos dois lugares (README e aqui).

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
- **Pagamento:** o primeiro pagamento move o card para a etapa ganha e cria a OS uma única vez (`registrar_pagamento()`).
- **Site público:** só funções liberadas para `anon` (`site_da_otica`, `pedido_orcamento_site`, `horarios_livres`, `agendar_pelo_site`), com limite de uso e aceite LGPD. O perfil Dono não perde acesso e a ótica nunca fica sem Dono ativo.
- Código, domínio, Supabase e Vercel ficam no nome do dono do produto, nunca do freelancer.

## Fases

1. **Versão 1 (Ótica Ômega):** contas e permissões, clientes e receitas, funil, laboratório, agenda interna, site institucional da ótica.
2. **Versão 2:** agendamento online pelo site, relatórios, multiloja, importação de planilhas, site e lista de espera do Vitra.
3. **Versão 3:** nota fiscal, estoque, comissões.
4. **Versão 4:** PDV e financeiro.

## Estado atual e próximos passos

Ficam no `README.md` (seções 1 e 2), para não ter duas versões. Resumo: banco testado (0001 a 0004); todo o `src/` foi escrito sem npm e ainda não foi compilado nem executado, então o primeiro passo é `npm install` + `npm run typecheck` + `npm run dev`.

## Telas de referência

O desenho das telas (login, funil, laboratório, ficha do cliente, agenda, agendamento no celular, PDV e financeiro) foi feito num canvas e exportado como imagens e PDF. Cores: verde-escuro `#12302C`, verde `#0F6E64`, fundo `#F4F6F4`; fonte Plus Jakarta Sans. As variáveis estão em `src/app/globals.css`.

## Como trabalhar aqui

- Mudou o banco? Crie uma nova migração em `supabase/migrations/` (nunca edite a antiga depois de aplicada em produção) e rode os testes da seção 5 do README e acrescente um teste novo em `supabase/tests/` (e no CI) para a regra que criou.
- Toda tabela nova de negócio: `otica_id`, RLS e entrada na lista do bloco `do $$` do final da migração (ou política própria).
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no navegador. Nunca commitar `.env*` (só `.env.example`).
- Funções para o público (site): `security definer`, `grant execute ... to anon`, validação e limite de uso dentro da função. Funções internas: `revoke execute ... from anon` (no Supabase, funções novas nascem executáveis por anon).
- Commits e comentários em português.
