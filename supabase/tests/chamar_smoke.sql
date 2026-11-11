-- Teste de "clientes para chamar" (migração 0019). Data fixa: 01/03/2027.
\set ON_ERROR_STOP off
insert into oticas (id, nome, status) values
  ('c7000000-0000-0000-0000-000000000001', 'Ótica Chamar', 'ativa'),
  ('c7000000-0000-0000-0000-000000000002', 'Outra Ótica', 'ativa');
insert into lojas (id, otica_id, nome) values ('c7100000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001', 'Centro');
insert into usuarios (id, otica_id, perfil_id, nome, email) values
  ('c7200000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001',
   (select id from perfis where otica_id = 'c7000000-0000-0000-0000-000000000001' and chave = 'vendedor'), 'Balcão', 'balcao@chamar.com'),
  ('c7200000-0000-0000-0000-000000000002', 'c7000000-0000-0000-0000-000000000002',
   (select id from perfis where otica_id = 'c7000000-0000-0000-0000-000000000002' and chave = 'dono'), 'Dono outra', 'dono@outra.com'),
  ('c7200000-0000-0000-0000-000000000003', 'c7000000-0000-0000-0000-000000000001',
   (select id from perfis where otica_id = 'c7000000-0000-0000-0000-000000000001' and chave = 'laboratorio'), 'Lab', 'lab@chamar.com');

insert into clientes (id, otica_id, nome, telefone, nascimento) values
  ('c7300000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001', 'Ana Receita',     '27999990001', null),
  ('c7300000-0000-0000-0000-000000000002', 'c7000000-0000-0000-0000-000000000001', 'Bruno Aniversário', '27999990002', '1980-03-03'),
  ('c7300000-0000-0000-0000-000000000003', 'c7000000-0000-0000-0000-000000000001', 'Carla Bissexto',  '27999990003', '1996-02-29'),
  ('c7300000-0000-0000-0000-000000000004', 'c7000000-0000-0000-0000-000000000001', 'Davi Óculos',     '27999990004', null),
  ('c7300000-0000-0000-0000-000000000005', 'c7000000-0000-0000-0000-000000000001', 'Elisa Perdido',   '27999990005', null),
  ('c7300000-0000-0000-0000-000000000006', 'c7000000-0000-0000-0000-000000000001', 'Fábio Sem Fone',  null,          '1990-03-02'),
  ('c7300000-0000-0000-0000-000000000007', 'c7000000-0000-0000-0000-000000000001', 'Gil Receita Nova', '27999990007', null),
  ('c7300000-0000-0000-0000-000000000008', 'c7000000-0000-0000-0000-000000000001', 'Hugo Comprou De Novo', '27999990008', null),
  ('c7300000-0000-0000-0000-000000000009', 'c7000000-0000-0000-0000-000000000002', 'Iara Outra Ótica', '27999990009', '1985-03-01');

-- Ana: receita de 10/03/2026 vence em 10/03/2027 (daqui a 9 dias). Gil: receita de 2027, longe de vencer.
-- Ana também tem uma receita antiga (2024): só a mais nova conta.
insert into receitas (otica_id, cliente_id, data_receita) values
  ('c7000000-0000-0000-0000-000000000001', 'c7300000-0000-0000-0000-000000000001', '2024-01-10'),
  ('c7000000-0000-0000-0000-000000000001', 'c7300000-0000-0000-0000-000000000001', '2026-03-10'),
  ('c7000000-0000-0000-0000-000000000001', 'c7300000-0000-0000-0000-000000000007', '2027-01-15');

-- Davi e Hugo receberam óculos há ~1 ano; Hugo comprou de novo depois
insert into ordens_servico (otica_id, cliente_id, etapa_id, descricao, data_entrega)
select 'c7000000-0000-0000-0000-000000000001', c, (select id from os_etapas where otica_id = 'c7000000-0000-0000-0000-000000000001' order by ordem desc limit 1), 'Óculos', '2026-03-05'
from unnest(array['c7300000-0000-0000-0000-000000000004', 'c7300000-0000-0000-0000-000000000008']::uuid[]) c;
insert into atendimentos (otica_id, cliente_id, etapa_id, descricao, criado_em)
values ('c7000000-0000-0000-0000-000000000001', 'c7300000-0000-0000-0000-000000000008',
        (select id from funil_etapas where otica_id = 'c7000000-0000-0000-0000-000000000001' and tipo = 'aberta' order by ordem limit 1), 'Novo', '2026-11-01');

-- Elisa: orçamento perdido há 45 dias
insert into atendimentos (otica_id, cliente_id, etapa_id, descricao, motivo_perda_id)
values ('c7000000-0000-0000-0000-000000000001', 'c7300000-0000-0000-0000-000000000005',
        (select id from funil_etapas where otica_id = 'c7000000-0000-0000-0000-000000000001' and tipo = 'perdida' limit 1), 'Multifocal',
        (select id from motivos_perda where otica_id = 'c7000000-0000-0000-0000-000000000001' limit 1));
update atendimentos set etapa_desde = '2027-01-15' where cliente_id = 'c7300000-0000-0000-0000-000000000005';

set role authenticated; set request.jwt.claim.sub = 'c7200000-0000-0000-0000-000000000001';
select 'lista' as teste, string_agg(nome || ':' || motivo || ':' || detalhe, ' | ') from clientes_para_chamar('2027-03-01');

-- 29/02 em ano não bissexto: aniversário no dia 28/02
select 'bissexto' as teste, string_agg(nome || ':' || detalhe, ',') from clientes_para_chamar('2027-02-25') where motivo = 'aniversario';

-- chamou a Ana (no dia do teste): sai da lista da receita
insert into cliente_contatos (cliente_id, motivo, criado_em) values ('c7300000-0000-0000-0000-000000000001', 'receita_vencendo', '2027-03-01 10:00');
select 'depois de chamar a Ana' as teste, string_agg(nome, ',' order by nome) from clientes_para_chamar('2027-03-01');
-- não dá para apagar o registro de contato nem marcar em nome de outra pessoa
delete from cliente_contatos;
select 'contatos (esperado 1)' as teste, count(*) from cliente_contatos;
insert into cliente_contatos (cliente_id, motivo, usuario_id) values ('c7300000-0000-0000-0000-000000000002', 'aniversario', 'c7200000-0000-0000-0000-000000000002');
reset role;

-- outra ótica não vê ninguém daqui (e a Iara, de lá, faz aniversário hoje)
set role authenticated; set request.jwt.claim.sub = 'c7200000-0000-0000-0000-000000000002';
select 'outra otica' as teste, string_agg(nome || ':' || motivo, ',') from clientes_para_chamar('2027-03-01');
reset role;
-- o laboratório não vê clientes: lista vazia
set role authenticated; set request.jwt.claim.sub = 'c7200000-0000-0000-0000-000000000003';
select 'laboratorio (esperado 0)' as teste, count(*) from clientes_para_chamar('2027-03-01');
reset role;
-- anônimo não chama a função
set role anon;
select clientes_para_chamar('2027-03-01');
reset role;
