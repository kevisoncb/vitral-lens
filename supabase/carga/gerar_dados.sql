-- Teste de carga: 1.000 óticas com dados de uma ótica pequena/média de interior.
-- Por ótica: 600 clientes, 300 receitas, 400 atendimentos (1.000 itens), 250 OS, 200 consultas.
-- Versões 3 e 4, por ótica: 200 produtos (120 com estoque), 150 vendas no PDV, 300 comissões,
-- 60 contas a pagar e 40 a receber.
-- Total: 600 mil clientes, 400 mil cards, 250 mil OS, 150 mil vendas. NÃO rodar em produção.
\timing on
insert into oticas (id, nome, status)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'Ótica ' || n, 'ativa'
from generate_series(1, 1000) n;

insert into lojas (otica_id, nome) select id, 'Centro' from oticas where nome like 'Ótica %' and nome ~ '^Ótica [0-9]+$';

-- usuários: dono, vendedor e laboratório em cada ótica
insert into usuarios (id, otica_id, perfil_id, nome, email)
select gen_random_uuid(), o.id, p.id, p.chave || ' ' || o.nome, p.chave || '@' || o.id || '.com'
from oticas o join perfis p on p.otica_id = o.id and p.chave in ('dono', 'vendedor', 'laboratorio')
where o.nome ~ '^Ótica [0-9]+$';

-- carga em massa sem triggers (mais rápido); os dados são coerentes por construção
set session_replication_role = replica;

insert into clientes (id, otica_id, nome, telefone, criado_em)
select gen_random_uuid(), o.id,
       (array['Ana','Bruno','Carla','Diego','Elisa','Fábio','Gabi','Hugo','Iara','João','Karen','Lucas','Maria','Nuno','Olga','Paulo'])[1 + (i % 16)]
         || ' ' || (array['Silva','Souza','Lima','Costa','Rocha','Alves','Pereira','Gomes','Ribeiro','Martins'])[1 + (i % 10)]
         || ' ' || i,
       '279' || lpad((i * 7919 % 100000000)::text, 8, '0'),
       now() - (i % 900) * interval '1 day'
from oticas o, generate_series(1, 600) i
where o.nome ~ '^Ótica [0-9]+$';

insert into receitas (otica_id, cliente_id, data_receita)
select c.otica_id, c.id, current_date - (abs(hashtext(c.id::text)) % 700)
from clientes c where abs(hashtext(c.id::text)) % 2 = 0;

insert into receita_olhos (otica_id, receita_id, olho, esferico, cilindrico, eixo, dnp, altura)
select r.otica_id, r.id, o.olho, -1.25, -0.50, 90, 31, 18 from receitas r, (values ('OD'), ('OE')) o(olho);

with c as (
  select id, otica_id, row_number() over (partition by otica_id order by id) as rn from clientes
)
insert into atendimentos (id, otica_id, cliente_id, etapa_id, descricao, valor_total, etapa_desde, criado_em, origem)
select gen_random_uuid(), c.otica_id, c.id,
       (select id from funil_etapas f where f.otica_id = c.otica_id and f.ordem = 1 + (c.rn % 4)),
       'Orçamento ' || c.rn, 300 + (c.rn % 20) * 90, now() - (c.rn % 60) * interval '1 day',
       now() - (c.rn % 365) * interval '1 day', case when c.rn % 10 = 0 then 'site' else 'loja' end
from c where c.rn <= 400;

insert into atendimento_itens (otica_id, atendimento_id, descricao, preco_unitario)
select a.otica_id, a.id, x.d, a.valor_total / 3 from atendimentos a, (values ('Lente'), ('Tratamento'), ('Armação')) x(d)
where abs(hashtext(a.id::text)) % 5 < 3;

with a as (
  select a.*, row_number() over (partition by a.otica_id order by a.id) as rn from atendimentos a
)
insert into ordens_servico (otica_id, atendimento_id, cliente_id, cliente_nome, etapa_id, numero, descricao, data_prometida, etapa_desde, criado_em)
select a.otica_id, a.id, a.cliente_id, 'Cliente', (select id from os_etapas e where e.otica_id = a.otica_id and e.ordem = 1 + (a.rn % 6)),
       a.rn, 'Óculos', current_date + ((a.rn % 15) - 5)::int, now() - (a.rn % 20) * interval '1 day', now() - (a.rn % 365) * interval '1 day'
from a where a.rn <= 250;

with c as (
  select c.*, row_number() over (partition by c.otica_id order by c.id) as rn from clientes c
)
insert into consultas (otica_id, loja_id, cliente_id, inicio, fim, status)
select c.otica_id, (select id from lojas l where l.otica_id = c.otica_id limit 1), c.id,
       date_trunc('hour', now()) + (c.rn - 100) * interval '1 hour',
       date_trunc('hour', now()) + (c.rn - 100) * interval '1 hour' + interval '30 min', 'agendada'
from c where c.rn <= 200;

-- Versão 3: catálogo com estoque e comissões
insert into catalogo_itens (otica_id, categoria, nome, preco, codigo, controla_estoque, estoque_minimo)
select o.id, case when i <= 120 then 'armacao' else 'lente' end, 'Produto ' || i, 100 + (i % 30) * 15,
       'C' || lpad(i::text, 6, '0'), i <= 120, 2
from oticas o, generate_series(1, 200) i where o.nome ~ '^Ótica [0-9]+$';

insert into estoque_movimentos (otica_id, loja_id, item_id, tipo, quantidade, motivo)
select c.otica_id, l.id, c.id, 'entrada', 5 + (abs(hashtext(c.id::text)) % 10), 'Carga'
from catalogo_itens c join lojas l on l.otica_id = c.otica_id where c.controla_estoque and c.codigo like 'C%';
insert into estoque_saldos (otica_id, loja_id, item_id, quantidade)
select otica_id, loja_id, item_id, sum(quantidade) from estoque_movimentos group by 1, 2, 3;

insert into comissao_regras (otica_id, percentual) select id, 5 from oticas where nome ~ '^Ótica [0-9]+$';

with a as (
  select a.*, row_number() over (partition by a.otica_id order by a.id) as rn from atendimentos a
)
insert into comissoes (otica_id, usuario_id, atendimento_id, base, valor, competencia, status)
select a.otica_id, (select u.id from usuarios u join perfis p on p.id = u.perfil_id where u.otica_id = a.otica_id and p.chave = 'vendedor'),
       a.id, a.valor_total, round(a.valor_total * 0.05, 2), date_trunc('month', a.criado_em)::date,
       case when a.rn % 3 = 0 then 'paga' else 'aberta' end
from a where a.rn <= 300;

-- Versão 4: caixa, vendas no PDV (pagas em pix) e contas
insert into caixas (otica_id, loja_id, operador_id, aberto_em, fechado_em, valor_abertura, valor_fechamento, valor_esperado)
select o.id, l.id, u.id, now() - interval '1 day', now() - interval '20 hours', 100, 100, 100
from oticas o join lojas l on l.otica_id = o.id
join usuarios u on u.otica_id = o.id join perfis p on p.id = u.perfil_id and p.chave = 'dono'
where o.nome ~ '^Ótica [0-9]+$';

insert into vendas (id, otica_id, loja_id, caixa_id, vendedor_id, subtotal, desconto, total, numero, criado_em)
select gen_random_uuid(), c.otica_id, c.loja_id, c.id, c.operador_id, 150, 0, 150, i, now() - (i % 90) * interval '1 day'
from caixas c, generate_series(1, 150) i;
insert into contadores (otica_id, nome, valor)
select id, 'venda', 150 from oticas where nome ~ '^Ótica [0-9]+$'
on conflict (otica_id, nome) do update set valor = excluded.valor;
insert into venda_itens (otica_id, venda_id, descricao, quantidade, preco_unitario)
select otica_id, id, 'Acessório', 1, 150 from vendas;
insert into pagamentos (otica_id, venda_id, forma, valor, pago_em)
select otica_id, id, 'pix', 150, criado_em from vendas;

insert into contas_pagar (otica_id, categoria_id, descricao, valor, vencimento, pago_em)
select o.id, (select id from categorias_custo k where k.otica_id = o.id order by nome limit 1), 'Conta ' || i, 200 + i,
       current_date + (i - 40), case when i <= 40 then current_date + (i - 40) end
from oticas o, generate_series(1, 60) i where o.nome ~ '^Ótica [0-9]+$';
insert into contas_receber (otica_id, descricao, valor, vencimento, recebido_em)
select o.id, 'Parcela ' || i, 100, current_date + (i - 20), case when i <= 15 then current_date + (i - 20) end
from oticas o, generate_series(1, 40) i where o.nome ~ '^Ótica [0-9]+$';

set session_replication_role = origin;
analyze;

select 'oticas' as tabela, count(*) from oticas
union all select 'clientes', count(*) from clientes
union all select 'receitas', count(*) from receitas
union all select 'atendimentos', count(*) from atendimentos
union all select 'atendimento_itens', count(*) from atendimento_itens
union all select 'ordens_servico', count(*) from ordens_servico
union all select 'consultas', count(*) from consultas
union all select 'catalogo_itens', count(*) from catalogo_itens
union all select 'estoque_movimentos', count(*) from estoque_movimentos
union all select 'comissoes', count(*) from comissoes
union all select 'vendas', count(*) from vendas
union all select 'contas_pagar', count(*) from contas_pagar;
