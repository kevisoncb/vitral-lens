-- Teste do fluxo unificado (migração 0005): exame -> receita -> atendimento -> pagamento -> OS com ficha técnica -> produção.
\set ON_ERROR_STOP off
insert into oticas (id, nome, plano, status) values ('90000000-0000-0000-0000-000000000001', 'Ótica Fluxo', 'profissional', 'ativa');
insert into lojas (id, otica_id, nome) values ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'Centro');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select ('92000000-0000-0000-0000-00000000000' || n)::uuid, '90000000-0000-0000-0000-000000000001',
       (select id from perfis where otica_id = '90000000-0000-0000-0000-000000000001' and chave = k), nm, nm || '@fluxo.com'
from (values (1, 'optometrista', 'Dra. Carla'), (2, 'vendedor', 'Juliana'), (3, 'laboratorio', 'Roberto'), (4, 'dono', 'Dono')) v(n, k, nm);
select 'perfil novo ganha consultorio' as teste, permissoes ? 'consultorio' as ok from perfis
 where otica_id = '90000000-0000-0000-0000-000000000001' and chave = 'optometrista';
select 'dono tem consultorio' as teste, permissoes -> 'consultorio' as acoes from perfis
 where otica_id = '90000000-0000-0000-0000-000000000001' and chave = 'dono';
insert into catalogo_itens (otica_id, categoria, nome, preco) values
  ('90000000-0000-0000-0000-000000000001', 'lente', 'Multifocal 1.67', 1200),
  ('90000000-0000-0000-0000-000000000001', 'tratamento', 'Antirreflexo', 200),
  ('90000000-0000-0000-0000-000000000001', 'armacao', 'Armação metal', 380);

-- recepção/dono cadastra o paciente; optometrista faz o exame
set role authenticated; set request.jwt.claim.sub = '92000000-0000-0000-0000-000000000004';
insert into clientes (id, nome, telefone) values ('93000000-0000-0000-0000-000000000001', 'Paciente Teste', '27990001111');
reset role; set role authenticated; set request.jwt.claim.sub = '92000000-0000-0000-0000-000000000001';
insert into exames (id, cliente_id, profissional_id, registro_profissional, queixa)
values ('94000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'CBOO 123', 'Visão embaçada de perto');
insert into exame_olhos (exame_id, olho, av_sc, av_cc, esferico, cilindrico, eixo, adicao, dnp, altura) values
  ('94000000-0000-0000-0000-000000000001', 'OD', '20/40', '20/20', -1.25, -0.50, 180, 2.00, 31.5, 19),
  ('94000000-0000-0000-0000-000000000001', 'OE', '20/50', '20/20', -1.00, -0.75, 10, 2.00, 32.0, 19);
select 'receita gerada' as teste, concluir_exame('94000000-0000-0000-0000-000000000001') is not null as ok;
select 'receita com 2 olhos e medico' as teste, r.medico, r.crm, count(o.*) from receitas r join receita_olhos o on o.receita_id = r.id group by r.medico, r.crm;
update exames set conduta = 'mudou depois' where id = '94000000-0000-0000-0000-000000000001';
update exame_olhos set esferico = 0 where exame_id = '94000000-0000-0000-0000-000000000001';

-- vendedor monta o orçamento e recebe o sinal (sem escolher receita: a OS pega a mais recente)
reset role; set role authenticated; set request.jwt.claim.sub = '92000000-0000-0000-0000-000000000002';
select 'vendedor ve o exame (so leitura)' as teste, count(*) from exames;
insert into atendimentos (id, cliente_id, etapa_id, descricao)
select '95000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', id, 'Multifocal completo'
from funil_etapas where otica_id = '90000000-0000-0000-0000-000000000001' and ordem = 2;
insert into atendimento_itens (atendimento_id, catalogo_item_id, descricao, preco_unitario)
select '95000000-0000-0000-0000-000000000001', id, nome, preco from catalogo_itens where otica_id = '90000000-0000-0000-0000-000000000001';
select 'OS criada' as teste, registrar_pagamento('95000000-0000-0000-0000-000000000001', 500, 'pix', 1::smallint, true, current_date + 7) is not null as ok;

-- laboratório vê a ficha técnica preenchida sozinha e registra a produção
reset role; set role authenticated; set request.jwt.claim.sub = '92000000-0000-0000-0000-000000000003';
select 'ficha tecnica' as teste, lente, tratamentos, armacao, dnp_od, dnp_oe, altura_od, receita_id is not null as tem_receita from ordens_servico;
select 'lab nao ve exame (esperado 0)' as teste, count(*) from exames;
insert into os_producao (os_id, etapa) select id, 'surfacagem' from ordens_servico;
insert into os_producao (os_id, etapa) select id, 'montagem' from ordens_servico;
insert into os_producao (os_id, etapa, aprovado, observacao) select id, 'conferencia', false, 'Eixo fora' from ordens_servico;
select 'producao' as teste, count(*) as etapas, (select retrabalho from ordens_servico) as retrabalho,
       (select motivo_retrabalho from ordens_servico) as motivo from os_producao;
reset role;
