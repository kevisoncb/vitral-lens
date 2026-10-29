-- Teste do painel do Vitra (migração 0014).
\set ON_ERROR_STOP off
insert into vitra_admins (usuario_id, email) values ('ab000000-0000-0000-0000-000000000001', 'admin@vitra.com');
insert into oticas (id, nome, status) values ('ab100000-0000-0000-0000-000000000001', 'Ótica Painel', 'ativa');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select 'ab200000-0000-0000-0000-000000000001', 'ab100000-0000-0000-0000-000000000001', id, 'Dono Painel', 'dono@painel.com'
from perfis where otica_id = 'ab100000-0000-0000-0000-000000000001' and chave = 'dono';

-- dono de uma ótica não entra no painel
set role authenticated; set request.jwt.claim.sub = 'ab200000-0000-0000-0000-000000000001';
select 'dono e admin? (esperado f)' as teste, sou_admin_vitra();
select * from painel_oticas();
select count(*) from vitra_admins;
reset role;

-- admin cria ótica com dono, liga adicional, suspende e lê a lista de espera
set role authenticated; set request.jwt.claim.sub = 'ab000000-0000-0000-0000-000000000001';
select 'admin? (esperado t)' as teste, sou_admin_vitra();
select 'criou' as teste, painel_criar_otica('Ótica Nova', 'otica-nova', 'ab200000-0000-0000-0000-000000000009', 'Nova Dona', 'Nova@Otica.com') is not null;
select painel_criar_otica('Outra', 'otica-nova', 'ab200000-0000-0000-0000-000000000008', 'X', 'x@x.com');      -- slug repetido
select painel_criar_otica('Outra', 'outra', 'ab200000-0000-0000-0000-000000000001', 'X', 'x@x.com');           -- login já é de ótica
select 'adicional' as teste, painel_definir_adicional((select id from painel_oticas() where slug = 'otica-nova'), 'multiloja', 2);
select 'suspendeu' as teste, painel_mudar_status((select id from painel_oticas() where slug = 'otica-nova'), 'suspensa');
select 'painel' as teste, nome, status, usuarios, lojas, adicionais, dono_email from painel_oticas() where slug = 'otica-nova';
select painel_mudar_status('ab100000-0000-0000-0000-00000000ffff', 'ativa');
select 'lista de espera lida' as teste, count(*) >= 0 from painel_lista_espera();
reset role;

-- a dona da ótica nova entra com o perfil dono, na área de gestão (ótica suspensa: sem acesso aos dados)
set role authenticated; set request.jwt.claim.sub = 'ab200000-0000-0000-0000-000000000009';
select 'dona da nova (suspensa) ve a otica? (esperado 0)' as teste, count(*) from oticas;
reset role;
