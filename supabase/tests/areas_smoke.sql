-- Teste das áreas e da conversa entre os cards (migração 0006).
\set ON_ERROR_STOP off
insert into oticas (id, nome, status) values ('a6000000-0000-0000-0000-000000000001', 'Ótica Áreas', 'ativa');
insert into lojas (id, otica_id, nome) values ('a6100000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'Centro');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select ('a6200000-0000-0000-0000-00000000000' || n)::uuid, 'a6000000-0000-0000-0000-000000000001',
       (select id from perfis where otica_id = 'a6000000-0000-0000-0000-000000000001' and chave = k), nm, nm || '@areas.com'
from (values (1, 'dono', 'Dono'), (2, 'vendedor', 'Balcão'), (3, 'laboratorio', 'Lab'), (4, 'optometrista', 'Optometrista')) v(n, k, nm);

select 'areas dos perfis' as teste, string_agg(chave || '=' || area, ',' order by chave) from perfis where otica_id = 'a6000000-0000-0000-0000-000000000001';
select 'lab sem clientes' as teste, not (permissoes ? 'clientes') as ok from perfis where otica_id = 'a6000000-0000-0000-0000-000000000001' and chave = 'laboratorio';

-- consultório: cadastra o paciente, faz o exame e conclui -> card na loja
set role authenticated; set request.jwt.claim.sub = 'a6200000-0000-0000-0000-000000000004';
insert into clientes (id, nome, telefone) values ('a6300000-0000-0000-0000-000000000001', 'Carlos Paciente', '27990002222');
insert into exames (id, cliente_id, profissional_id) values ('a6400000-0000-0000-0000-000000000001', 'a6300000-0000-0000-0000-000000000001', 'a6200000-0000-0000-0000-000000000004');
insert into exame_olhos (exame_id, olho, esferico, dnp, altura) values
  ('a6400000-0000-0000-0000-000000000001', 'OD', -2.00, 31, 18), ('a6400000-0000-0000-0000-000000000001', 'OE', -2.25, 31.5, 18);
select concluir_exame('a6400000-0000-0000-0000-000000000001') is not null as receita;
select 'consultorio nao ve vendas (esperado 0)' as teste, count(*) from atendimentos;

-- balcão vê o card que veio do consultório e registra o pagamento -> OS em "Pago"
reset role; set role authenticated; set request.jwt.claim.sub = 'a6200000-0000-0000-0000-000000000002';
select 'card do consultorio' as teste, origem, receita_id is not null as com_receita from atendimentos;
insert into atendimento_itens (atendimento_id, descricao, preco_unitario) select id, 'Visão simples', 300 from atendimentos;
select registrar_pagamento((select id from atendimentos), 300, 'pix') is not null as os;
select 'OS nova em Pago' as teste, e.nome, o.cliente_nome from ordens_servico o join os_etapas e on e.id = o.etapa_id;
-- balcão não pode mover para etapa do laboratório
update ordens_servico set etapa_id = (select id from os_etapas where otica_id = ordens_servico.otica_id and nome = 'No laboratório');

-- laboratório puxa o card, escreve recado, entrega para a loja; não vê clientes
reset role; set role authenticated; set request.jwt.claim.sub = 'a6200000-0000-0000-0000-000000000003';
select 'lab ve clientes (esperado 0)' as teste, count(*) from clientes;
update ordens_servico set etapa_id = (select id from os_etapas where otica_id = ordens_servico.otica_id and nome = 'No laboratório');
select 'puxada pelo lab' as teste, (select nome from usuarios where id = responsavel_lab_id), puxada_em is not null as quando from ordens_servico;
insert into os_mensagens (os_id, texto) select id, 'Armação veio com a haste torta, trocar?' from ordens_servico;
update ordens_servico set etapa_id = (select id from os_etapas where otica_id = ordens_servico.otica_id and nome = 'Chegou na loja');
update ordens_servico set etapa_id = (select id from os_etapas where otica_id = ordens_servico.otica_id and nome = 'Entregue');

-- balcão lê o recado e avisa o cliente
reset role; set role authenticated; set request.jwt.claim.sub = 'a6200000-0000-0000-0000-000000000002';
select 'balcao le recado' as teste, area, texto from os_mensagens;
update ordens_servico set etapa_id = (select id from os_etapas where otica_id = ordens_servico.otica_id and nome = 'Cliente avisado');
select 'etapa final do teste' as teste, e.nome from ordens_servico o join os_etapas e on e.id = o.etapa_id;

-- gestão move qualquer etapa; plano único: segunda loja só com adicional
reset role; set role authenticated; set request.jwt.claim.sub = 'a6200000-0000-0000-0000-000000000001';
update ordens_servico set etapa_id = (select id from os_etapas where otica_id = ordens_servico.otica_id and nome = 'Em montagem');
select 'gestao moveu' as teste, e.nome from ordens_servico o join os_etapas e on e.id = o.etapa_id;
select 'nota fiscal sem adicional (esperado f)' as teste, recurso_ativo('nota_fiscal');
select 'agenda no plano unico (esperado t)' as teste, recurso_ativo('agenda'), recurso_ativo('relatorios');
insert into lojas (otica_id, nome) values ('a6000000-0000-0000-0000-000000000001', 'Segunda loja');
reset role;
insert into otica_adicionais (otica_id, recurso, quantidade) values ('a6000000-0000-0000-0000-000000000001', 'multiloja', 1);
set role authenticated; set request.jwt.claim.sub = 'a6200000-0000-0000-0000-000000000001';
insert into lojas (otica_id, nome) values ('a6000000-0000-0000-0000-000000000001', 'Segunda loja');
select 'lojas com adicional (esperado 2)' as teste, count(*) from lojas;
reset role;

-- balcão cadastra produto na hora da venda
set role authenticated; set request.jwt.claim.sub = 'a6200000-0000-0000-0000-000000000002';
insert into catalogo_itens (categoria, nome, preco, criado_na_venda) values ('armacao', 'Armação Ray-X preta', 450, true);
select 'produto criado na venda' as teste, nome, criado_na_venda, criado_por is not null as autor from catalogo_itens;
update catalogo_itens set preco = 1;   -- balcão não edita preço (sem catalogo:editar): 0 linhas
select 'preco intacto' as teste, preco from catalogo_itens;
reset role;

-- foto do produto: quem cadastrou na venda põe a primeira; trocar depois é do gerente
set role authenticated; set request.jwt.claim.sub = 'a6200000-0000-0000-0000-000000000002';
select 'balcao poe primeira foto' as teste, definir_foto_produto((select id from catalogo_itens where nome = 'Armação Ray-X preta'), 'a6000000-0000-0000-0000-000000000001/x/foto.jpg');
select definir_foto_produto((select id from catalogo_itens where nome = 'Armação Ray-X preta'), 'a6000000-0000-0000-0000-000000000001/x/outra.jpg');
reset role;
