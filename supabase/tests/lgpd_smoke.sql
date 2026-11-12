-- Teste dos direitos do cliente na LGPD (migração 0020): registro de acesso, exportar e anonimizar.
\set ON_ERROR_STOP off
insert into oticas (id, nome, status) values
  ('1a000000-0000-0000-0000-000000000001', 'Ótica LGPD', 'ativa'),
  ('1a000000-0000-0000-0000-000000000002', 'Outra', 'ativa');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select ('1a200000-0000-0000-0000-00000000000' || n)::uuid, o::uuid,
       (select id from perfis where otica_id = o::uuid and chave = k), nm, nm || '@lgpd.com'
from (values (1, '1a000000-0000-0000-0000-000000000001', 'dono', 'Dono'),
             (2, '1a000000-0000-0000-0000-000000000001', 'vendedor', 'Balcao'),
             (3, '1a000000-0000-0000-0000-000000000002', 'dono', 'DonoOutra')) v(n, o, k, nm);

set role authenticated; set request.jwt.claim.sub = '1a200000-0000-0000-0000-000000000002';
insert into clientes (id, nome, telefone, email, cpf, nascimento, endereco) values
  ('1a300000-0000-0000-0000-000000000001', 'Maria da Silva', '27999998888', 'maria@email.com', '12345678909', '1970-05-10', 'Rua A, 10');
insert into anotacoes_cliente (cliente_id, texto) values ('1a300000-0000-0000-0000-000000000001', 'Prefere armação leve');
insert into receitas (id, cliente_id, data_receita, medico) values ('1a400000-0000-0000-0000-000000000001', '1a300000-0000-0000-0000-000000000001', '2026-10-01', 'Dr. João');
update clientes set telefone = '27999997777' where id = '1a300000-0000-0000-0000-000000000001';

-- o balcão abriu a receita duas vezes seguidas: registra uma
select registrar_acesso_saude('1a300000-0000-0000-0000-000000000001', 'viu_receita', 'ficha');
select registrar_acesso_saude('1a300000-0000-0000-0000-000000000001', 'viu_receita', 'ficha');
-- o balcão não lê o registro, não exporta e não anonimiza
select 'balcao ve registro (esperado 0)' as teste, count(*) from acessos_dados_cliente;
select exportar_cliente('1a300000-0000-0000-0000-000000000001');
select anonimizar_cliente('1a300000-0000-0000-0000-000000000001', 'Maria da Silva');
reset role;

-- dono de outra ótica: não acha o cliente
set role authenticated; set request.jwt.claim.sub = '1a200000-0000-0000-0000-000000000003';
select exportar_cliente('1a300000-0000-0000-0000-000000000001');
select registrar_acesso_saude('1a300000-0000-0000-0000-000000000001', 'viu_receita', 'ficha');
reset role;

set role authenticated; set request.jwt.claim.sub = '1a200000-0000-0000-0000-000000000001';
select 'exportar' as teste, x -> 'cliente' ->> 'nome' as nome, jsonb_array_length(x -> 'receitas') as receitas,
       jsonb_array_length(x -> 'anotacoes') as anotacoes, x ? 'otica' as tem_otica, (x -> 'cliente') ? 'otica_id' as vaza_otica_id
from (select exportar_cliente('1a300000-0000-0000-0000-000000000001') x) e;
-- confirmação errada: recusa
select anonimizar_cliente('1a300000-0000-0000-0000-000000000001', 'Maria');
select anonimizar_cliente('1a300000-0000-0000-0000-000000000001', ' maria da silva ');
select 'cliente' as teste, nome, telefone, email, cpf, nascimento, endereco, anonimizado_em is not null as anonimizado from clientes;
select 'receita fica' as teste, count(*), min(medico) from receitas;
select 'anotacoes (esperado 0)' as teste, count(*) from anotacoes_cliente;
select 'de novo' as teste, anonimizar_cliente('1a300000-0000-0000-0000-000000000001', 'Cliente anonimizado');
select 'registro' as teste, string_agg(acao, ',' order by criado_em) from acessos_dados_cliente;
-- ninguém apaga o registro
delete from acessos_dados_cliente;
reset role;
select 'auditoria sem dados pessoais' as teste,
       count(*) filter (where (coalesce(antes, '{}') || coalesce(depois, '{}'))::text ~* 'maria|27999|12345678909|Rua A') as com_dado_pessoal,
       count(*) as linhas
from auditoria where registro_id = '1a300000-0000-0000-0000-000000000001';
