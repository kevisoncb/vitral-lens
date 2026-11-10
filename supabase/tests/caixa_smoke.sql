-- Teste do caixa (migração 0024): receber óculos e crediário no caixa, devolução de parte da venda, resumo e fechamento.
\set ON_ERROR_STOP off
insert into oticas (id, nome, status) values ('cb000000-0000-0000-0000-000000000001', 'Ótica Caixa', 'ativa');
insert into lojas (id, otica_id, nome) values ('cb100000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'Centro');
insert into otica_adicionais (otica_id, recurso) values ('cb000000-0000-0000-0000-000000000001', 'plano_especial');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select ('cb200000-0000-0000-0000-00000000000' || n)::uuid, 'cb000000-0000-0000-0000-000000000001',
       (select id from perfis where otica_id = 'cb000000-0000-0000-0000-000000000001' and chave = k), nm, nm || '@caixa.com'
from (values (1, 'dono', 'Dono'), (2, 'caixa', 'Carla'), (3, 'vendedor', 'Vera')) v(n, k, nm);

-- dono: produtos com estoque e 10% de comissão
set role authenticated; set request.jwt.claim.sub = 'cb200000-0000-0000-0000-000000000001';
insert into catalogo_itens (id, categoria, nome, preco, codigo) values
  ('cb300000-0000-0000-0000-000000000001', 'acessorio', 'Estojo', 50, '780001'),
  ('cb300000-0000-0000-0000-000000000002', 'armacao', 'Óculos de sol', 200, '780002');
select movimentar_estoque('cb300000-0000-0000-0000-000000000001', null, 'entrada', 10) is not null as e1;
select movimentar_estoque('cb300000-0000-0000-0000-000000000002', null, 'entrada', 5) is not null as e2;
insert into comissao_regras (percentual) values (10);
insert into clientes (id, nome, telefone) values ('cb400000-0000-0000-0000-000000000001', 'Marta Souza', '27999991234');
reset role;

-- vendedora monta o orçamento dos óculos (R$ 500), sem pagamento
set role authenticated; set request.jwt.claim.sub = 'cb200000-0000-0000-0000-000000000003';
insert into atendimentos (id, cliente_id, etapa_id, loja_id, descricao)
values ('cb500000-0000-0000-0000-000000000001', 'cb400000-0000-0000-0000-000000000001',
        (select id from funil_etapas where nome = 'Orçamento enviado'), 'cb100000-0000-0000-0000-000000000001', 'Multifocal');
insert into atendimento_itens (atendimento_id, descricao, quantidade, preco_unitario) values ('cb500000-0000-0000-0000-000000000001', 'Lente multifocal', 1, 500);
reset role;

-- caixa abre e acha a Marta pelo nome e pelo telefone
set role authenticated; set request.jwt.claim.sub = 'cb200000-0000-0000-0000-000000000002';
select abrir_caixa(null, 100) is not null as caixa;
select 'pendencias' as teste, string_agg(tipo || ':' || cliente || ':' || saldo, ',') from pendencias_para_receber('marta');
select 'pelo telefone' as teste, count(*) from pendencias_para_receber('1234');
-- recebe o sinal em dinheiro (cria a OS), tenta passar do saldo, recebe o resto no Pix
select 'sinal no caixa cria OS' as teste, receber_no_caixa((select id from caixas where fechado_em is null), 'oculos', 'cb500000-0000-0000-0000-000000000001', 200, 'dinheiro', 1::smallint, '2026-12-01') is not null as ok;
select receber_no_caixa((select id from caixas where fechado_em is null), 'oculos', 'cb500000-0000-0000-0000-000000000001', 400, 'pix');
select receber_no_caixa((select id from caixas where fechado_em is null), 'oculos', 'cb500000-0000-0000-0000-000000000001', 300, 'pix') is not null as saldo;
select 'pendencias depois' as teste, count(*) from pendencias_para_receber('marta');

-- venda no PDV: 2 estojos + 1 óculos de sol = 300, desconto 30 (10%): 100 em dinheiro e 170 no crediário (100 + 70)
select 'venda' as teste, registrar_venda((select id from caixas where fechado_em is null), 'cb400000-0000-0000-0000-000000000001',
  '[{"item_id": "cb300000-0000-0000-0000-000000000001", "quantidade": 2}, {"item_id": "cb300000-0000-0000-0000-000000000002", "quantidade": 1}]', 30,
  '[{"forma": "dinheiro", "valor": 100}, {"forma": "crediario", "valor": 100, "vencimento": "2026-12-10"}, {"forma": "crediario", "valor": 70, "vencimento": "2027-01-10"}]') is not null as ok;
-- recebe no caixa a primeira parcela do crediário, em dinheiro
select 'parcela no caixa' as teste, receber_no_caixa((select id from caixas where fechado_em is null), 'parcela',
  (select id from pendencias_para_receber('marta') where tipo = 'parcela' and saldo = 100), 100, 'dinheiro') is not null as ok;
select 'parcelas abertas' as teste, string_agg(saldo::text, ',') from pendencias_para_receber('marta') where tipo = 'parcela';
-- caixa não devolve (só o gerente)
select devolver_itens((select id from vendas limit 1), (select jsonb_build_array(jsonb_build_object('venda_item_id', id, 'quantidade', 1)) from venda_itens where descricao = 'Estojo'), 'pix', 'Não serviu');
reset role;

-- gerente: devolve 1 estojo abatendo o crediário (50 com 10% de desconto = 45: a parcela de 70 vira 25)
set role authenticated; set request.jwt.claim.sub = 'cb200000-0000-0000-0000-000000000001';
select 'devolve estojo' as teste, devolver_itens((select id from vendas limit 1),
  (select jsonb_build_array(jsonb_build_object('venda_item_id', id, 'quantidade', 1)) from venda_itens where descricao = 'Estojo'),
  'abater_crediario', 'Cliente não quis o segundo estojo') ->> 'valor' as valor;
select 'crediario aberto' as teste, string_agg(valor::text, ',') from contas_receber where recebido_em is null;
-- devolve o óculos de sol em dinheiro, saindo do caixa da Carla (180)
select 'devolve sol' as teste, devolver_itens((select id from vendas limit 1),
  (select jsonb_build_array(jsonb_build_object('venda_item_id', id, 'quantidade', 1)) from venda_itens where descricao = 'Óculos de sol'),
  'dinheiro', 'Arranhado', (select id from caixas where fechado_em is null)) ->> 'valor' as valor;
-- não devolve mais do que vendeu
select devolver_itens((select id from vendas limit 1),
  (select jsonb_build_array(jsonb_build_object('venda_item_id', id, 'quantidade', 1)) from venda_itens where descricao = 'Óculos de sol'), 'pix', 'De novo');
select 'estoque' as teste, string_agg(c.nome || '=' || s.quantidade, ',' order by c.nome) from estoque_saldos s join catalogo_itens c on c.id = s.item_id;
select 'comissao da venda' as teste, string_agg(base || '/' || valor, ',') from comissoes where venda_id is not null;
reset role;

-- resumo e fechamento: esperado = 100 abertura + 100 venda + 200 sinal + 100 parcela − 180 devolução = 320
set role authenticated; set request.jwt.claim.sub = 'cb200000-0000-0000-0000-000000000002';
select 'resumo' as teste, r -> 'vendas_por_forma' as vendas, r -> 'recebimentos_por_forma' as recebimentos, r ->> 'devolucoes_dinheiro' as devolucoes, r ->> 'esperado' as esperado
from (select resumo_caixa((select id from caixas where fechado_em is null)) r) x;
select 'fechamento' as teste, fechar_caixa((select id from caixas where fechado_em is null), 320) ->> 'diferenca' as diferenca;
reset role;

select 'OS e funil' as teste, (select count(*) from ordens_servico where atendimento_id = 'cb500000-0000-0000-0000-000000000001') as os,
       (select f.tipo from atendimentos a join funil_etapas f on f.id = a.etapa_id where a.id = 'cb500000-0000-0000-0000-000000000001') as etapa,
       (select count(*) from pagamentos where atendimento_id = 'cb500000-0000-0000-0000-000000000001' and caixa_id is not null) as no_caixa;

-- a loja continua registrando pelo funil (sem caixa) e o caixa não vê o funil
set role authenticated; set request.jwt.claim.sub = 'cb200000-0000-0000-0000-000000000002';
select 'caixa le atendimentos (esperado 0)' as teste, count(*) from atendimentos;
select registrar_pagamento('cb500000-0000-0000-0000-000000000001', 10, 'pix');
reset role;
-- anônimo não alcança nada disso
set role anon;
select pendencias_para_receber('marta');
reset role;
