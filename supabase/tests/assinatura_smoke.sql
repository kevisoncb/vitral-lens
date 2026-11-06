-- Teste da assinatura da OS pelo link (migração 0021).
\set ON_ERROR_STOP off
insert into oticas (id, nome, status) values ('a5000000-0000-0000-0000-000000000001', 'Ótica Assina', 'ativa');
insert into lojas (id, otica_id, nome) values ('a5100000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'Centro');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select ('a5200000-0000-0000-0000-00000000000' || n)::uuid, 'a5000000-0000-0000-0000-000000000001',
       (select id from perfis where otica_id = 'a5000000-0000-0000-0000-000000000001' and chave = k), nm, nm || '@assina.com'
from (values (1, 'vendedor', 'Balcao'), (2, 'laboratorio', 'Lab')) v(n, k, nm);

set role authenticated; set request.jwt.claim.sub = 'a5200000-0000-0000-0000-000000000001';
insert into clientes (id, nome, telefone) values ('a5300000-0000-0000-0000-000000000001', 'Rosa Lima', '27999990000');
insert into receitas (id, cliente_id, data_receita, medico) values ('a5400000-0000-0000-0000-000000000001', 'a5300000-0000-0000-0000-000000000001', '2026-10-20', 'Dra. Ana');
insert into receita_olhos (receita_id, olho, distancia, esferico, cilindrico, eixo) values
  ('a5400000-0000-0000-0000-000000000001', 'OD', 'longe', -1.25, -0.50, 180),
  ('a5400000-0000-0000-0000-000000000001', 'OE', 'longe', -1.00, null, null);
insert into atendimentos (id, cliente_id, etapa_id, loja_id, descricao, receita_id)
values ('a5500000-0000-0000-0000-000000000001', 'a5300000-0000-0000-0000-000000000001',
        (select id from funil_etapas where nome = 'Orçamento enviado'), 'a5100000-0000-0000-0000-000000000001', 'Visão simples',
        'a5400000-0000-0000-0000-000000000001');
insert into atendimento_itens (atendimento_id, descricao, quantidade, preco_unitario) values
  ('a5500000-0000-0000-0000-000000000001', 'Lente 1.67 antirreflexo', 1, 640), ('a5500000-0000-0000-0000-000000000001', 'Armação acetato', 1, 300);
select registrar_pagamento('a5500000-0000-0000-0000-000000000001', 400, 'pix', 1::smallint, true, '2026-11-20') is not null as os_criada;

-- gera o link; pedir de novo devolve o mesmo
create temp table t as select gerar_link_assinatura((select id from ordens_servico)) as token;
grant select on t to anon;
select 'mesmo link' as teste, gerar_link_assinatura((select id from ordens_servico)) = (select token from t) as ok;
reset role;

-- laboratório não gera link nem lê as assinaturas (têm valores)
set role authenticated; set request.jwt.claim.sub = 'a5200000-0000-0000-0000-000000000002';
select gerar_link_assinatura((select id from ordens_servico));
select 'lab ve assinaturas (esperado 0)' as teste, count(*) from os_assinaturas;
reset role;

-- o cliente, sem login, vê o resumo pelo token
set role anon;
select 'resumo' as teste, x ->> 'situacao' as situacao, x -> 'resumo' ->> 'cliente' as cliente, x -> 'resumo' ->> 'total' as total,
       x -> 'resumo' ->> 'pago' as pago, jsonb_array_length(x -> 'resumo' -> 'receita' -> 'olhos') as olhos, jsonb_array_length(x -> 'resumo' -> 'itens') as itens
from (select os_para_assinar((select token from t)) x) s;
select 'token errado' as teste, os_para_assinar(gen_random_uuid()) is null as nada;
-- anon não lê a tabela nem gera link
select count(*) from os_assinaturas;
select gerar_link_assinatura(gen_random_uuid());
-- assinatura vazia ou nome curto: recusa
select assinar_os((select token from t), 'Rosa Lima', 'abc');
select assinar_os((select token from t), 'Ro', 'data:image/png;base64,' || repeat('A', 300));
select assinar_os((select token from t), 'Rosa Lima', 'data:image/png;base64,' || repeat('A', 300), '200.1.2.3', 'Celular');
select 'depois' as teste, x ->> 'situacao', x ->> 'nome_assinante' from (select os_para_assinar((select token from t)) x) s;
-- só assina uma vez
select assinar_os((select token from t), 'Outra Pessoa', 'data:image/png;base64,' || repeat('B', 300));
reset role;

set role authenticated; set request.jwt.claim.sub = 'a5200000-0000-0000-0000-000000000001';
select 'recado na OS' as teste, texto from os_mensagens;
-- OS assinada: não gera outro link
select gerar_link_assinatura((select id from ordens_servico));
reset role;
-- link vencido
insert into os_assinaturas (otica_id, os_id, resumo, expira_em, token)
values ('a5000000-0000-0000-0000-000000000001', (select id from ordens_servico where otica_id = 'a5000000-0000-0000-0000-000000000001'), '{}', now() - interval '1 day', 'a5900000-0000-0000-0000-000000000001');
set role anon;
select 'vencido' as teste, os_para_assinar('a5900000-0000-0000-0000-000000000001') ->> 'situacao';
select assinar_os('a5900000-0000-0000-0000-000000000001', 'Rosa Lima', 'data:image/png;base64,' || repeat('A', 300));
reset role;
