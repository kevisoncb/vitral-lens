-- Teste da emissão de NFC-e (migração 0018): preparação, retorno da SEFAZ e cancelamento.
\set ON_ERROR_STOP off
insert into oticas (id, nome, status, cnpj) values ('ad000000-0000-0000-0000-000000000001', 'Ótica Fiscal', 'ativa', '12.345.678/0001-90');
insert into lojas (id, otica_id, nome) values ('ad100000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000001', 'Centro');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select ('ad200000-0000-0000-0000-00000000000' || n)::uuid, 'ad000000-0000-0000-0000-000000000001',
       (select id from perfis where otica_id = 'ad000000-0000-0000-0000-000000000001' and chave = k), nm, nm || '@fiscal.com'
from (values (1, 'dono', 'Dono'), (2, 'caixa', 'Caixa')) v(n, k, nm);
insert into vitral_admins (usuario_id, email) values ('ad900000-0000-0000-0000-000000000001', 'admin@vitral.com');

-- dono cadastra produtos (o estojo ainda sem dados fiscais) e um cliente com CPF
set role authenticated; set request.jwt.claim.sub = 'ad200000-0000-0000-0000-000000000001';
insert into catalogo_itens (id, categoria, nome, preco, codigo, ncm, origem, csosn) values
  ('ad300000-0000-0000-0000-000000000001', 'armacao', 'Armação preta', 300, '7891234567895', '90031100', 0, '102');
insert into catalogo_itens (id, categoria, nome, preco, codigo) values
  ('ad300000-0000-0000-0000-000000000002', 'acessorio', 'Estojo', 50, 'EST-1');
insert into clientes (id, nome, cpf) values ('ad400000-0000-0000-0000-000000000001', 'Cliente Fiscal', '123.456.789-01');
reset role;

-- caixa vende: 1 armação + 2 estojos = 400, desconto 10 (até 10% pode), Pix 190 + crédito 200
set role authenticated; set request.jwt.claim.sub = 'ad200000-0000-0000-0000-000000000002';
select abrir_caixa(null, 0) is not null as caixa;
select registrar_venda((select id from caixas where fechado_em is null), 'ad400000-0000-0000-0000-000000000001',
  '[{"item_id": "ad300000-0000-0000-0000-000000000001", "quantidade": 1}, {"item_id": "ad300000-0000-0000-0000-000000000002", "quantidade": 2}]',
  10, '[{"forma": "pix", "valor": 190}, {"forma": "credito", "valor": 200, "parcelas": 2}]') is not null as venda;
-- sem o adicional de nota fiscal
select preparar_nfce((select id from vendas limit 1));
reset role;
insert into otica_adicionais (otica_id, recurso) values ('ad000000-0000-0000-0000-000000000001', 'nota_fiscal');

-- sem o token configurado
set role authenticated; set request.jwt.claim.sub = 'ad200000-0000-0000-0000-000000000002';
select preparar_nfce((select id from vendas limit 1));
reset role;
-- equipe do Vitral configura o token (dono da ótica não consegue)
set role authenticated; set request.jwt.claim.sub = 'ad200000-0000-0000-0000-000000000001';
select painel_definir_credenciais_nfce('ad000000-0000-0000-0000-000000000001', 'homologacao', 'tok-h', null);
select count(*) from nfe_credenciais;
reset role;
set role authenticated; set request.jwt.claim.sub = 'ad900000-0000-0000-0000-000000000001';
select 'token configurado' as teste, painel_definir_credenciais_nfce('ad000000-0000-0000-0000-000000000001', 'homologacao', 'tok-h', 'tok-p');
reset role;

-- estojo sem NCM/origem/CSOSN: recusa e diz qual
set role authenticated; set request.jwt.claim.sub = 'ad200000-0000-0000-0000-000000000002';
select preparar_nfce((select id from vendas limit 1));
reset role;
update catalogo_itens set ncm = '42029200', origem = 0, csosn = '102', unidade = 'UN' where id = 'ad300000-0000-0000-0000-000000000002';

set role authenticated; set request.jwt.claim.sub = 'ad200000-0000-0000-0000-000000000002';
select preparar_nfce((select id from vendas limit 1)) as nf \gset
select 'preparada' as teste, (:'nf'::jsonb) ->> 'ambiente' as ambiente, (:'nf'::jsonb) ->> 'token' as token,
       (:'nf'::jsonb) #>> '{dados,cnpj_emitente}' as cnpj, (:'nf'::jsonb) #>> '{dados,cpf_destinatario}' as cpf;
select 'itens' as teste, string_agg((i ->> 'numero_item') || ':' || (i ->> 'codigo_ncm') || '/' || (i ->> 'icms_situacao_tributaria') || '/'
       || (i ->> 'valor_bruto') || '-' || (i ->> 'valor_desconto'), ' ' order by (i ->> 'numero_item')::int)
from jsonb_array_elements((:'nf'::jsonb) #> '{dados,items}') i;
select 'desconto rateado' as teste, sum((i ->> 'valor_desconto')::numeric) from jsonb_array_elements((:'nf'::jsonb) #> '{dados,items}') i;
select 'pagamentos' as teste, string_agg((p ->> 'forma_pagamento') || '=' || (p ->> 'valor_pagamento') || coalesce('/integ' || (p ->> 'tipo_integracao'), ''), ' ' order by p ->> 'forma_pagamento')
from jsonb_array_elements((:'nf'::jsonb) #> '{dados,formas_pagamento}') p;
-- sem resposta da SEFAZ ainda: preparar de novo retoma a mesma nota (mesma referência)
select 'retoma a mesma' as teste, preparar_nfce((select id from vendas limit 1)) ->> 'referencia' = (:'nf'::jsonb) ->> 'referencia';
select 'notas da venda (esperado 1)' as teste, count(*) from notas_fiscais;
-- SEFAZ autorizou
select 'retorno' as teste, registrar_retorno_nfce(((:'nf'::jsonb) ->> 'nota_id')::uuid,
  '{"status": "autorizado", "numero": "15", "serie": "1", "chave_nfe": "32261112345678000190650010000000151000000150", "caminho_danfe": "/arquivos/danfe.html", "qrcode_url": "https://sefaz/qr"}');
select 'nota' as teste, status, numero, chave is not null as chave, caminho_danfe from notas_fiscais;
-- autorizada: a mesma venda de novo é recusada
select preparar_nfce((select id from vendas limit 1));
-- caixa não cancela
select preparar_cancelamento_nfce(((:'nf'::jsonb) ->> 'nota_id')::uuid, 'Cliente desistiu da compra na hora');
reset role;

-- gerente cancela: justificativa curta é recusada; a válida passa
set role authenticated; set request.jwt.claim.sub = 'ad200000-0000-0000-0000-000000000001';
select preparar_cancelamento_nfce(((:'nf'::jsonb) ->> 'nota_id')::uuid, 'desistiu');
select 'pode cancelar' as teste, preparar_cancelamento_nfce(((:'nf'::jsonb) ->> 'nota_id')::uuid, 'Cliente desistiu da compra na hora') ->> 'referencia' = (:'nf'::jsonb) ->> 'referencia';
select 'cancelada' as teste, registrar_cancelamento_nfce(((:'nf'::jsonb) ->> 'nota_id')::uuid, 'Cliente desistiu da compra na hora', true, 'Cancelamento homologado');
select 'nota depois' as teste, status, justificativa from notas_fiscais;
reset role;
