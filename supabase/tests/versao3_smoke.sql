-- Teste da Versão 3 (migração 0011): estoque e comissões.
\set ON_ERROR_STOP off
insert into oticas (id, nome, status) values ('a8000000-0000-0000-0000-000000000001', 'Ótica Estoque', 'ativa');
insert into lojas (id, otica_id, nome) values ('a8100000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', 'Centro');
insert into otica_adicionais (otica_id, recurso, quantidade) values ('a8000000-0000-0000-0000-000000000001', 'multiloja', 1);
insert into lojas (id, otica_id, nome) values ('a8100000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-000000000001', 'Bairro');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select ('a8200000-0000-0000-0000-00000000000' || n)::uuid, 'a8000000-0000-0000-0000-000000000001',
       (select id from perfis where otica_id = 'a8000000-0000-0000-0000-000000000001' and chave = k), nm, nm || '@estoque.com'
from (values (1, 'dono', 'Dono'), (2, 'vendedor', 'Vera'), (3, 'vendedor', 'Vitor'), (4, 'laboratorio', 'Lab')) v(n, k, nm);
select 'permissoes v3' as teste, string_agg(chave || '=' || coalesce(permissoes ->> 'estoque', '-') || '/' || coalesce(permissoes ->> 'comissoes', '-'), ' ' order by chave)
from perfis where otica_id = 'a8000000-0000-0000-0000-000000000001' and chave in ('dono', 'vendedor', 'laboratorio');

-- dono cadastra produtos: armação controla estoque sozinha, lente não
set role authenticated; set request.jwt.claim.sub = 'a8200000-0000-0000-0000-000000000001';
insert into catalogo_itens (id, categoria, nome, preco) values
  ('a8300000-0000-0000-0000-000000000001', 'armacao', 'Armação Teste', 400),
  ('a8300000-0000-0000-0000-000000000002', 'lente', 'Lente Teste', 300);
select 'controla estoque' as teste, string_agg(categoria || '=' || controla_estoque, ',' order by categoria) from catalogo_itens;

-- entrada de 5 com custo, ajuste de contagem para 4, perda de 1 sem motivo (erro) e com motivo
select 'entrada (esperado 5)' as teste, movimentar_estoque('a8300000-0000-0000-0000-000000000001', null, 'entrada', 5, 150, 'NF 123');
select 'custo gravado' as teste, custo from catalogo_itens where id = 'a8300000-0000-0000-0000-000000000001';
select 'ajuste contagem (esperado 4)' as teste, movimentar_estoque('a8300000-0000-0000-0000-000000000001', null, 'ajuste', 4);
select movimentar_estoque('a8300000-0000-0000-0000-000000000001', null, 'saida', 1, null, '');
select 'perda (esperado 3)' as teste, movimentar_estoque('a8300000-0000-0000-0000-000000000001', null, 'saida', 1, null, 'Quebrou na vitrine');
select 'transferiu' as teste, transferir_estoque('a8300000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000002', 1);
select 'saldos por loja' as teste, string_agg(l.nome || '=' || s.quantidade, ',' order by l.nome)
from estoque_saldos s join lojas l on l.id = s.loja_id;
-- ninguém escreve direto no livro
insert into estoque_movimentos (otica_id, loja_id, item_id, tipo, quantidade) values
  ('a8000000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000001', 'a8300000-0000-0000-0000-000000000001', 'entrada', 100);
delete from estoque_movimentos;

-- regras: 5% para todos, 10% em armação para todos, 8% em armação para a Vera
insert into comissao_regras (usuario_id, categoria, percentual) values
  (null, null, 5), (null, 'armacao', 10), ('a8200000-0000-0000-0000-000000000002', 'armacao', 8);
reset role;

-- vendedor só vê o estoque, não dá entrada
set role authenticated; set request.jwt.claim.sub = 'a8200000-0000-0000-0000-000000000002';
select movimentar_estoque('a8300000-0000-0000-0000-000000000001', null, 'entrada', 1);
select 'vendedor ve saldo' as teste, sum(quantidade) from estoque_saldos;
insert into comissao_regras (categoria, percentual) values ('lente', 50);   -- vendedor não mexe nas regras

-- Vera vende armação + lente; Vitor vende armação
insert into clientes (id, nome) values ('a8400000-0000-0000-0000-000000000001', 'Cliente Estoque');
insert into atendimentos (id, cliente_id, etapa_id, loja_id, responsavel_id)
select 'a8500000-0000-0000-0000-000000000001', 'a8400000-0000-0000-0000-000000000001', id,
       'a8100000-0000-0000-0000-000000000001', 'a8200000-0000-0000-0000-000000000002'
from funil_etapas order by ordem limit 1;
insert into atendimento_itens (atendimento_id, catalogo_item_id, descricao, preco_unitario) values
  ('a8500000-0000-0000-0000-000000000001', 'a8300000-0000-0000-0000-000000000001', 'Armação Teste', 400),
  ('a8500000-0000-0000-0000-000000000001', 'a8300000-0000-0000-0000-000000000002', 'Lente Teste', 300);
select registrar_pagamento('a8500000-0000-0000-0000-000000000001', 200, 'pix', 1::smallint, true) is not null as sinal;
select registrar_pagamento('a8500000-0000-0000-0000-000000000001', 500, 'pix') is not null as saldo;
reset role;
set role authenticated; set request.jwt.claim.sub = 'a8200000-0000-0000-0000-000000000003';
insert into atendimentos (id, cliente_id, etapa_id, loja_id, responsavel_id)
select 'a8500000-0000-0000-0000-000000000002', 'a8400000-0000-0000-0000-000000000001', id,
       'a8100000-0000-0000-0000-000000000001', 'a8200000-0000-0000-0000-000000000003'
from funil_etapas order by ordem limit 1;
insert into atendimento_itens (atendimento_id, catalogo_item_id, descricao, preco_unitario) values
  ('a8500000-0000-0000-0000-000000000002', 'a8300000-0000-0000-0000-000000000001', 'Armação Teste', 400);
select registrar_pagamento('a8500000-0000-0000-0000-000000000002', 400, 'dinheiro') is not null as pago;
select 'vitor ve so a dele (esperado 1)' as teste, count(*), sum(valor) from comissoes;
reset role;

select 'baixa uma vez por venda (esperado Centro=0)' as teste, string_agg(l.nome || '=' || s.quantidade, ',' order by l.nome)
from estoque_saldos s join lojas l on l.id = s.loja_id where s.otica_id = 'a8000000-0000-0000-0000-000000000001';
select 'movimentos de venda (esperado 2)' as teste, count(*) from estoque_movimentos where tipo = 'venda' and otica_id = 'a8000000-0000-0000-0000-000000000001';
-- Vera: armação 400 * 8% + lente 300 * 5% = 32 + 15 = 47; Vitor: armação 400 * 10% = 40
select 'comissoes' as teste, string_agg(u.nome || '=' || c.valor || '/' || c.base, ',' order by u.nome)
from comissoes c join usuarios u on u.id = c.usuario_id where c.otica_id = 'a8000000-0000-0000-0000-000000000001';

-- dono paga as comissões; vendedor não consegue
set role authenticated; set request.jwt.claim.sub = 'a8200000-0000-0000-0000-000000000002';
select marcar_comissoes_pagas(array(select id from comissoes));
reset role;
set role authenticated; set request.jwt.claim.sub = 'a8200000-0000-0000-0000-000000000001';
select 'dono ve todas e paga (esperado 2)' as teste, marcar_comissoes_pagas(array(select id from comissoes));
reset role;
set role authenticated; set request.jwt.claim.sub = 'a8200000-0000-0000-0000-000000000004';
select 'lab nao ve estoque nem comissoes (esperado 0 0)' as teste, (select count(*) from estoque_saldos), (select count(*) from comissoes);
reset role;
