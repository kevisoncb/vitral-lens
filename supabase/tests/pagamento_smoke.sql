-- Teste do pagamento (migração 0002). Rodar depois de stub, 0001 e 0002 num banco limpo.
\set ON_ERROR_STOP off
insert into oticas (id, nome, plano, status) values
  ('d0000000-0000-0000-0000-000000000001', 'Óticas Nery', 'profissional', 'ativa');
insert into lojas (id, otica_id, nome) values
  ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Centro');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select ('e0000000-0000-0000-0000-00000000000' || n)::uuid, 'd0000000-0000-0000-0000-000000000001',
       (select id from perfis where otica_id = 'd0000000-0000-0000-0000-000000000001' and chave = k), nm, nm || '@x.com'
from (values (2, 'vendedor', 'vend'), (4, 'laboratorio', 'lab')) v(n, k, nm);

set role authenticated; set request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000002';
-- otica_id e preenchido sozinho
insert into clientes (nome, telefone) values ('Ana Paula', '27999990000');
select 'otica_id automatico' as teste, otica_id = 'd0000000-0000-0000-0000-000000000001' as ok from clientes;
insert into atendimentos (cliente_id, etapa_id, loja_id, descricao)
select id, (select id from funil_etapas where nome = 'Orçamento enviado'), 'd1000000-0000-0000-0000-000000000001', 'Multifocal'
from clientes;
insert into atendimento_itens (atendimento_id, descricao, quantidade, preco_unitario)
select id, 'Lente', 1, 980 from atendimentos;
insert into atendimento_itens (atendimento_id, descricao, quantidade, preco_unitario)
select id, 'Armação', 2, 190.50 from atendimentos;
select 'total recalculado (esperado 1361.00)' as teste, valor_total from atendimentos;

-- sinal: vira ganho e cria a OS
select 'OS criada no sinal' as teste, registrar_pagamento((select id from atendimentos), 500, 'pix', 1::smallint, true, current_date + 7) is not null as ok;
select 'etapa apos sinal (esperado Recuperado ou Ganho)' as teste, f.nome, f.tipo from atendimentos a join funil_etapas f on f.id = a.etapa_id;
-- saldo: não cria outra OS
select 'saldo nao duplica OS' as teste, registrar_pagamento((select id from atendimentos), 861, 'credito', 3::smallint, false, null) is not null as ok;
select 'qtd OS (esperado 1)' as teste, count(*) from ordens_servico;
select 'pago (esperado 1361.00)' as teste, sum(valor) from pagamentos;
-- valor inválido
select registrar_pagamento((select id from atendimentos), 0, 'pix');

-- laboratório não registra pagamento
reset role; set role authenticated; set request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000004';
select registrar_pagamento((select id from atendimentos), 10, 'pix');
