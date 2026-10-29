-- Teste da Versão 4 (migração 0012): PDV e financeiro.
\set ON_ERROR_STOP off
insert into oticas (id, nome, status) values ('a9000000-0000-0000-0000-000000000001', 'Ótica PDV', 'ativa');
insert into lojas (id, otica_id, nome) values ('a9100000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000001', 'Centro');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select ('a9200000-0000-0000-0000-00000000000' || n)::uuid, 'a9000000-0000-0000-0000-000000000001',
       (select id from perfis where otica_id = 'a9000000-0000-0000-0000-000000000001' and chave = k), nm, nm || '@pdv.com'
from (values (1, 'dono', 'Dono'), (2, 'caixa', 'Carla'), (3, 'contador', 'Contador'), (4, 'financeiro', 'Fin')) v(n, k, nm);
select 'areas v4' as teste, string_agg(chave || '=' || area, ',' order by chave) from perfis
where otica_id = 'a9000000-0000-0000-0000-000000000001' and chave in ('caixa', 'contador', 'financeiro');
select 'categorias padrao' as teste, count(*) > 5 as ok, count(*) filter (where tipo = 'imposto') as impostos
from categorias_custo where otica_id = 'a9000000-0000-0000-0000-000000000001';

-- dono cadastra produtos, dá entrada no estoque e põe 5% de comissão geral
set role authenticated; set request.jwt.claim.sub = 'a9200000-0000-0000-0000-000000000001';
insert into catalogo_itens (id, categoria, nome, preco, codigo) values
  ('a9300000-0000-0000-0000-000000000001', 'acessorio', 'Estojo', 50, '789001'),
  ('a9300000-0000-0000-0000-000000000002', 'armacao', 'Óculos de sol', 300, '789002');
select movimentar_estoque('a9300000-0000-0000-0000-000000000001', null, 'entrada', 10);
select movimentar_estoque('a9300000-0000-0000-0000-000000000002', null, 'entrada', 3);
insert into comissao_regras (percentual) values (5);
insert into clientes (id, nome) values ('a9400000-0000-0000-0000-000000000001', 'Cliente PDV');
reset role;

-- caixa abre o caixa (abrir de novo devolve o mesmo) e vende
set role authenticated; set request.jwt.claim.sub = 'a9200000-0000-0000-0000-000000000002';
select 'abre caixa' as teste, abrir_caixa(null, 100) = abrir_caixa(null, 999) as mesmo;
-- 2 estojos + 1 óculos = 400; desconto de 20 (5%), pago em dinheiro 180 e pix 200
select 'venda 1' as teste, registrar_venda((select id from caixas where fechado_em is null),
  null, '[{"item_id": "a9300000-0000-0000-0000-000000000001", "quantidade": 2}, {"item_id": "a9300000-0000-0000-0000-000000000002", "quantidade": 1}]',
  20, '[{"forma": "dinheiro", "valor": 180}, {"forma": "pix", "valor": 200}]') is not null as ok;
-- desconto de 15% sem gerente: barrado
select registrar_venda((select id from caixas where fechado_em is null), null,
  '[{"item_id": "a9300000-0000-0000-0000-000000000001", "quantidade": 2}]', 15, '[{"forma": "pix", "valor": 85}]');
-- pagamentos que não fecham: barrado
select registrar_venda((select id from caixas where fechado_em is null), null,
  '[{"item_id": "a9300000-0000-0000-0000-000000000001", "quantidade": 1}]', 0, '[{"forma": "pix", "valor": 10}]');
-- crediário sem cliente: barrado; com cliente vira conta a receber
select registrar_venda((select id from caixas where fechado_em is null), null,
  '[{"item_id": "a9300000-0000-0000-0000-000000000001", "quantidade": 1}]', 0, '[{"forma": "crediario", "valor": 50}]');
select 'venda crediario' as teste, registrar_venda((select id from caixas where fechado_em is null), 'a9400000-0000-0000-0000-000000000001',
  '[{"item_id": "a9300000-0000-0000-0000-000000000001", "quantidade": 1}]', 0,
  '[{"forma": "crediario", "valor": 50, "vencimento": "2030-01-10"}]') is not null as ok;
-- ninguém grava venda direto
insert into vendas (otica_id, loja_id, subtotal, total) values ('a9000000-0000-0000-0000-000000000001', 'a9100000-0000-0000-0000-000000000001', 1, 1);
select 'sangria' as teste, movimentar_caixa((select id from caixas where fechado_em is null), 'sangria', 50, 'Depósito');
-- caixa não cancela venda
select cancelar_venda((select id from vendas where numero = 1), 'Cliente desistiu');
select 'vendas do caixa' as teste, string_agg(numero || '=' || total, ',' order by numero) from vendas;
reset role;

select 'estoque apos vendas (esperado estojo 7, sol 2)' as teste, string_agg(c.nome || '=' || s.quantidade, ',' order by c.nome)
from estoque_saldos s join catalogo_itens c on c.id = s.item_id where s.otica_id = 'a9000000-0000-0000-0000-000000000001';
select 'comissao pdv (5% de 380)' as teste, string_agg(valor::text, ',' order by valor) from comissoes where otica_id = 'a9000000-0000-0000-0000-000000000001';
select 'conta a receber do crediario' as teste, valor, vencimento from contas_receber where otica_id = 'a9000000-0000-0000-0000-000000000001';

-- dono cancela a venda 1: volta ao estoque, comissão cancelada
set role authenticated; set request.jwt.claim.sub = 'a9200000-0000-0000-0000-000000000001';
select 'cancelou' as teste, cancelar_venda((select id from vendas where numero = 1), 'Cliente desistiu');
reset role;
select 'estoque apos cancelar (esperado estojo 9, sol 3)' as teste, string_agg(c.nome || '=' || s.quantidade, ',' order by c.nome)
from estoque_saldos s join catalogo_itens c on c.id = s.item_id where s.otica_id = 'a9000000-0000-0000-0000-000000000001';
select 'comissoes apos cancelar' as teste, string_agg(status, ',' order by valor) from comissoes where otica_id = 'a9000000-0000-0000-0000-000000000001';

-- caixa fecha: esperado = 100 abertura + 0 (venda em dinheiro cancelada) - 50 sangria = 50; contou 45
set role authenticated; set request.jwt.claim.sub = 'a9200000-0000-0000-0000-000000000002';
select 'fechamento' as teste, fechar_caixa((select id from caixas where fechado_em is null), 45);
select 'caixa nao ve contas a pagar (esperado 0)' as teste, count(*) from contas_pagar;
reset role;

-- financeiro lança e paga conta; contador só lê
set role authenticated; set request.jwt.claim.sub = 'a9200000-0000-0000-0000-000000000004';
insert into contas_pagar (descricao, valor, vencimento, fornecedor, categoria_id)
select 'DAS outubro', 320, '2030-11-20', 'Receita Federal', id from categorias_custo where nome = 'Simples Nacional / DAS';
update contas_pagar set pago_em = '2030-11-19' where descricao = 'DAS outubro';
reset role;
set role authenticated; set request.jwt.claim.sub = 'a9200000-0000-0000-0000-000000000003';
select 'contador le' as teste, count(*), max(pago_em) from contas_pagar;
insert into contas_pagar (descricao, valor, vencimento) values ('Não pode', 1, '2030-01-01');
update contas_pagar set valor = 1;
select 'valor intacto' as teste, valor from contas_pagar;
reset role;
