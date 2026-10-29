-- Teste de fumaça das permissões e do isolamento entre óticas.
-- Os erros "row-level security" e "Informe o motivo da perda" são ESPERADOS: provam que o bloqueio funciona.
-- Uso: psql -f stub_supabase.sql; psql -f ../migrations/0001_base_multiempresa.sql; psql -f rls_smoke.sql
\set ON_ERROR_STOP off
-- duas óticas (o trigger cria perfis, etapas e motivos)
insert into oticas (id, nome, plano, status) values
  ('a0000000-0000-0000-0000-000000000001', 'Ótica Ômega', 'profissional', 'ativa'),
  ('b0000000-0000-0000-0000-000000000002', 'Ótica Concorrente', 'essencial', 'ativa');
insert into lojas (id, otica_id, nome) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Centro');
-- usuários: dono e vendedor da Ômega, dono da outra
insert into usuarios (id, otica_id, perfil_id, nome, email)
select ('c0000000-0000-0000-0000-00000000000' || n)::uuid, o, (select id from perfis where otica_id = o and chave = k), nm, nm || '@x.com'
from (values (1, 'a0000000-0000-0000-0000-000000000001'::uuid, 'dono', 'dono_omega'),
             (2, 'a0000000-0000-0000-0000-000000000001'::uuid, 'vendedor', 'vend_omega'),
             (3, 'b0000000-0000-0000-0000-000000000002'::uuid, 'dono', 'dono_outra'),
             (4, 'a0000000-0000-0000-0000-000000000001'::uuid, 'laboratorio', 'lab_omega')) v(n, o, k, nm);

select 'padrões criados' as teste, (select count(*) from perfis where otica_id = 'a0000000-0000-0000-0000-000000000001') as perfis,
       (select count(*) from funil_etapas where otica_id = 'a0000000-0000-0000-0000-000000000001') as etapas,
       (select count(*) from os_etapas where otica_id = 'a0000000-0000-0000-0000-000000000001') as os_etapas;

-- vendedor da Ômega cria cliente e atendimento
set role authenticated; set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000002';
insert into clientes (otica_id, nome, telefone) values ('a0000000-0000-0000-0000-000000000001', 'Ana Paula', '27999990000');
select 'vendedor vê 1 cliente' as teste, count(*) from clientes;
-- vendedor tenta criar cliente em OUTRA ótica (deve falhar)
insert into clientes (otica_id, nome) values ('b0000000-0000-0000-0000-000000000002', 'Invasor');
-- vendedor não vê financeiro nem relatórios
select 'vendedor financeiro (esperado 0)' as teste, count(*) from contas_pagar;
insert into contas_pagar (otica_id, descricao, valor, vencimento) values ('a0000000-0000-0000-0000-000000000001', 'x', 10, current_date);

-- card do funil: mover para Perdido sem motivo deve falhar
insert into atendimentos (otica_id, loja_id, cliente_id, etapa_id, descricao, valor_total)
select 'a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', c.id,
       (select id from funil_etapas where nome = 'Atendimento' and otica_id = c.otica_id), 'Multifocal', 1500 from clientes c;
update atendimentos set etapa_id = (select id from funil_etapas where nome = 'Perdido' and otica_id = atendimentos.otica_id);
update atendimentos set etapa_id = (select id from funil_etapas where nome = 'Perdido' and otica_id = atendimentos.otica_id),
                        motivo_perda_id = (select id from motivos_perda where nome = 'Achou caro' and otica_id = atendimentos.otica_id);
select 'perdido com motivo' as teste, f.nome as etapa, m.nome as motivo
from atendimentos a join funil_etapas f on f.id = a.etapa_id left join motivos_perda m on m.id = a.motivo_perda_id;

-- vendedor cria OS pela função, mesmo sem permissão de criar no laboratório
select 'OS criada pela função' as teste, (criar_os_do_atendimento((select id from atendimentos limit 1), current_date + 7)) is not null as ok;
select 'numero da OS' as teste, numero from ordens_servico;
insert into ordens_servico (otica_id, cliente_id, etapa_id, descricao)
select otica_id, cliente_id, etapa_id, 'direto' from ordens_servico;   -- deve falhar (vendedor só vê o laboratório)

-- laboratório move a OS até Entregue: histórico e garantia
reset role; set role authenticated; set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000004';
select 'lab vê a OS' as teste, count(*) from ordens_servico;
select 'lab não vê valores (sem acesso a atendimentos)' as teste, count(*) from atendimentos;
update ordens_servico set etapa_id = (select id from os_etapas where nome = 'Entregue' and otica_id = ordens_servico.otica_id);
select 'entregue' as teste, data_entrega is not null as entrega, garantia_ate is not null as garantia, (select count(*) from os_historico) as historico from ordens_servico;

-- dono da outra ótica não vê nada da Ômega
reset role; set role authenticated; set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000003';
select 'outra ótica: clientes (esperado 0)' as teste, count(*) from clientes;
select 'outra ótica: OS (esperado 0)' as teste, count(*) from ordens_servico;
select 'outra ótica: usuarios (esperado 1)' as teste, count(*) from usuarios;
-- plano essencial não tem agenda
insert into consultas (otica_id, loja_id, inicio, fim) values ('b0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', now(), now() + interval '1 hour');

-- dono da Ômega: auditoria, PDV/financeiro (plano profissional) e agenda sem conflito
reset role; set role authenticated; set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
select 'dono vê auditoria' as teste, count(*) > 0 as ok from auditoria;
insert into contas_pagar (otica_id, descricao, valor, vencimento) values ('a0000000-0000-0000-0000-000000000001', 'Aluguel', 3200, current_date);
select 'dono lança conta a pagar' as teste, count(*) from contas_pagar;
insert into consultas (otica_id, loja_id, profissional_id, inicio, fim) values
  ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-11-10 15:00-03', '2026-11-10 16:00-03');
insert into consultas (otica_id, loja_id, profissional_id, inicio, fim) values
  ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-11-10 15:30-03', '2026-11-10 16:30-03');
select 'horários ocupados no dia' as teste, * from horarios_ocupados('a1000000-0000-0000-0000-000000000001', '2026-11-10');
-- dono não consegue mudar o próprio plano
update oticas set plano = 'rede';
-- fim
reset role;

-- regressão: o laboratório cria OS direto; o vendedor, não
set role authenticated; set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000004';
insert into ordens_servico (otica_id, cliente_id, etapa_id, descricao)
select o.otica_id, o.cliente_id, (select id from os_etapas where nome = 'Pago' and otica_id = o.otica_id), 'refeita'
from ordens_servico o limit 1;
select 'lab criou OS direto (esperado numeros 1,2)' as teste, string_agg(numero::text, ',' order by numero) from ordens_servico;
reset role; set role authenticated; set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000002';
insert into ordens_servico (otica_id, cliente_id, etapa_id, descricao)
select o.otica_id, o.cliente_id, o.etapa_id, 'vendedor direto' from ordens_servico o limit 1;
reset role;
