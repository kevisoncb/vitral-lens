-- Vitral — migração 0019: clientes para chamar
--
-- A loja abre a tela "Clientes para chamar" e vê quem vale a pena procurar hoje, com o motivo:
--   receita_vencendo  a última receita vence (validade, ou 1 ano depois do exame) entre 60 dias atrás e 30 dias à frente;
--   aniversario       faz aniversário hoje ou nos próximos 7 dias;
--   oculos_um_ano     recebeu óculos há cerca de 1 ano (335 a 395 dias) e não comprou de novo;
--   orcamento_perdido orçamento perdido entre 30 e 180 dias atrás: vale uma nova tentativa.
-- O WhatsApp nunca é automático: a tela só monta o link. Quem chamou marca "Chamei" e o cliente sai da
-- lista daquele motivo (cliente_contatos), para ninguém ligar duas vezes.

create table cliente_contatos (
  id          uuid primary key default gen_random_uuid(),
  otica_id    uuid not null references oticas(id) on delete cascade,
  cliente_id  uuid not null references clientes(id) on delete cascade,
  motivo      text not null check (motivo in ('receita_vencendo', 'aniversario', 'oculos_um_ano', 'orcamento_perdido')),
  usuario_id  uuid references usuarios(id) on delete set null default auth.uid(),
  criado_em   timestamptz not null default now()
);
create index on cliente_contatos (otica_id, cliente_id, motivo, criado_em desc);
create trigger preencher_otica before insert on cliente_contatos for each row execute function preencher_otica();
alter table cliente_contatos enable row level security;
create policy cliente_contatos_ver on cliente_contatos for select to authenticated
  using (otica_id = (select minha_otica()) and (select acesso('clientes', 'ver')));
create policy cliente_contatos_criar on cliente_contatos for insert to authenticated
  with check (otica_id = (select minha_otica()) and (select acesso('clientes', 'ver')) and usuario_id = (select auth.uid()));
revoke update, delete on cliente_contatos from anon, authenticated;
revoke all on cliente_contatos from anon;

-- índices para as buscas da lista
create index if not exists receitas_cliente_data on receitas (otica_id, cliente_id, data_receita desc);
create index if not exists clientes_nascimento on clientes (otica_id, (extract(month from nascimento)), (extract(day from nascimento))) where nascimento is not null;
create index if not exists os_entrega on ordens_servico (otica_id, data_entrega) where data_entrega is not null;

-- Lista do dia. Roda com as permissões de quem chama (security invoker): a regra de cada tabela vale.
-- Só entra quem tem telefone. Um cliente pode aparecer por mais de um motivo.
create or replace function clientes_para_chamar(p_hoje date default (now() at time zone 'America/Sao_Paulo')::date)
returns table (cliente_id uuid, nome text, telefone text, motivo text, detalhe text, quando date)
language sql stable security invoker set search_path = public as $$
  with
  receita as (
    select distinct on (r.cliente_id) r.cliente_id,
           coalesce(r.validade, (r.data_receita + interval '1 year')::date) as vence
    from receitas r
    where r.otica_id = minha_otica()
    order by r.cliente_id, r.data_receita desc, r.criado_em desc
  ),
  aniversario as (
    -- próximo aniversário; somar anos a 29/02 dá 28/02 em ano que não é bissexto
    select x.cliente_id,
           case when x.este_ano >= p_hoje then x.este_ano
                else (x.nascimento + make_interval(years => extract(year from p_hoje)::int + 1 - extract(year from x.nascimento)::int))::date
           end as dia
    from (
      select c.id as cliente_id, c.nascimento,
             (c.nascimento + make_interval(years => extract(year from p_hoje)::int - extract(year from c.nascimento)::int))::date as este_ano
      from clientes c
      where c.otica_id = minha_otica() and c.nascimento is not null
    ) x
  ),
  oculos as (
    select distinct on (o.cliente_id) o.cliente_id, o.data_entrega::date as entregue
    from ordens_servico o
    where o.otica_id = minha_otica() and o.data_entrega is not null
    order by o.cliente_id, o.data_entrega desc
  ),
  perdido as (
    select distinct on (a.cliente_id) a.cliente_id, a.etapa_desde::date as perdido_em
    from atendimentos a join funil_etapas e on e.id = a.etapa_id
    where a.otica_id = minha_otica() and e.tipo = 'perdida'
    order by a.cliente_id, a.etapa_desde desc
  ),
  candidatos as (
    select cliente_id, 'receita_vencendo'::text as motivo, vence as quando,
           case when vence < p_hoje then 'receita venceu em ' else 'receita vence em ' end || to_char(vence, 'DD/MM/YYYY') as detalhe,
           (vence - 60) as desde
    from receita where vence between p_hoje - 60 and p_hoje + 30
    union all
    select cliente_id, 'aniversario', dia,
           case when dia = p_hoje then 'faz aniversário hoje' else 'faz aniversário em ' || to_char(dia, 'DD/MM') end,
           p_hoje - 30
    from aniversario where dia between p_hoje and p_hoje + 7
    union all
    select o.cliente_id, 'oculos_um_ano', o.entregue,
           'recebeu os óculos em ' || to_char(o.entregue, 'DD/MM/YYYY'),
           p_hoje - 90
    from oculos o
    where o.entregue between p_hoje - 395 and p_hoje - 335
      -- não comprou de novo depois da entrega
      and not exists (select 1 from atendimentos a where a.cliente_id = o.cliente_id and a.criado_em::date > o.entregue)
    union all
    select p.cliente_id, 'orcamento_perdido', p.perdido_em,
           'orçamento perdido em ' || to_char(p.perdido_em, 'DD/MM/YYYY'),
           p.perdido_em
    from perdido p
    where p.perdido_em between p_hoje - 180 and p_hoje - 30
      and not exists (select 1 from atendimentos a where a.cliente_id = p.cliente_id and a.criado_em::date > p.perdido_em)
  )
  select c.id, c.nome, c.telefone, k.motivo, k.detalhe, k.quando
  from candidatos k
  join clientes c on c.id = k.cliente_id
  where c.telefone is not null and length(regexp_replace(c.telefone, '\D', '', 'g')) >= 10
    -- já foi chamado por esse motivo neste ciclo: sai da lista
    and not exists (
      select 1 from cliente_contatos cc
      where cc.cliente_id = c.id and cc.motivo = k.motivo and cc.criado_em::date >= k.desde
    )
  order by case k.motivo when 'aniversario' then 1 when 'receita_vencendo' then 2 when 'oculos_um_ano' then 3 else 4 end, k.quando, c.nome
$$;
revoke execute on function clientes_para_chamar(date) from public, anon;
grant execute on function clientes_para_chamar(date) to authenticated;
