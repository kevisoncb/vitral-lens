-- Teste da entrada de mercadoria pelo XML da NF-e (migração 0016).
\set ON_ERROR_STOP off
insert into oticas (id, nome, status) values ('ac000000-0000-0000-0000-000000000001', 'Ótica Nota', 'ativa');
insert into lojas (id, otica_id, nome) values ('ac100000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000001', 'Centro');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select ('ac200000-0000-0000-0000-00000000000' || n)::uuid, 'ac000000-0000-0000-0000-000000000001',
       (select id from perfis where otica_id = 'ac000000-0000-0000-0000-000000000001' and chave = k), nm, nm || '@nota.com'
from (values (1, 'dono', 'Dono'), (2, 'vendedor', 'Balcao')) v(n, k, nm);

set role authenticated; set request.jwt.claim.sub = 'ac200000-0000-0000-0000-000000000001';
-- a armação já está no catálogo com o EAN; os outros dois são novos
-- o gerente já corrigiu o NCM da armação no cadastro: a nota não pode trocar
insert into catalogo_itens (id, categoria, nome, preco, codigo, ncm) values
  ('ac300000-0000-0000-0000-000000000001', 'armacao', 'Armação acetato preta', 450, '7891234567895', '90031900');

select 'entrada' as teste, registrar_entrada_nfe(
  '{"chave": "32261112345678000190550010000088121000088120", "numero": "8812", "fornecedor": "Distribuidora", "cnpj": "12345678000190", "emissao": "2026-11-03", "valor_total": 1254.80}',
  null,
  '[{"codigo": "7891234567895", "nome": "ARMACAO ACETATO PRETA 52-18", "categoria": "armacao", "quantidade": 3, "custo": 150,
     "insumos_pct": 3.3333, "impostos_pct": 5, "ncm": "90031100", "cest": "2805400", "origem": 0},
    {"codigo": "SOL-AV-01", "nome": "Óculos sol aviador", "categoria": "armacao", "quantidade": 2, "custo": 89.9, "preco_venda": 249,
     "insumos_pct": -5.4505, "impostos_pct": 6.8966, "ncm": "9004.10.00", "origem": 2, "unidade": "un"},
    {"codigo": "7890000000013", "nome": "Lente de contato mensal", "categoria": "lente_contato", "quantidade": 10, "custo": 62.5, "preco_venda": 160}]',
  '[{"vencimento": "2026-12-03", "valor": 418.27}, {"vencimento": "2027-01-02", "valor": 418.27}, {"vencimento": "2027-02-01", "valor": 418.26}]',
  (select id from categorias_custo where nome = 'Fornecedor de armações')) - 'nota_id' as resultado;

select 'estoque' as teste, string_agg(c.nome || '=' || s.quantidade || '@' || c.custo, ', ' order by c.nome)
from estoque_saldos s join catalogo_itens c on c.id = s.item_id;
select 'contas' as teste, count(*), sum(valor), min(descricao) from contas_pagar;
select 'fiscal e custo' as teste, string_agg(nome || ' ncm=' || coalesce(ncm, '-') || ' cest=' || coalesce(cest, '-') || ' orig=' || coalesce(origem::text, '-')
       || ' un=' || unidade || ' final=' || custo_final, ' | ' order by nome) from catalogo_itens;
select 'custo do movimento' as teste, string_agg(custo_unitario::text, ',' order by custo_unitario) from estoque_movimentos;

-- a mesma nota de novo: recusada
select registrar_entrada_nfe('{"chave": "32261112345678000190550010000088121000088120", "numero": "8812", "fornecedor": "Distribuidora"}',
  null, '[{"codigo": "SOL-AV-01", "nome": "x", "categoria": "armacao", "quantidade": 1, "custo": 1}]', '[]');
-- produto novo sem preço de venda: recusado, e nada fica pela metade
select registrar_entrada_nfe('{"numero": "9000", "fornecedor": "Outro"}', null,
  '[{"codigo": "SOL-AV-01", "nome": "Aviador", "categoria": "armacao", "quantidade": 1, "custo": 80},
    {"codigo": "NOVO-1", "nome": "Novo sem preço", "categoria": "acessorio", "quantidade": 1, "custo": 5}]', '[]');
select 'notas lancadas (esperado 1)' as teste, count(*) from notas_entrada;
reset role;

-- balcão (vendedor) não dá entrada
set role authenticated; set request.jwt.claim.sub = 'ac200000-0000-0000-0000-000000000002';
select registrar_entrada_nfe('{"numero": "1", "fornecedor": "X"}', null, '[{"codigo": "A", "nome": "A", "categoria": "acessorio", "quantidade": 1, "custo": 1, "preco_venda": 2}]', '[]');
reset role;
