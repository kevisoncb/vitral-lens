# Vitral (vitral-lens)

> **Leia este arquivo antes de mexer no projeto e atualize-o ao terminar.**
> Ele é o mapa do projeto: o que existe, o que foi testado, o que falta e o que mudou.
> Toda sessão (sua ou do Claude) começa aqui e termina atualizando as seções
> **Estado**, **Checklist** e **Histórico**.

**Vitral é o sistema que une as três partes de uma ótica num fluxo só:**
**consultório** (exame → receita) → **loja** (orçamento → pagamento) → **laboratório** (ficha técnica → construção do óculos → entrega).
Tudo ligado ao mesmo cliente, sem redigitar nada, com os cards passando de uma área para outra em tempo real.

Dois planos: **Essencial, R$ 99/mês** (consultório, loja, laboratório, agenda, clientes, estoque, site) e **Especial, R$ 199/mês** (tudo do Essencial + PDV e caixa + notas fiscais: NFC-e no caixa e entrada pela nota do fornecedor). Loja extra: + R$ 49/mês. Notas fiscais avulsas no Essencial: preço a definir. Preços em `src/lib/planos.ts` e em `recursos_adicionais`. Foco inicial: óticas pequenas do interior; depois, cidades grandes.

Stack: Next.js 15 (App Router) + React 19 + TypeScript, Supabase (Postgres, Auth, Storage, Realtime), Firebase App Hosting (servidor do Next.js; `apphosting.yaml`). CSS puro em `src/app/globals.css`.

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
| 0010 | Versão 2: importar clientes e produtos de planilha (pula repetidos), lista de espera do Vitral | ✅ |
| 0011 | Versão 3: estoque por loja (livro de movimentos, baixa na venda, contagem, transferência) e comissões (regras, cálculo no pagamento, pagamento) | ✅ |
| 0012 | Versão 4: áreas `pdv` e `financeiro`, perfil Contador, caixa, venda no PDV (crediário, estoque, comissão, cancelamento), categorias de custo, alíquota | ✅ |
| 0013 | `otica_id` automático em horários, lojas, perfis, motivos e etapas (o cadastro de horários falhava) | ✅ |
| 0014 | Painel do Vitral: `vitral_admins` e funções `painel_*` (óticas, criar ótica com dono, adicionais, situação, lista de espera) | ✅ |
| 0015 | Código interno para etiqueta (`gerar_codigos_catalogo()`: 2 + 9 dígitos, pula os já usados) | ✅ |
| 0016 | Entrada pelo XML da NF-e do fornecedor (`notas_entrada`, `registrar_entrada_nfe()`): catálogo, estoque com custo e parcelas a pagar numa transação; a mesma nota não entra duas vezes | ✅ |
| 0017 | Impostos e custo no produto: NCM, CEST, origem, CFOP, CSOSN/CST, alíquota ICMS, cClassTrib (IBS/CBS), unidade; insumos e impostos em R$ ou em % da compra (`insumos_valor/tipo`, `impostos_valor/tipo`), `custo_final` gerado, `margem_pct` (% sobre o custo final). A entrada pela nota só atualiza a compra do produto que existe (com margem definida, o preço acompanha); produto novo entra fora da venda (sem preço); não sobrescreve o fiscal já corrigido | ✅ |
| 0019 | Clientes para chamar: `clientes_para_chamar()` (aniversário em 7 dias, receita vencendo, óculos há 1 ano, orçamento perdido há 1 a 6 meses; só quem tem telefone; 29/02 vira 28/02) e `cliente_contatos` (marcou "chamei", sai da lista do ciclo; só se acrescenta) | ✅ |
| 0020 | LGPD do cliente: `acessos_dados_cliente` (quem viu receita ou exame, exportou ou anonimizou; só se acrescenta; só o dono vê), `exportar_cliente()` (tudo num JSON), `anonimizar_cliente()` (some o que identifica, inclusive das cópias da auditoria; receita, exame e vendas ficam sem nome), `clientes.anonimizado_em` | ✅ |
| 0021 | Assinatura da OS pelo link: `os_assinaturas` (retrato do que o cliente viu, vale 7 dias, assina uma vez), `gerar_link_assinatura()` (loja), `os_para_assinar()` e `assinar_os()` para o público só com o código do link; recado na OS quando assina | ✅ |
| 0025 | Funções fechadas por padrão: nenhuma função fica para PUBLIC/anon (as antigas só tiravam do anon, e o anon herdava de PUBLIC); o público alcança só site, lista de espera e assinatura; função nova já nasce fechada para o público | ✅ |
| 0024 | Caixa completo: recebe no caixa o sinal/saldo dos óculos e as parcelas do crediário (`pendencias_para_receber()`, `receber_no_caixa()`, `pagamentos.caixa_id`, `contas_receber.caixa_id`; a OS nasce no primeiro pagamento, pela loja ou pelo caixa); devolução de parte da venda pelo gerente (`devolver_itens()`, `devolucoes`: volta ao estoque, reembolso em dinheiro/Pix/estorno/abatendo o crediário, comissão aberta diminui); `resumo_caixa()` usado pela tela, pelo fechamento e pelo comprovante | ✅ |
| 0023 | Planos Essencial e Especial: `recursos_adicionais` ganha `inclui` (o Especial libera as notas fiscais), `preco_mensal` e `ordem`; `recurso_ativo()` vale para o recurso contratado ou incluído num plano | ✅ |
| 0022 | PDV e caixa só no **Plano Especial** (adicional `plano_especial`): gatilho `exige_plano_especial()` em `caixas` e `vendas` recusa abrir caixa e gravar venda sem ele; fechar caixa, cancelar venda e o histórico continuam liberados (o dinheiro da gaveta nunca fica preso) | ✅ |
| 0018 | NFC-e pelo caixa via Focus NFe: configuração fiscal da ótica, `nfe_credenciais` (token por ótica, só o servidor usa), `notas_fiscais`, `preparar_nfce()` (confere adicional, cadastro fiscal, rateia o desconto, retoma nota sem resposta), `registrar_retorno_nfce()`, cancelamento em 30 min só pelo gerente | ✅ |

### Telas (`src/`): todas 🟡, compilam (`typecheck` e `build` passam) mas ainda não foram abertas com um Supabase de verdade

A venda do PDV (`src/app/pdv/venda.tsx`) foi aberta no navegador com produtos de exemplo, no computador e no celular: busca por código, soma, desconto, divisão do pagamento e troco funcionam. Falta ligar num Supabase.

| Área | Tela | Rota |
|---|---|---|
| Todas | Login, Minha conta | `/login`, `/conta` |
| Consultório, laboratório, PDV, financeiro | Barra da área com a aba atual marcada, menu num botão no celular e, para a gestão, "Ir para" outra área (aberta no navegador, computador e celular) | topo de cada área |
| Loja e gestão | Início: números do dia no topo (consultas, óculos para avisar, OS atrasadas, clientes para chamar) e um cartão por assunto | `/inicio` |
| Loja e gestão | Funil de vendas (Kanban ao vivo, motivo de perda, WhatsApp) | `/vendas` |
| Loja e gestão | Novo atendimento (catálogo ou **produto novo na hora**, receita do cliente) | `/vendas/novo` |
| Loja e gestão | Atendimento: orçamento, sinal/saldo, mover etapa (para celular) | `/vendas/[id]` |
| Loja e gestão | Clientes, ficha com **linha do tempo**, receitas, anotações; para o dono, seção LGPD: baixar todos os dados do cliente, anonimizar (digitando o nome) e quem viu os dados de saúde | `/clientes`, `/clientes/[id]`, `/clientes/[id]/exportar` |
| Loja e gestão | Clientes para chamar: aniversário, receita vencendo, óculos há 1 ano, orçamento perdido; botão abre o WhatsApp com a mensagem pronta e marca como chamado | `/clientes/chamar` |
| Loja e gestão | Ordens de serviço: acompanha, avisa e entrega; recados com o laboratório; pedir a assinatura do cliente pelo link (WhatsApp) e ver a assinatura | `/laboratorio`, `/laboratorio/[id]` |
| Público | Conferir e assinar a OS no celular (receita, lentes, armação, prazo, valor; assina com o dedo). Quadro de assinatura aberto no navegador, no celular | `/assinar/[token]` |
| Loja e gestão | Agenda interna | `/agenda` |
| Loja e gestão | Menu por seções: Atendimento (vendas, agenda, OS), Clientes, Produtos (produtos, estoque, entrada pela nota, etiquetas), Equipe e resultados, Outras áreas, Ajustes; no celular, fechado num botão | menu lateral |
| Loja e gestão | Produtos: lista só para achar e abrir (busca, categoria, fora da venda); cadastrar o básico abre a página do produto; foto da armação depois da venda | `/catalogo`, `/catalogo/fotos` |
| Loja e gestão | Página do produto: foto, dados, compra, insumos e impostos em R$ ou %, margem e preço com a conta na hora, impostos para a nota fiscal (o balcão vê só o preço). Único lugar onde preço e custo mudam | `/catalogo/[id]` |
| Loja e gestão | Etiquetas com código de barras (Code 128) para impressora de etiquetas 50 × 25 mm ou folha A4 Pimaco; gera código interno para quem não tem | `/catalogo/etiquetas` |
| Loja e gestão | Estoque por loja: saldo, abaixo do mínimo, entrada, contagem, perda, transferência, histórico | `/estoque`, `/estoque/[id]` |
| Loja e gestão | Entrada pela nota do fornecedor (**adicional Notas fiscais**; sem ele, a tela explica o adicional): sobe o XML, confere produtos, quantidades e compra, escolhe boleto (parcelas vão para contas a pagar) ou cartão/Pix/dinheiro (já pago) e lança. Impostos, margem e preço ficam na página do produto | `/estoque/nota` |
| Loja e gestão | Comissões do mês (vendedor vê as dele; gestão vê todas, regras e pagamento) | `/comissoes` |
| Gestão | Relatórios do mês | `/relatorios` |
| Gestão | Configurações: ótica e site, lojas, usuários, perfis (área + permissões), horários e bloqueios, funil e motivos | `/configuracoes/...` |
| Consultório | Fila do dia, exame (anamnese, AV, refração, conduta), histórico do paciente | `/consultorio`, `/consultorio/exame/[id]`, `/consultorio/paciente/[id]` |
| Laboratório | Quadro de produção (ao vivo), OS com ficha técnica editável, etapas da construção, recados | `/producao`, `/producao/os/[id]` |
| Laboratório (gerente) | Indicadores: prazo, retrabalho, espera, produção por pessoa | `/producao/indicadores` |
| Gestão | Importar planilha (Excel `.xlsx` ou CSV): clientes e produtos, com prévia e relatório de erros | `/configuracoes/importar` |
| Público | Site da ótica + pedido de orçamento; agendamento online | `/site/[slug]`, `/site/[slug]/agendar` |
| Público | Site do Vitral com os dois planos lado a lado (aberto no navegador, computador e celular) e lista de espera (quem está logado vai para o sistema) | `/` |
| Público | Guia da reforma tributária para óticas (linha do tempo, Simples híbrido e prazos, nota fiscal, checklist, fontes); link no site, no financeiro e no cadastro do produto | `/reforma-tributaria` |
| Todas | Instalar como app (PWA): ícone na tela inicial, tela cheia, atalhos para Vendas, Caixa e Produção | `/manifest.webmanifest` |
| PDV | Caixa (**Plano Especial**): abrir, venda rápida (código de barras, várias formas, crediário, troco), sangria/suprimento, fechar com conferência; sem o plano, a tela explica o Plano Especial | `/pdv` |
| PDV | Receber óculos e crediário no caixa (busca o cliente pelo nome ou telefone) | `/pdv` |
| PDV | Vendas do dia: gerente cancela ou devolve parte da venda (itens voltam ao estoque); caixas fechados com diferença | `/pdv/vendas`, `/pdv/caixas` |
| PDV | Comprovante do fechamento (80 mm): vendas e recebimentos por forma, gaveta, esperado, contado, diferença e assinaturas; abre sozinho ao fechar o caixa (aberto no navegador e em PDF de 80 mm) | `/cupom/fechamento/[id]` |
| PDV | NFC-e: emitir depois de finalizar a venda ou na lista de vendas, DANFCe, cancelamento pelo gerente em até 30 min (com o adicional `nota_fiscal`; só Simples Nacional nesta versão) | `/pdv`, `/pdv/vendas` |
| PDV | Cupom sem valor fiscal (impressora térmica de 80 mm), aberto ao finalizar a venda | `/cupom/[id]` |
| Financeiro | Visão do mês (entradas, saídas, a pagar, a receber, impostos, comissões), exportação CSV para o contador | `/financeiro`, `/financeiro/exportar` |
| Financeiro | Contas a pagar (repetir por meses), contas a receber (parcelas, lembrete no WhatsApp), categorias de custo | `/financeiro/pagar`, `/financeiro/receber`, `/financeiro/categorias` |
| — | NF-e modelo 55 (venda para empresa, devolução) e NFC-e no regime normal | ⬜ |
| Vitral | Painel: óticas (criar com o login do dono, situação, plano Essencial ou Especial, notas avulsas, lojas extras, mensalidade de cada uma e o total do mês), lista de espera com WhatsApp | `/painel`, `/painel/espera` |

**Consultas conferidas:** `supabase/tests/conferir_consultas.mjs` lê todo o `src/` e confere, contra o banco com as migrações aplicadas, cada `.from(...).select(...)`, filtro, ordem, insert/update, relação embutida (inclusive ambígua) e `rpc(...)`. Hoje: 128 consultas e 10 chamadas, nenhum problema. Roda no CI.

**Tipos do banco:** `src/lib/supabase/tipos.ts` é gerado das migrações por `npm run tipos` (`supabase/gerar_tipos.mjs`, mesmo formato do `supabase gen types`, sem precisar de Docker) e todos os clientes do Supabase usam esses tipos. O CI falha se o arquivo estiver desatualizado. Mudou o banco? Rode `npm run tipos` com o Postgres local e commite.

**Por que tudo 🟡:** `npm install`, `npm run typecheck` e `npm run build` passam, e o servidor sobe: `/login` abre e as rotas protegidas mandam para o login. Falta abrir cada tela ligada a um projeto Supabase real.

---

## 2. Checklist (próximos passos, em ordem)

Marque com `[x]` quando terminar e anote no Histórico.

- [x] `npm install`, `npm run typecheck`, corrigir os erros. Commitar `package-lock.json`.
- [ ] `npm audit` aponta o `postcss` embutido no Next 15 (só afeta o build, não o site no ar); a correção só vem no Next 16. Avaliar a migração depois da Versão 1.
- [ ] Criar o projeto no Supabase **na região São Paulo (sa-east-1)**, na conta do dono do produto, e rodar as migrações 0001 → 0018 no SQL Editor.
- [ ] Cadastrar você em `vitral_admins` e criar as Óticas Nery pelo painel (`/painel`, seção 4).
- [ ] Rodar `supabase/seed_catalogo.sql` (ajustar os preços antes).
- [x] Conferir as consultas das telas contra o banco sem o Supabase (`conferir_consultas.mjs`, no CI).
- [ ] `.env.local` com as chaves e `npm run dev`. Abrir cada tela da tabela acima e trocar 🟡 por ✅.
- [ ] Testar o fluxo das três áreas com três logins (consultório, balcão, laboratório) em três abas:
  - [ ] exame → concluir → card aparece no funil da loja;
  - [ ] orçamento (com um produto novo e foto da armação) → sinal → OS aparece em "Pago" na produção, ao vivo;
  - [ ] laboratório puxa, registra etapas, manda recado, move para "Chegou na loja";
  - [ ] loja vê o recado, avisa pelo WhatsApp, entrega.
- [ ] Testar o site: `/site/nery` publicado, pedido de orçamento vira card; cadastrar horários e testar `/site/nery/agendar`.
- [ ] Testar no celular e no tablet: mover cards pelo botão "Mover para" (arrastar não funciona no toque) e instalar o app ("Adicionar à tela de início").
- [ ] (Opcional) pg_cron: `select cron.schedule('sem-retorno', '0 * * * *', 'select mover_sem_retorno()');`
- [ ] Publicar no Firebase App Hosting (seção 4, passo 6): projeto **separado** só do Vitral, alerta de orçamento, chaves no Secret Manager, domínio das Óticas Nery em `SITE_DOMINIOS`.
- [x] Backup diário do banco pelo GitHub Actions (`.github/workflows/backup.yml`), criptografado, 30 dias; restauração testada no CI.
- [ ] Ligar o backup: criar os segredos `SUPABASE_DB_URL` (Session pooler) e `BACKUP_SENHA` no GitHub (seção 4, passo 8), guardar a senha fora do GitHub e rodar uma vez pelo botão "Run workflow".
- [x] Backup das fotos do Storage (armações e receitas): todo domingo, pela interface S3 do Storage (chaves só de arquivos, não a service_role), testado no CI contra um S3 falso.
- [ ] Ligar o backup das fotos: no Supabase, Storage → S3 Connection, gerar as chaves e criar os segredos `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_CHAVE`, `SUPABASE_S3_SEGREDO` no GitHub.
- [x] Clientes para chamar (`/clientes/chamar`), LGPD do cliente (exportar, anonimizar, registro de acesso) e assinatura da OS pelo link (`/assinar/[token]`).
- [x] Menus das áreas (PDV, financeiro, consultório, produção) no mesmo padrão da loja e Início com um cartão por assunto.
- [ ] Testar com o Supabase real: assinar uma OS pelo celular, baixar e anonimizar um cliente de teste, conferir a lista de quem chamar.
- [ ] Quando as fotos passarem de uns 200 MB, guardar o backup delas no Google Cloud Storage (os artefatos do GitHub têm limite).
- [x] Gerar os tipos do banco e usar nos clientes (`npm run tipos`; achou o bug do cadastro de horários, corrigido na 0013).
- [x] Etiqueta com código de barras (`/catalogo/etiquetas`, gerador próprio em `src/lib/codigo-barras.ts`, conferido com a python-barcode).
- [ ] Testar as etiquetas numa impressora de etiquetas de verdade e ler com o leitor do PDV.
- [x] Entrada de produtos pelo XML da NF-e do fornecedor (`/estoque/nota`, leitor em `src/lib/nfe.ts`).
- [x] Impostos e formação de custo no cadastro do produto (`/catalogo/[id]`).
- [x] Guia da reforma tributária (`/reforma-tributaria`, atualizado em 04/11/2026).
- [ ] Revisar o guia quando o Senado confirmar a alíquota da CBS de 2027 (até dezembro) e se o prazo de desistência do híbrido (30/11) for adiado.
- [ ] Preencher NCM e CSOSN dos produtos das Óticas Nery com o contador (sem eles o produto não sai na nota fiscal).
- [ ] Ideias da concorrência para depois: medida de DNP pela câmera.
- [x] Versão 2: importação de planilha (clientes e produtos) e site do Vitral com lista de espera.
- [ ] Importar a planilha de clientes das Óticas Nery (pedir o arquivo do sistema antigo) e conferir o relatório de erros.
- [x] Planilha `.xlsx` direto, sem biblioteca externa (`lerXlsx()` em `src/lib/planilha.ts`, testes em `testes/`).
- [x] Ler a lista de espera: `/painel/espera`, com o botão de chamar no WhatsApp.
- [x] Versão 3 (sem nota fiscal): estoque por loja e comissões.
- [ ] Contagem inicial do estoque das Óticas Nery (tela Estoque → Contagem, produto a produto) e cadastrar as regras de comissão.
- [x] Emissão de NFC-e pelo caixa (Focus NFe), ligada ao adicional `nota_fiscal`.
- [ ] Contratar a Focus NFe na conta do dono do produto, cadastrar a empresa das Óticas Nery (certificado A1, CSC com o suporte da Focus), pôr os tokens no painel e testar em homologação.
- [x] Decidido: PDV e caixa só no Plano Especial (adicional `plano_especial`, ligado no painel).
- [x] Preços fechados: Essencial R$ 99, Especial R$ 199 (inclui PDV e notas fiscais), loja extra R$ 49.
- [ ] Definir o preço das notas fiscais avulsas no Essencial (ou tirar a opção) e pôr em `recursos_adicionais.preco_mensal`.
- [ ] Pedir à Focus NFe o preço por CNPJ/notas e conferir se o Especial cobre (referência: NFE.io, R$ 220/mês até 2.000 notas, CNPJ ilimitado).
- [ ] Anual com 2 meses grátis (R$ 990 e R$ 1.990) e taxa de implantação: decidir quando ligar a cobrança.
- [x] PDV: receber óculos e crediário no caixa, devolução de parte da venda, comprovante do fechamento.
- [ ] Devolução de venda com NFC-e: a devolução fiscal (NF-e de devolução, modelo 55) ainda é com o contador.
- [ ] Supabase local com Docker para abrir as telas: o registro de imagens (ECR/Docker Hub) recusou o download neste ambiente (limite de dados); tentar no computador de vocês com `npx supabase start`.
- [x] Decidido: notas fiscais são adicional pago (NFC-e no caixa e entrada pela nota do fornecedor), nunca no plano básico.
- [ ] Organizar do mesmo jeito os menus das outras áreas (PDV, financeiro, consultório, produção) e a tela de Início.
- [ ] Conferir na documentação da Focus os campos de IBS/CBS da NFC-e para 2027 (o leitor da documentação não achou) e o código do Pix (hoje "17").
- [ ] NF-e modelo 55 (venda para CNPJ, devolução ao fornecedor) e NFC-e no regime normal (CST com base de cálculo).
- [x] Versão 4: PDV e financeiro, com áreas e menus próprios.
- [ ] Testar o PDV com um leitor de código de barras de verdade (ele "digita" o código e aperta Enter) e cadastrar os códigos das armações.
- [ ] Combinar com o contador das Óticas Nery se o CSV do mês (`/financeiro/exportar`) atende ou se ele precisa de outro layout.
- [x] Cupom não fiscal da venda do PDV (`/cupom/[id]`).
- [ ] Testar o cupom numa impressora térmica de verdade (escolher a bobina de 80 mm e margem zero nas opções de impressão) e, com o adicional, a NFC-e.
- [x] Painel do Vitral (criar ótica com o dono, situação, adicionais, lista de espera).
- [ ] Cobrança da mensalidade (hoje o painel só mostra quantas óticas estão ativas): escolher Asaas, Mercado Pago ou Stripe.

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
- **Planos:** Essencial R$ 99 (tudo menos PDV e notas fiscais) e Especial R$ 199 (+ PDV, caixa e notas fiscais). O Especial é o adicional `plano_especial`, que inclui `nota_fiscal` (`recursos_adicionais.inclui`); notas avulsas para o Essencial pelo adicional `nota_fiscal`. Loja extra R$ 49.
- **Plano Especial:** PDV e caixa (adicional `plano_especial`). Sem ele o banco não abre caixa nem grava venda do PDV; fechar caixa, cancelar venda e consultar o histórico seguem liberados. O nome não é `pdv` de propósito: `acesso()` desliga o módulo inteiro quando o adicional tem o nome do módulo.
- **Plano único:** tudo incluído (menos o PDV, do Plano Especial). Adicionais em `recursos_adicionais` / `otica_adicionais`: notas fiscais (`nota_fiscal`: NFC-e no caixa **e** entrada pela nota do fornecedor; o banco recusa as duas sem o adicional) e lojas extras (o banco bloqueia a 2ª loja sem o adicional). O menu mostra o selo "adicional" no que a ótica não contratou.
- **Cada coisa no seu lugar:** venda é venda, cliente é cliente, produto é produto. O menu é separado por assunto; preço, custo e impostos só mudam na página do produto (a lista de produtos não edita); a entrada pela nota só dá entrada.
- **Produto na venda:** se não estiver no catálogo, o balcão cadastra ali mesmo e ele entra no catálogo. Armação pede foto (reduzida no aparelho antes de enviar); lente não.
- **WhatsApp:** nunca automático. Só link `wa.me` com mensagem pronta (`src/lib/whatsapp.ts`).
- **Clientes para chamar:** a lista sai do banco (`clientes_para_chamar()`); o botão abre o WhatsApp e marca o contato, e o cliente sai da lista daquele motivo no ciclo. Só entra quem tem telefone.
- **LGPD do cliente:** quem abre receita ou exame fica registrado (`acessos_dados_cliente`, só se acrescenta). Exportar e anonimizar só pelo dono ou gerente (`clientes:excluir`). Anonimizar apaga o que identifica (inclusive na auditoria) e não tem volta; receita, exame e vendas ficam, sem nome, pelo prazo da lei.
- **Assinatura da OS:** link de 7 dias, assina uma vez, guarda o retrato do que o cliente viu (`os_assinaturas.resumo`). O público só alcança `os_para_assinar` e `assinar_os` com o código do link. O laboratório não vê as assinaturas (têm valores).
- **Funil:** Atendimento → Orçamento enviado → Sem retorno → Recuperado / Perdido. Perdido exige motivo. Card parado vai sozinho para a etapa seguinte.
- **Pagamento:** o primeiro pagamento move o card para a etapa ganha e cria a OS uma única vez.
- **Agenda:** o mesmo horário nunca é marcado duas vezes. O site só vê horários livres.
- **Site público:** só funções `security definer` liberadas para `anon`, com limite de uso e aceite LGPD. A lista é fechada: `site_da_otica`, `pedido_orcamento_site`, `horarios_livres`, `agendar_pelo_site`, `entrar_lista_espera`, `os_para_assinar`, `assinar_os`. Função nova nasce fechada para o público (0025) e o `seguranca_smoke.sql` falha se aparecer outra.
- **Varredura entre óticas:** o CI entra como cada usuário dos testes e confere, tabela por tabela, que ninguém vê linha de outra ótica; também confere RLS em toda tabela, `otica_id` obrigatório e que o anônimo não lê nada.
- **Custo do produto:** na página do produto. Insumos (frete, seguro, embalagem; desconto negativo) e impostos da compra (IPI, ICMS-ST) em R$ ou em % da compra, com a chave R$ / %. Custo final = compra + insumos + impostos. Margem % sobre o custo final; mudou a margem, o preço muda, e o contrário.
- **Máscaras:** todo campo de dinheiro, porcentagem, CPF, CNPJ, telefone, NCM, CEST e CFOP usa `<CampoMascara>` (`src/components/campo-mascara.tsx`, regras em `src/lib/mascaras.ts`); dinheiro e porcentagem enchem da direita, como na maquininha. No servidor, `numeroOuNulo()` lê "1.234,56". Custo e margem só para quem edita o catálogo ou dá entrada no estoque; o balcão vê o preço.
- **Estoque:** por loja, só dos produtos com `controla_estoque` (padrão: armação, lente de contato, acessório; lente sob medida não). O livro `estoque_movimentos` nunca se altera; entrada, saída, contagem e transferência só pelas funções do banco. O primeiro pagamento da venda dá baixa uma vez. A venda nunca é bloqueada por falta de estoque (o saldo pode ficar negativo e aparece em vermelho).
- **Comissões:** regra mais específica vale (vendedor + categoria > vendedor > categoria > todos). Calculadas no primeiro pagamento, para o responsável do atendimento. O vendedor vê só as dele; `comissoes:editar` vê todas e marca como pagas.
- **Caixa recebe e devolve (0024):** sinal/saldo dos óculos e parcelas do crediário podem ser recebidos no caixa (`receber_no_caixa()`, não passa do saldo); o dinheiro entra na gaveta. Devolução de parte da venda só pelo gerente (`devolver_itens()`): o valor segue o desconto da venda, volta ao estoque, comissão aberta diminui, reembolso em dinheiro sai de um caixa aberto. Tela, fechamento e comprovante usam a mesma conta (`resumo_caixa()`).
- **PDV (Versão 4):** área própria (`pdv`, perfil Caixa). Venda só por `registrar_venda()`: preço vem do catálogo, desconto acima de 10% exige `pdv:editar`, a soma dos pagamentos tem de fechar com o total, crediário exige cliente e vira conta a receber. Um caixa aberto por operador. Só o gerente cancela venda (devolve ao estoque e cancela a comissão aberta).
- **Financeiro (Versão 4):** área própria (`financeiro`, perfis Financeiro e Contador; o Contador só lê). Regime de caixa: entradas = pagamentos (funil e PDV, menos vendas canceladas) + contas a receber recebidas; saídas = contas a pagar pagas. Imposto estimado = entradas × alíquota da ótica.
- **Importação de planilha:** nunca apaga nem sobrescreve; cliente repetido (mesmo telefone ou CPF) e produto repetido (mesmo código, ou mesmo nome na categoria) são pulados. O banco confere a permissão de quem importa.
- **Agilidade:**
  - o card muda na tela antes de o banco confirmar;
  - as telas atualizam sozinhas;
  - aparece um esqueleto na troca de tela;
  - toda regra de segurança nova usa `(select função())`, para não ficar lenta com muitas óticas.
- **Nota fiscal (NFC-e):** só pelo adicional `nota_fiscal`; produto sem NCM, origem e CSOSN não sai na nota. O token da Focus é por ótica, cadastrado pela equipe do Vitral no painel; `preparar_nfce()` o entrega a quem tem `pdv:criar` daquela ótica, para o servidor chamar a Focus (quem tem esse acesso já pode emitir pela tela; o token não serve para outra ótica). Nota sem resposta é retomada com a mesma referência, sem duplicar. Cancelamento só pelo gerente, em até 30 minutos.
- **Service role** só no servidor e só para o Auth (criar login). O painel do Vitral também segue isso: os dados passam pelas funções `painel_*`, que conferem `vitral_admins` no banco.
- Código, domínio, Supabase e hospedagem (Firebase) ficam no nome do dono do produto. O Vitral tem projeto próprio no Firebase, nunca dentro do projeto de outro cliente.

---

## 4. Como rodar

1. Supabase (região São Paulo) → SQL Editor: rode `supabase/migrations/0001` a `0018`, em ordem.
2. Primeira ótica e usuário dono, pelo **painel do Vitral**:
   - Authentication → Users → crie o seu login (o da equipe do Vitral) e, no SQL Editor:
     `insert into vitral_admins (usuario_id, email) values ('<id do seu usuário no Auth>', 'voce@exemplo.com');`
   - Entre no sistema: você cai em `/painel`. Em **Nova ótica**, informe o nome (Óticas Nery), o endereço do site (`nery`) e o nome e e-mail do dono. O painel cria o login do dono e mostra a senha temporária.
   - Sem o painel (só SQL), o caminho antigo continua valendo:

```sql
insert into oticas (nome, status, slug) values ('Óticas Nery', 'ativa', 'nery') returning id;
insert into lojas (otica_id, nome) values ('<id da ótica>', 'Loja Centro');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select '<id do usuário no Auth>', '<id da ótica>', id, 'Nome do dono', 'email@exemplo.com'
from perfis where otica_id = '<id da ótica>' and chave = 'dono';
```

3. `supabase/seed_catalogo.sql` para o catálogo de exemplo.
4. `cp .env.example .env.local`, preencher as chaves, `npm install`, `npm run dev`.
6. Publicar no **Firebase App Hosting** (o servidor do Next.js; o banco continua no Supabase):
   - No console do Firebase, crie um projeto **novo, só do Vitral** (não use o projeto de outro sistema). Ele pode usar a mesma conta de cobrança (plano Blaze).
   - No Google Cloud do projeto: **Faturamento → Orçamentos e alertas**, crie um alerta (ex.: R$ 50/mês) para não ter surpresa.
   - Cadastre as chaves (pede o valor de cada uma):
     ```bash
     npm install -g firebase-tools && firebase login
     firebase apphosting:secrets:set supabase-url
     firebase apphosting:secrets:set supabase-anon-key
     firebase apphosting:secrets:set supabase-service-role-key
     firebase apphosting:secrets:set site-dominios
     ```
   - Console do Firebase → **App Hosting → Começar**: ligue ao repositório do GitHub, branch de produção, pasta raiz `/`. Escolha a região mais perto do Brasil que aparecer (o banco está em São Paulo). Cada push nessa branch publica sozinho.
   - Na primeira vez, o console pede para dar acesso do backend às chaves: aceite (ou `firebase apphosting:secrets:grantaccess`).
   - Domínio próprio: App Hosting → **Domínios personalizados**. No Supabase, em Authentication → URL Configuration, ponha esse endereço como Site URL.
7. Funcionários: o dono cria em **Configurações → Usuários** e escolhe o perfil. A área do perfil decide a tela da pessoa. O sistema gera uma senha temporária; a pessoa troca em **Minha conta**.
8. **Backup diário** (o Supabase gratuito não faz): no GitHub, **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_DB_URL`: no Supabase, **Connect → Session pooler** (a connection string com a senha do banco). Use o Session pooler: o GitHub não alcança a conexão direta.
   - `BACKUP_SENHA`: uma senha longa só para o backup. **Guarde fora do GitHub** (gerenciador de senhas): sem ela o backup não abre.
   - Fotos (opcional, todo domingo): no Supabase, **Storage → S3 Connection**, gere as chaves e crie `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_CHAVE` e `SUPABASE_S3_SEGREDO`. São chaves só de arquivos; nunca use a service_role.
   - Depois, **Actions → Backup do banco → Run workflow** para testar. Ele roda sozinho todo dia às 03:17 e guarda 30 dias. Para restaurar: `supabase/backup/RESTAURAR.md`.

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
psql -f supabase/tests/versao3_smoke.sql      # estoque e comissões
psql -f supabase/tests/versao4_smoke.sql      # PDV e financeiro
node supabase/tests/conferir_consultas.mjs    # as consultas das telas batem com o banco (precisa do npm install)
node supabase/gerar_tipos.mjs --conferir      # src/lib/supabase/tipos.ts em dia com as migrações
psql -f supabase/tests/nfe_smoke.sql         # entrada pelo XML da NF-e do fornecedor
psql -f supabase/tests/nfce_smoke.sql        # emissão de NFC-e: preparação, retorno, cancelamento
psql -f supabase/tests/chamar_smoke.sql       # clientes para chamar
psql -f supabase/tests/lgpd_smoke.sql         # LGPD: registro de acesso, exportar, anonimizar
psql -f supabase/tests/assinatura_smoke.sql   # assinatura da OS pelo link
psql -f supabase/tests/planos_smoke.sql       # planos: Essencial, notas avulsas, Especial
psql -f supabase/tests/caixa_smoke.sql        # caixa: receber óculos e crediário, devolução, resumo e fechamento
psql -f supabase/tests/seguranca_smoke.sql    # depois de todos: regra das tabelas, o que o público alcança, varredura entre óticas
supabase/tests/backup_teste.sh                # backup e restauração: restaurado igual ao original, com as permissões
supabase/tests/backup_fotos_teste.sh          # backup das fotos contra um S3 falso (pipx install "moto[server]")
npm test                                      # testes do código (planilhas, código de barras, XML da NF-e, Focus NFe, máscaras)
```

Cada teste imprime as linhas esperadas e alguns erros de propósito: eles provam que o bloqueio funciona. O GitHub Actions (`.github/workflows/ci.yml`) roda tudo a cada push e confere as linhas. O teste de carga (1.000 óticas) está em `supabase/carga/` e os resultados em `docs/ESCALA.md`.

## 6. Mapa do código

```
supabase/migrations/   uma migração por mudança; nunca editar uma já aplicada em produção
supabase/tests/        testes do banco (stub do Supabase + testes de fumaça)
supabase/backup/       backup do banco (fazer_backup.sh, restaurar.sh) e das fotos (fotos.sh, restaurar_fotos.sh); passo a passo em RESTAURAR.md
src/app/assinar/       página pública para o cliente conferir e assinar a OS (sem login)
supabase/carga/        teste de carga (gerar dados, medir telas, usuários simultâneos)
docs/ESCALA.md         capacidade medida, custo por fase, plano de crescimento
src/lib/               supabase (servidor, navegador, público, admin), sessão e áreas, permissões, OS, formatação, WhatsApp
src/components/        barra das áreas, tempo real (AoVivo), linha do tempo, OS (quadro, ficha, recados, painel)
src/app/acoes/         Server Actions compartilhadas (OS)
src/app/(app)/         tela da loja e da gestão (menu lateral)
src/app/consultorio/   tela do consultório
src/app/producao/      tela do laboratório
src/app/pdv/           tela do caixa (PDV)
src/app/financeiro/    tela do financeiro e do contador
src/app/_vitral/        site do Vitral (lista de espera), servido em /
src/app/painel/        painel do Vitral (equipe do produto: óticas, adicionais, lista de espera)
src/app/cupom/         cupom da venda do PDV (impressão)
src/app/site/[slug]/   site público da ótica e agendamento online (sem login)
src/app/conta/         minha conta (qualquer área)
```

---

## 7. Histórico

Mais recente em cima. Uma linha por sessão: data, o que mudou, o que ficou pendente.

- **2026-11-11 (31)** — Testes de segurança gerais (`seguranca_smoke.sql` no CI): regra das tabelas, o que o público alcança, varredura entre óticas com todos os usuários dos testes, função nova fechada. Acharam funções internas abertas ao público (`registrar_pagamento`, `criar_os_do_atendimento`, `concluir_exame`, `definir_foto_produto`, `horarios_ocupados`): migração 0025 fecha todas e muda o padrão. O stub do Supabase agora imita o padrão de funções do Supabase.
- **2026-11-10 (30)** — Caixa completo (migração 0024): receber óculos e crediário no caixa, devolução de parte da venda pelo gerente, `resumo_caixa()` e comprovante do fechamento em 80 mm (`/cupom/fechamento/[id]`, abre ao fechar). A OS também nasce quando o primeiro pagamento é no caixa. Teste novo `caixa_smoke.sql` no CI (esperado R$ 320, diferença zero). Tentativa de Supabase local com Docker: o registro de imagens recusou o download (limite de dados) neste ambiente. Pendente: devolução fiscal de venda com NFC-e.
- **2026-11-09 (29)** — Planos fechados: Essencial R$ 99, Especial R$ 199 (PDV + notas fiscais), loja extra R$ 49. Migração 0023 (`inclui`, `preco_mensal`, `recurso_ativo()` olha o que o plano inclui), `src/lib/planos.ts` com testes, painel com a escolha do plano e a mensalidade de cada ótica, site do Vitral com os dois planos, configurações mostram o plano, menu e entrada pela nota tratam as notas como parte do Especial. Testes: `planos_smoke.sql`, `testes/planos.test.mjs`, NFC-e ajustado. Pendente: preço das notas avulsas; preço da Focus NFe.
- **2026-11-06 (28)** — PDV e caixa só no Plano Especial: migração 0022 (adicional `plano_especial`, gatilho em `caixas` e `vendas`), tela do caixa explica o plano, selo "adicional" no menu, caixa no painel do Vitral, textos do site e das configurações. Teste no `versao4_smoke` (sem plano não abre; plano acaba com o caixa aberto: fecha, não vende). Revisão do PDV: abrir, vender, sangria, suprimento, fechar, cancelar, cupom e NFC-e estão prontos. Pendente: preço do Plano Especial; receber o pagamento dos óculos no caixa; troca/devolução parcial; comprovante do fechamento.
- **2026-11-06 (27)** — Cinco frentes. (1) Clientes para chamar: migração 0019, tela `/clientes/chamar` com WhatsApp pronto por motivo e "Já chamei". (2) LGPD: migração 0020, ficha com baixar dados, anonimizar e quem viu receita/exame (registrado também no consultório); a anonimização limpa até as cópias da auditoria (achado no teste). (3) Assinatura da OS pelo link: migração 0021, bloco na OS da loja e página pública `/assinar/[token]` com quadro para o dedo. (4) Backup das fotos pela interface S3 do Storage, semanal, testado contra S3 falso no CI. (5) Barras das áreas com aba atual, menu no celular e "Ir para" da gestão; Início com números do dia e um cartão por assunto. Testes novos: `chamar_smoke`, `lgpd_smoke`, `assinatura_smoke`, `backup_fotos_teste`. Pendente: abrir essas telas num Supabase real; segredos do backup das fotos.
- **2026-11-06 (26)** — Backup diário do banco pelo GitHub Actions (`.github/workflows/backup.yml`, 03:17, guarda 30 dias): dados das óticas, logins e extensões num arquivo criptografado com senha (AES-256), conferido antes de guardar. Restauração por `supabase/backup/restaurar.sh`, tudo ou nada, só em banco vazio; zera as permissões padrão do projeto novo antes de aplicar as do backup (sem isso, estoque, comissões, vendas e notas voltavam aceitando gravação direta: achado no teste). `supabase/tests/backup_teste.sh` no CI restaura num banco vazio e compara dados, regras, gatilhos, funções e permissões. Pendente: criar os segredos no GitHub; fotos do Storage fora do backup.
- **2026-11-05 (25)** — Hospedagem trocada da Vercel para o Firebase App Hosting (o dono já paga o Blaze; Vercel gratuita não permite uso comercial): `apphosting.yaml` com as chaves no Secret Manager (a service role só no servidor) e passo a passo na seção 4. O banco continua no Supabase (gratuito no piloto, Pro quando houver 2 ou 3 óticas pagando). Pendente: backup diário do banco pelo GitHub Actions; conferir se o App Hosting tem região em São Paulo.
- **2026-11-04 (24)** — Confirmado com o cliente: a margem entra depois de somar todos os custos (compra + insumos + impostos), como já estava; rótulo do campo ficou "Margem (% sobre o custo final)".
- **2026-11-04 (23)** — Organização: menu da loja por seções (Atendimento, Clientes, Produtos, Equipe e resultados, Outras áreas, Ajustes), fechado num botão no celular e fixo no computador; "Catálogo" virou "Produtos". Lista de produtos não edita mais preço (busca, categoria, fora da venda; abrir leva à página do produto, que ganhou foto e link do estoque); cadastrar novo abre a página. Entrada pela nota passou a ser do adicional `nota_fiscal` (banco recusa sem ele; a tela explica; selo "adicional" no menu); nome do adicional: Notas fiscais. Pendente: organizar os menus de PDV, financeiro, consultório e produção do mesmo jeito.
- **2026-11-04 (22)** — Separação: a entrada pela nota só dá entrada (produto, categoria, quantidade, compra); impostos, insumos, margem e preço ficam na página do produto (`/catalogo/[id]`), com chave R$ / % em insumos e impostos e margem % sobre o custo final (mudou a margem, o preço muda; mudou o preço, a margem muda; `src/lib/precificacao.ts`, `<ValorReaisOuPct>`). Produto novo da nota entra fora da venda até ter preço (links para completar). Pagamento ao fornecedor: boleto gera as parcelas em contas a pagar; cartão, Pix ou dinheiro não (lido do `<tPag>` da nota, dá para trocar). Tabela da entrada vira cartões no celular. Pendente: confirmar com o cliente se margem é sobre o custo (hoje) ou sobre o preço.
- **2026-11-04 (21)** — Custo do produto em porcentagem sobre a compra (insumos %, impostos %, markup %; migração 0017 ajustada, nada estava em produção); entrada pela nota converte os reais do XML em % sem perder centavos. Máscaras em todos os campos de dinheiro, porcentagem, CPF, CNPJ, telefone, NCM, CEST, CFOP e códigos fiscais (`CampoMascara`, testes em `testes/mascaras.test.mjs`). Ordem dos itens da NFC-e estável (do mais caro para o mais barato).
  - Pendente: medidas da ficha técnica (DNP, aro) seguem sem máscara de propósito.
- **2026-11-04 (20)** — Emissão de NFC-e pelo caixa via Focus NFe: migração 0018, `src/lib/focus-nfe.ts` (emitir, consultar, cancelar; testes com uma Focus falsa), ações `src/app/pdv/nota-fiscal.ts`, botão da nota no PDV e na lista de vendas, dados fiscais da ótica em Configurações, tokens por ótica no painel. Teste `nfce_smoke.sql` no CI.
  - Pendente: conta na Focus NFe e teste em homologação; campos de IBS/CBS da NFC-e para 2027; NF-e modelo 55.
- **2026-11-04 (19)** — Guia da reforma tributária para óticas em `/reforma-tributaria` (público, aberto também para quem está logado): linha do tempo 2026–2033, Simples Nacional e Simples híbrido com os prazos de 2027, o que muda na nota fiscal, checklist e fontes oficiais com data. Links no site do Vitral, no financeiro e no cadastro do produto.
  - Pendente: atualizar com a alíquota da CBS confirmada (dezembro).
- **2026-11-04 (18)** — Impostos e custo no produto: migração 0017 (campos fiscais, custo em partes, `custo_final`; `registrar_entrada_nfe()` grava NCM/CEST/origem só onde estão vazios), leitor do XML traz insumos e impostos por unidade, tela `/catalogo/[id]` com precificação ao vivo, entrada pela nota com as colunas de custo, valor do estoque pelo custo final. Testes no `nfe_smoke.sql` e em `testes/nfe.test.mjs`.
  - Pendente: guia da reforma tributária e emissão da NFC-e (em andamento).
- **2026-11-04 (17)** — Entrada de mercadoria pelo XML da NF-e do fornecedor: leitor `src/lib/nfe.ts` (itens, EAN, NCM → categoria, duplicatas; testes com uma nota de exemplo em `testes/notas/`), migração 0016 (`notas_entrada`, `registrar_entrada_nfe()`), teste `nfe_smoke.sql` no CI e tela `/estoque/nota`.
  - Pendente: nada novo; próximos: clientes para chamar, assinatura da OS, emissão de nota fiscal.
- **2026-11-04 (16)** — PWA: manifesto (`src/app/manifest.ts`), ícones em `public/icones/` (comum, maskable e do iPhone), `src/app/icon.svg`, metadados do iPhone; o middleware deixa manifesto e ícones passarem sem login. O Chrome não aponta nenhum erro de instalação.
  - Pendente: funcionar sem internet (service worker com a agenda e a fila do dia).
- **2026-11-04 (15)** — Etiquetas com código de barras: gerador Code 128 próprio (`src/lib/codigo-barras.ts`, testes em `testes/`, tabela de símbolos conferida com a python-barcode), tela `/catalogo/etiquetas` (rolo 50 × 25 mm ou A4 Pimaco 6180, uma por peça em estoque) e migração 0015 (`gerar_codigos_catalogo()`). Impressão: tamanho de página por formato (conferido em PDF).
  - Pendente: testar com impressora e leitor de verdade.
- **2026-11-04 (14)** — Importação aceita Excel `.xlsx` direto (leitor próprio: ZIP + XML, datas do Excel, CPF que perdeu os zeros). `npm test` com os primeiros testes do código (`testes/planilha.test.mjs`, planilhas de exemplo em `testes/planilhas/`), rodando no CI.
  - Pendente: `.xls` antigo continua pedindo para salvar como `.xlsx` ou CSV.
- **2026-10-29 (13)** — Nome do produto: **Vitral** (era Vitra) em toda a interface, documentos e banco (`vitral_admins`, `sou_admin_vitral()`, pasta `src/app/_vitral`, migração `0014_painel_do_vitral.sql`); nada estava em produção. Primeiro cliente: **Óticas Nery** (no lugar da Ótica Ômega, que não existe); site de exemplo `/site/nery`.
  - Pendente: domínio do Vitral e das Óticas Nery.
- **2026-10-29 (12)** — Painel do Vitral: migração 0014 (`vitral_admins`, `sou_admin_vitral()`, `painel_oticas()`, `painel_criar_otica()`, `painel_definir_adicional()`, `painel_mudar_status()`, `painel_lista_espera()`), teste `painel_smoke.sql` no CI, telas `/painel` e `/painel/espera`. Admin sem ótica que entra no sistema vai direto para o painel. A seção 4 agora cria a primeira ótica pelo painel.
  - Pendente: cobrança da mensalidade.
- **2026-10-29 (11)** — Cupom sem valor fiscal da venda do PDV (`/cupom/[id]`, 80 mm, abre a impressão sozinho depois de finalizar a venda; link também na lista de vendas).
  - Pendente: testar numa impressora térmica.
- **2026-10-29 (10)** — Tipos do banco gerados das migrações (`supabase/gerar_tipos.mjs`, `npm run tipos`, conferido no CI) e ligados a todos os clientes do Supabase. Para isso, `@supabase/ssr` subiu de 0.6.1 para 0.12.7 (a 0.6 não casava com o supabase-js 2.118 e deixava tudo `never`). Os tipos acharam o cadastro de horários sem `otica_id`, que falharia no banco: migração 0013 e teste novo no `versao4_smoke.sql`.
  - Pendente: abrir as telas no Supabase real.
- **2026-10-29 (9)** — Versão 4: migração 0012 (áreas `pdv` e `financeiro`, perfil Contador, `venda_itens`, `caixa_movimentos`, `abrir_caixa()`, `registrar_venda()`, `cancelar_venda()`, `fechar_caixa()`, categorias de custo padrão, alíquota), teste `versao4_smoke.sql` no CI. Telas `/pdv` (+ vendas, caixas) e `/financeiro` (+ pagar, receber, categorias, exportar CSV). Saiu a página provisória `(app)/[modulo]`. Teste de carga refeito com as Versões 3 e 4 (`docs/ESCALA.md`): tudo abaixo de 6 ms. Tirados do repositório os `.txt` de saída dos testes que tinham entrado nos commits anteriores.
  - Pendente: cupom não fiscal da venda; NFC-e com o adicional; painel do Vitral.
- **2026-10-29 (8)** — Versão 3: migração 0011 (módulos `estoque` e `comissoes`, `estoque_saldos`/`estoque_movimentos`, `movimentar_estoque()`, `transferir_estoque()`, `comissao_regras`/`comissoes`, `marcar_comissoes_pagas()`, trigger `venda_fechada` no primeiro pagamento), teste `versao3_smoke.sql` no CI. Telas `/estoque`, `/estoque/[id]`, `/comissoes`. Funções de mês passaram para `src/lib/formatar.ts`.
  - Pendente: nota fiscal (escolher a API); devolução de venda ao estoque hoje é uma entrada manual.
- **2026-10-29 (7)** — Versão 2: migração 0010 (importar_clientes, importar_produtos, lista_espera + entrar_lista_espera, índices por telefone/CPF só com números), teste `versao2_smoke.sql` no CI. Telas: importar planilha (`/configuracoes/importar`, leitura do CSV no navegador em `src/lib/planilha.ts`) e site do Vitral em `/`.
  - Pendente: `.xlsx` direto; tela para ler a lista de espera (painel do Vitral).
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
