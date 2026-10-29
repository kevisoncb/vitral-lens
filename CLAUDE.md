# Vitra: contexto do projeto

## Regra número 1: o README.md é o mapa

- **Antes de qualquer tarefa**, leia `README.md` inteiro (Estado, Checklist, Regras, Histórico).
- **Ao terminar**, atualize o `README.md` no mesmo commit: a tabela de Estado (✅ testado, 🟡 escrito sem rodar, ⬜ não existe), o Checklist (marque o que fez, acrescente o que descobriu) e uma linha nova no topo do Histórico com data, o que mudou e o que ficou pendente.
- Se uma regra do produto mudar, mude nos dois lugares (README e aqui).

**Diferencial:** consultório (exame → receita) + loja (orçamento → pagamento) + laboratório (construção do óculos → entrega) num fluxo só, cada área com tela própria e os cards conversando entre elas em tempo real. Plano único de R$ 99 com adicionais (nota fiscal, lojas extras). Foco: óticas pequenas do interior, depois cidade grande.

Sistema web (SaaS) para óticas, criado por um freelancer para o cliente piloto **Ótica Ômega** e depois vendido a outras óticas. Nome do produto: **Vitra**. Repositório: `vitral-lens` ("lens" é só diferencial do nome do repositório).

Idioma: português do Brasil em tudo (interface, tabelas, colunas, nomes de variáveis do domínio, commits).

## Stack

Next.js 15 (App Router) + React 19 + TypeScript, Supabase (Postgres, Auth, Storage), hospedagem na Vercel. CSS simples em `src/app/globals.css` (sem Tailwind). Somente web, responsivo (computador, tablet, celular), com PWA no futuro.

## Regras do produto (não mudar sem combinar)

- **Multiempresa:** toda tabela de negócio tem `otica_id` e RLS. Uma ótica nunca vê dados de outra. Receita é dado de saúde (LGPD).
- **Áreas:** todo perfil tem `area` (loja, consultorio, laboratorio, gestao, pdv, financeiro). Consultório, laboratório, PDV e financeiro têm telas próprias (`/consultorio`, `/producao`, `/pdv`, `/financeiro`) e não abrem a da loja; gestão entra em todas. Use `exigirArea()` em toda tela de área. Laboratório não vê valores nem a tabela de clientes (nome vem em `ordens_servico.cliente_nome`).
- **Cards que conversam:** exame concluído → card na loja (`card_do_exame`); pagamento → OS em "Pago" no lab; lab até "Chegou na loja" → loja avisa e entrega; recados em `os_mensagens`. Etapa da OS tem `area` e o banco confere quem move (`os_etapa_permitida`). Telas com cards usam `<AoVivo tabelas={[...]}/>`.
- **Permissões:** por perfil e por módulo (`ver`, `criar`, `editar`, `excluir`) em `perfis.permissoes`; adicionais pagos em `otica_adicionais`. A checagem real é no banco (`acesso()`); o menu só esconde o que não pode.
- **WhatsApp:** nunca automático. Só link `wa.me` com mensagem pronta (`src/lib/whatsapp.ts`). Confirmação de consulta também é manual.
- **Funil de vendas:** Atendimento → Orçamento enviado → Sem retorno → Recuperado / Perdido. Mover para Perdido exige motivo (regra no banco, trigger `atendimento_mudou`).
- **Laboratório:** Pago → No laboratório → Em montagem → Chegou na loja → Cliente avisado → Entregue. Ao registrar o pagamento, a OS é criada (`registrar_pagamento()` → `criar_os_do_atendimento()`) com a ficha técnica preenchida pela receita e pelo orçamento. Pago, Cliente avisado e Entregue são da loja; No laboratório, Em montagem e Chegou na loja são do laboratório. Exame concluído não muda mais (prontuário).
- **Agenda:** o mesmo horário nunca é marcado duas vezes (constraint `consulta_sem_conflito`). O site de agendamento usa `horarios_ocupados()`, que expõe só os horários.
- **Plano único (R$ 99):** tudo incluído. Adicionais em `recursos_adicionais`/`otica_adicionais` (nota fiscal, lojas extras); `recurso_ativo()` só bloqueia o que é adicional. `oticas.plano` e `plano_recursos` ficaram só por compatibilidade.
- **Produto na venda:** não achou no catálogo, cadastra na hora (`criado_na_venda`); armação pede foto (`/catalogo/fotos`, reduzida no navegador); lente não.
- **PDV e financeiro (Versão 4):** módulos separados no mesmo projeto, com login e menu próprios. O PDV mostra só vendas; o financeiro (gerente) tem contas a pagar e a receber, custos, impostos e acesso do contador (perfil Contador, só leitura). Venda do PDV só por `registrar_venda()` (preço do catálogo; desconto acima de 10% exige `pdv:editar`; crediário vira conta a receber); só o gerente cancela (`cancelar_venda()` devolve ao estoque).
- **Pagamento:** o primeiro pagamento move o card para a etapa ganha e cria a OS uma única vez (`registrar_pagamento()`).
- **Site público:** só funções liberadas para `anon` (`site_da_otica`, `pedido_orcamento_site`, `horarios_livres`, `agendar_pelo_site`, e `entrar_lista_espera` do site do Vitra em `/`), com limite de uso e aceite LGPD. O perfil Dono não perde acesso e a ótica nunca fica sem Dono ativo.
- **Estoque e comissões (Versão 3):** o primeiro pagamento do atendimento dá baixa no estoque (só itens com `controla_estoque`) e gera a comissão (trigger `venda_fechada`). O livro `estoque_movimentos` e `comissoes` só mudam por funções do banco. A venda nunca é bloqueada por falta de estoque.
- **Importação de planilha:** nunca apaga nem sobrescreve; repetidos (telefone/CPF do cliente, código ou nome do produto) são pulados (`importar_clientes()`, `importar_produtos()`).
- Código, domínio, Supabase e Vercel ficam no nome do dono do produto, nunca do freelancer.

## Fases

1. **Versão 1 (Ótica Ômega):** contas e permissões, clientes e receitas, funil, laboratório, agenda interna, site institucional da ótica.
2. **Versão 2:** agendamento online pelo site, relatórios, multiloja, importação de planilhas, site e lista de espera do Vitra (prontos).
3. **Versão 3:** nota fiscal, estoque, comissões (estoque e comissões prontos; nota fiscal espera a escolha da API).
4. **Versão 4:** PDV e financeiro (prontos).

## Estado atual e próximos passos

Ficam no `README.md` (seções 1 e 2), para não ter duas versões. Resumo: banco testado (0001 a 0013); o `src/` já compila (`npm run typecheck` e `npm run build` passam), mas as telas ainda não foram abertas com um Supabase real; o próximo passo é criar o projeto no Supabase, `.env.local` e `npm run dev`.

## Telas de referência

O desenho das telas (login, funil, laboratório, ficha do cliente, agenda, agendamento no celular, PDV e financeiro) foi feito num canvas e exportado como imagens e PDF. Cores: verde-escuro `#12302C`, verde `#0F6E64`, fundo `#F4F6F4`; fonte Plus Jakarta Sans. As variáveis estão em `src/app/globals.css`.

## Como trabalhar aqui

- Mudou o banco? Crie uma nova migração em `supabase/migrations/` (nunca edite a antiga depois de aplicada em produção), rode os testes da seção 5 do README, acrescente um teste novo em `supabase/tests/` (e no CI) para a regra que criou e rode `npm run tipos` para atualizar `src/lib/supabase/tipos.ts` (o CI confere).
- Toda tabela nova de negócio: `otica_id`, RLS e entrada na lista do bloco `do $$` do final da migração (ou política própria).
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no navegador. Nunca commitar `.env*` (só `.env.example`).
- **Desempenho:** em política de RLS, sempre `(select minha_otica())`, `(select acesso(...))`, `(select auth.uid())` (a 0008 converteu as existentes). Índice para toda coluna usada em filtro de tela. Depois de mudança grande no banco, rode `supabase/carga/` e atualize `docs/ESCALA.md`.
- **Agilidade:** card muda na tela antes de o banco confirmar (atualização otimista), `loading.tsx` em cada área, e botão "Mover para" além de arrastar (toque não arrasta).
- Funções para o público (site): `security definer`, `grant execute ... to anon`, validação e limite de uso dentro da função. Funções internas: `revoke execute ... from anon` (no Supabase, funções novas nascem executáveis por anon).
- Commits e comentários em português.
