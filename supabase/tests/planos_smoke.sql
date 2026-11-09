-- Teste dos planos (migração 0023): Essencial, Essencial com notas avulsas, Especial (PDV + notas).
\set ON_ERROR_STOP off
insert into oticas (id, nome, status) values
  ('e7000000-0000-0000-0000-000000000001', 'Essencial', 'ativa'),
  ('e7000000-0000-0000-0000-000000000002', 'Essencial com notas', 'ativa'),
  ('e7000000-0000-0000-0000-000000000003', 'Especial', 'ativa');
insert into lojas (otica_id, nome) select ('e7000000-0000-0000-0000-00000000000' || n)::uuid, 'Centro' from generate_series(1, 3) n;
insert into usuarios (id, otica_id, perfil_id, nome, email)
select ('e7200000-0000-0000-0000-00000000000' || n)::uuid, ('e7000000-0000-0000-0000-00000000000' || n)::uuid,
       (select id from perfis where otica_id = ('e7000000-0000-0000-0000-00000000000' || n)::uuid and chave = 'dono'), 'Dono ' || n, 'dono' || n || '@planos.com'
from generate_series(1, 3) n;
insert into otica_adicionais (otica_id, recurso) values
  ('e7000000-0000-0000-0000-000000000002', 'nota_fiscal'),
  ('e7000000-0000-0000-0000-000000000003', 'plano_especial');

select 'precos' as teste, string_agg(recurso || '=' || coalesce(preco_mensal::text, 'a definir') || case when inclui <> '{}' then '+' || array_to_string(inclui, ',') else '' end, ' | ' order by ordem)
from recursos_adicionais;

-- para cada ótica: notas fiscais liberadas? PDV? módulos do plano seguem liberados?
create temp table r (otica text, notas boolean, especial boolean, clientes boolean);
grant all on r to authenticated;
set role authenticated;
set request.jwt.claim.sub = 'e7200000-0000-0000-0000-000000000001';
insert into r select 'essencial', recurso_ativo('nota_fiscal'), recurso_ativo('plano_especial'), acesso('clientes', 'ver');
set request.jwt.claim.sub = 'e7200000-0000-0000-0000-000000000002';
insert into r select 'avulso', recurso_ativo('nota_fiscal'), recurso_ativo('plano_especial'), acesso('clientes', 'ver');
set request.jwt.claim.sub = 'e7200000-0000-0000-0000-000000000003';
insert into r select 'especial', recurso_ativo('nota_fiscal'), recurso_ativo('plano_especial'), acesso('clientes', 'ver');
select 'liberado' as teste, string_agg(otica || ':notas=' || notas || ',pdv=' || especial || ',clientes=' || clientes, ' | ' order by otica) from r;

-- Especial: entra mercadoria pela nota (incluída) e abre caixa
select 'especial entrada pela nota' as teste, (registrar_entrada_nfe('{"numero": "1", "fornecedor": "Fornecedor"}', null,
  '[{"codigo": "X1", "nome": "Estojo", "categoria": "acessorio", "quantidade": 2, "custo": 10}]', '[]') ->> 'unidades') as unidades;
select 'especial abre caixa' as teste, abrir_caixa(null, 50) is not null as ok;
-- Essencial com notas avulsas: entrada pela nota sim, caixa não
set request.jwt.claim.sub = 'e7200000-0000-0000-0000-000000000002';
select 'avulso entrada pela nota' as teste, (registrar_entrada_nfe('{"numero": "2", "fornecedor": "Fornecedor"}', null,
  '[{"codigo": "X2", "nome": "Flanela", "categoria": "acessorio", "quantidade": 1, "custo": 5}]', '[]') ->> 'unidades') as unidades;
select abrir_caixa(null, 50);
-- Essencial: nem nota nem caixa
set request.jwt.claim.sub = 'e7200000-0000-0000-0000-000000000001';
select registrar_entrada_nfe('{"numero": "3", "fornecedor": "Fornecedor"}', null,
  '[{"codigo": "X3", "nome": "Cordão", "categoria": "acessorio", "quantidade": 1, "custo": 5}]', '[]');
select abrir_caixa(null, 50);
reset role;
