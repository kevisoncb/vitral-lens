-- Teste da Versão 2 (migração 0010): importação de planilhas e lista de espera do Vitra.
\set ON_ERROR_STOP off
insert into oticas (id, nome, status) values ('a7000000-0000-0000-0000-000000000001', 'Ótica Importa', 'ativa');
insert into oticas (id, nome, status) values ('a7000000-0000-0000-0000-000000000002', 'Ótica Vizinha', 'ativa');
insert into usuarios (id, otica_id, perfil_id, nome, email)
select ('a7200000-0000-0000-0000-00000000000' || n)::uuid, o::uuid,
       (select id from perfis where otica_id = o::uuid and chave = k), nm, nm || '@importa.com'
from (values (1, 'a7000000-0000-0000-0000-000000000001', 'dono', 'Dono'),
             (2, 'a7000000-0000-0000-0000-000000000001', 'laboratorio', 'Lab'),
             (3, 'a7000000-0000-0000-0000-000000000002', 'dono', 'Vizinho')) v(n, o, k, nm);
-- cliente que já existe (telefone com pontuação diferente)
insert into clientes (otica_id, nome, telefone) values ('a7000000-0000-0000-0000-000000000001', 'Já Existe', '(27) 99999-0001');

set role authenticated; set request.jwt.claim.sub = 'a7200000-0000-0000-0000-000000000001';
select 'importar clientes' as teste, importar_clientes('[
  {"nome": "Ana Souza", "telefone": "27 99999-0002", "cpf": "123.456.789-01", "nascimento": "1980-05-01"},
  {"nome": "Bruno Lima", "telefone": "27999990003", "email": "BRUNO@EXEMPLO.COM"},
  {"nome": "Repetido do banco", "telefone": "27999990001"},
  {"nome": "Repetido da planilha", "cpf": "12345678901"},
  {"nome": "", "telefone": "27999990004"},
  {"nome": "CPF curto", "cpf": "123"},
  {"nome": "Data ruim", "nascimento": "31/02/1990"}
]'::jsonb) as resultado;
select 'clientes depois (esperado 3)' as teste, count(*) from clientes;
select 'email minusculo' as teste, email from clientes where nome = 'Bruno Lima';

select 'importar produtos' as teste, importar_produtos('[
  {"categoria": "armacao", "nome": "Armação Aro Preto", "preco": 350, "marca": "Vitral", "codigo": "AR-01"},
  {"categoria": "lente", "nome": "Visão simples 1.56", "preco": "180.5"},
  {"categoria": "armacao", "nome": "Outro nome mesmo código", "preco": 10, "codigo": "AR-01"},
  {"categoria": "lente", "nome": "VISÃO SIMPLES 1.56", "preco": 1},
  {"categoria": "oculos", "nome": "Categoria errada", "preco": 1},
  {"categoria": "lente", "nome": "Sem preço"}
]'::jsonb) as resultado;
select 'produtos depois (esperado 2)' as teste, count(*) from catalogo_itens;
reset role;

-- outra ótica importa o mesmo telefone: não é repetido (cada ótica tem os seus clientes)
set role authenticated; set request.jwt.claim.sub = 'a7200000-0000-0000-0000-000000000003';
select 'vizinha importa (esperado 1 inserido)' as teste, importar_clientes('[{"nome": "Ana da vizinha", "telefone": "27999990002"}]'::jsonb) ->> 'inseridos';
select 'vizinha ve so os seus (esperado 1)' as teste, count(*) from clientes;
reset role;

-- laboratório não importa clientes
set role authenticated; set request.jwt.claim.sub = 'a7200000-0000-0000-0000-000000000002';
select importar_clientes('[{"nome": "Não pode"}]'::jsonb);
reset role;

-- lista de espera (site do Vitra, sem login)
set role anon;
select 'lista de espera' as teste, entrar_lista_espera('Maria', 'Ótica Sol', 'Colatina', 'es', '(27) 98888-0000', 'maria@sol.com', 1, true);
select 'lista mesmo telefone' as teste, entrar_lista_espera('Maria', 'Ótica Sol', 'Colatina', 'ES', '27988880000', null, 1, true);
select entrar_lista_espera('Maria', 'Ótica Sol', null, null, '27988880000', null, null, false);
select entrar_lista_espera('Maria', 'Ótica Sol', null, null, '123', null, null, true);
select count(*) from lista_espera;            -- anon não lê a lista
select importar_clientes('[]'::jsonb);         -- anon não importa
reset role;
select 'inscritos (esperado 1)' as teste, count(*), max(uf) from lista_espera;
