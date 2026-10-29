-- Teste do site público (migração 0004). Rodar depois de stub e 0001..0004, em banco limpo ou junto dos outros.
\set ON_ERROR_STOP off
insert into oticas (id, nome, plano, status) values
  ('f0000000-0000-0000-0000-000000000001', 'Ótica Site', 'profissional', 'ativa'),
  ('f0000000-0000-0000-0000-000000000002', 'Ótica Básica', 'essencial', 'ativa');
update oticas set slug = 'otica-site', site_publicado = true where id = 'f0000000-0000-0000-0000-000000000001';
update oticas set slug = 'otica-basica', site_publicado = true where id = 'f0000000-0000-0000-0000-000000000002';
insert into lojas (id, otica_id, nome) values
  ('f1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Centro'),
  ('f1000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'Centro');
-- atende todos os dias das 09:00 às 12:00, consultas de 60 min
insert into horarios_trabalho (otica_id, loja_id, dia_semana, inicio, fim, duracao_min)
select 'f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', d, '09:00', '12:00', 60
from generate_series(0, 6) d;

set role anon;
select 'site publico' as teste, nome, agendamento_online from site_da_otica('otica-site');
select 'site inexistente (esperado 0)' as teste, count(*) from site_da_otica('nao-existe');
select 'anon nao le clientes (esperado 0)' as teste, count(*) from clientes;

-- pedido de orçamento
select 'pedido site' as teste, pedido_orcamento_site('otica-site', 'Maria Teste', '(27) 99888-7766', 'Quero multifocal', true) as ok;
select pedido_orcamento_site('otica-site', 'Maria Teste', '27998887766', 'sem aceite', false);
select pedido_orcamento_site('otica-site', 'X', '123', 'telefone ruim', true);
select pedido_orcamento_site('otica-site', 'Maria Teste', '27998887766', 'segundo', true);
select pedido_orcamento_site('otica-site', 'Maria Teste', '27998887766', 'terceiro', true);
select pedido_orcamento_site('otica-site', 'Maria Teste', '27998887766', 'quarto (bloqueado)', true);

-- agendamento online: amanhã tem 3 vagas; marca uma, sobram 2; a mesma de novo falha
select 'vagas amanha (esperado 3)' as teste, count(*) from horarios_livres('otica-site', current_date + 1);
select 'agendou' as teste, agendar_pelo_site('otica-site', (select min(inicio) from horarios_livres('otica-site', current_date + 1)), 'João', '27991112233', true) as ok;
select 'vagas depois (esperado 2)' as teste, count(*) from horarios_livres('otica-site', current_date + 1);
select agendar_pelo_site('otica-site', (select (current_date + 1 + time '09:00') at time zone 'America/Sao_Paulo'), 'Outro', '27994445566', true);
select 'sem horarios cadastrados (esperado 0)' as teste, count(*) from horarios_livres('otica-basica', current_date + 1);
select mover_sem_retorno();
select proximo_numero('f0000000-0000-0000-0000-000000000001', 'os');
reset role;

select 'cards do site (esperado 3)' as teste, count(*) from atendimentos where origem = 'site';
select 'cliente reaproveitado (esperado 1)' as teste, count(*) from clientes where otica_id = 'f0000000-0000-0000-0000-000000000001';

-- sem retorno: card em "Orçamento enviado" há 4 dias vai para "Sem retorno"
update atendimentos set etapa_id = (select id from funil_etapas where otica_id = atendimentos.otica_id and nome = 'Orçamento enviado')
 where otica_id = 'f0000000-0000-0000-0000-000000000001';
update atendimentos set etapa_desde = now() - interval '4 days' where otica_id = 'f0000000-0000-0000-0000-000000000001';
select 'sem retorno movidos (esperado 3)' as teste, mover_sem_retorno();
select 'etapa agora' as teste, f.nome, count(*) from atendimentos a join funil_etapas f on f.id = a.etapa_id
 where a.otica_id = 'f0000000-0000-0000-0000-000000000001' group by f.nome;

-- proteções da equipe
insert into usuarios (id, otica_id, perfil_id, nome, email)
select 'f2000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', id, 'Dono', 'dono@site.com'
from perfis where otica_id = 'f0000000-0000-0000-0000-000000000001' and chave = 'dono';
update perfis set permissoes = '{}' where otica_id = 'f0000000-0000-0000-0000-000000000001' and chave = 'dono';
update usuarios set ativo = false where id = 'f2000000-0000-0000-0000-000000000001';
delete from perfis where otica_id = 'f0000000-0000-0000-0000-000000000001' and chave = 'vendedor';
select 'dono continua ativo' as teste, ativo from usuarios where id = 'f2000000-0000-0000-0000-000000000001';
-- apagar a ótica inteira (service role) continua funcionando
delete from oticas where id = 'f0000000-0000-0000-0000-000000000001';
select 'otica apagada em cascata' as teste, count(*) = 0 as ok from perfis where otica_id = 'f0000000-0000-0000-0000-000000000001';
