-- Mede as consultas das telas como um usuário logado (RLS ligado), na ótica nº 500.
-- Uso: psql -f medir.sql   (depois de gerar_dados.sql)
\pset pager off
select set_config('carga.vendedor', (select u.id::text from usuarios u join perfis p on p.id = u.perfil_id
  where u.otica_id = '00000000-0000-0000-0000-000000000500' and p.chave = 'vendedor'), false);
select set_config('carga.dono', (select u.id::text from usuarios u join perfis p on p.id = u.perfil_id
  where u.otica_id = '00000000-0000-0000-0000-000000000500' and p.chave = 'dono'), false);
select set_config('carga.lab', (select u.id::text from usuarios u join perfis p on p.id = u.perfil_id
  where u.otica_id = '00000000-0000-0000-0000-000000000500' and p.chave = 'laboratorio'), false);

create or replace function pg_temp.tempo(sql text) returns numeric language plpgsql as $$
declare linha text; t numeric;
begin
  for linha in execute 'explain (analyze, format text) ' || sql loop
    if linha like 'Execution Time:%' then t := substring(linha from '([0-9.]+)')::numeric; end if;
  end loop;
  return t;
end $$;

select set_config('request.jwt.claim.sub', current_setting('carga.vendedor'), false);
set role authenticated;
-- aquece o cache e mede 5 vezes; mostra a mediana
create temp table if not exists medidas (tela text, ms numeric);
do $$
declare
  telas text[][] := array[
    ['Funil de vendas (todos os cards)',
     'select a.id, a.etapa_id, a.descricao, a.valor_total, a.etapa_desde, c.nome, c.telefone from atendimentos a left join clientes c on c.id = a.cliente_id order by a.etapa_desde desc'],
    ['Busca de cliente por pedaço do nome',
     'select id, nome, telefone from clientes where nome ilike ''%silva 12%'' order by nome limit 100'],
    ['Ficha do cliente (receitas + atendimentos)',
     'select r.*, (select count(*) from atendimentos a where a.cliente_id = r.cliente_id) from receitas r where r.cliente_id = (select id from clientes limit 1)'],
    ['Agenda do dia',
     'select * from consultas where inicio >= date_trunc(''day'', now()) and inicio < date_trunc(''day'', now()) + interval ''1 day'' order by inicio'],
    ['Relatório do mês',
     'select f.tipo, count(*), sum(a.valor_total) from atendimentos a join funil_etapas f on f.id = a.etapa_id where a.criado_em >= date_trunc(''month'', now()) group by f.tipo'],
    ['Mover um card (update)',
     'update atendimentos set descricao = descricao where id = (select id from atendimentos limit 1)']
  ];
  i int; k int;
begin
  for i in 1 .. array_length(telas, 1) loop
    perform pg_temp.tempo(telas[i][2]);
    for k in 1 .. 5 loop
      insert into medidas values (telas[i][1], pg_temp.tempo(telas[i][2]));
    end loop;
  end loop;
end $$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('carga.lab'), false);
set role authenticated;
do $$
declare k int;
  q text := 'select o.id, o.numero, o.etapa_id, o.cliente_nome, o.descricao, o.data_prometida from ordens_servico o order by o.data_prometida';
begin
  perform pg_temp.tempo(q);
  for k in 1 .. 5 loop insert into medidas values ('Quadro do laboratório', pg_temp.tempo(q)); end loop;
end $$;
reset role;

-- Versões 3 e 4 (como o dono: vê estoque, todas as comissões, PDV e financeiro)
select set_config('request.jwt.claim.sub', current_setting('carga.dono'), false);
set role authenticated;
do $$
declare
  telas text[][] := array[
    ['Estoque (produtos com saldo)',
     'select c.id, c.nome, c.codigo, c.estoque_minimo, s.quantidade from catalogo_itens c left join estoque_saldos s on s.item_id = c.id where c.controla_estoque order by c.nome limit 500'],
    ['Comissões do mês (todas)',
     'select usuario_id, sum(valor), count(*) from comissoes where competencia = date_trunc(''month'', now())::date and status <> ''cancelada'' group by usuario_id'],
    ['Vendas do PDV no dia',
     'select v.id, v.numero, v.total, (select sum(valor) from pagamentos p where p.venda_id = v.id) from vendas v where v.criado_em >= date_trunc(''day'', now()) - interval ''1 day'' order by v.criado_em desc'],
    ['Financeiro: entradas do mês',
     'select p.forma, sum(p.valor) from pagamentos p left join vendas v on v.id = p.venda_id where p.pago_em >= date_trunc(''month'', now()) and not coalesce(v.cancelada, false) group by p.forma'],
    ['Financeiro: contas a pagar em aberto',
     'select id, descricao, valor, vencimento from contas_pagar where pago_em is null order by vencimento limit 300']
  ];
  i int; k int;
begin
  for i in 1 .. array_length(telas, 1) loop
    perform pg_temp.tempo(telas[i][2]);
    for k in 1 .. 5 loop
      insert into medidas values (telas[i][1], pg_temp.tempo(telas[i][2]));
    end loop;
  end loop;
end $$;
-- venda completa no PDV (estoque, pagamento, comissão): grava 6 vendas de teste na ótica medida
do $$
declare
  cx uuid;
  it uuid;
  t0 timestamptz;
  k int;
begin
  cx := abrir_caixa(null, 0);
  select id into it from catalogo_itens where controla_estoque limit 1;
  perform registrar_venda(cx, null, jsonb_build_array(jsonb_build_object('item_id', it, 'quantidade', 1)), 0,
                          jsonb_build_array(jsonb_build_object('forma', 'pix', 'valor', (select preco from catalogo_itens where id = it))));
  for k in 1 .. 5 loop
    t0 := clock_timestamp();
    perform registrar_venda(cx, null, jsonb_build_array(jsonb_build_object('item_id', it, 'quantidade', 1)), 0,
                            jsonb_build_array(jsonb_build_object('forma', 'pix', 'valor', (select preco from catalogo_itens where id = it))));
    insert into medidas values ('Registrar venda no PDV (estoque + comissão)', extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
end $$;
reset role;

select tela, round(percentile_cont(0.5) within group (order by ms)::numeric, 1) as mediana_ms,
       (select count(*) from atendimentos where otica_id = '00000000-0000-0000-0000-000000000500') as cards_da_otica
from medidas group by tela order by 1;
