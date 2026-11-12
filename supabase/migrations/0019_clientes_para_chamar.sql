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

-- índices para as buscas da lista: cada motivo vai direto pela data (não percorre todos os clientes da ótica)
create index if not exists receitas_cliente_data on receitas (otica_id, cliente_id, data_receita desc);
create index if not exists receitas_vencimento on receitas (otica_id, (coalesce(validade, (data_receita + interval '1 year')::date)));
create index if not exists clientes_nascimento on clientes (otica_id, (extract(month from nascimento)), (extract(day from nascimento))) where nascimento is not null;
create index if not exists os_entrega on ordens_servico (otica_id, data_entrega) where data_entrega is not null;

-- Lista do dia. Confere uma vez se a pessoa vê clientes e filtra TODA consulta pela ótica dela (otica_id = v_otica):
-- assim não repete a regra de segurança em cada tabela (medido: 3x mais rápido). Só entra quem tem telefone. Um cliente pode aparecer por mais de um motivo.
-- Medido com 1.000 óticas (docs/ESCALA.md): cada motivo busca pela data, com índice.
create or replace function clientes_para_chamar(p_hoje date default (now() at time zone 'America/Sao_Paulo')::date)
returns table (cliente_id uuid, nome text, telefone text, motivo text, detalhe text, quando date)
-- consulta pequena por ótica: sem processos paralelos (custam mais que a consulta) e com o plano guardado
-- (planejar a cada chamada levava 4 ms, mais que os 2 ms de executar)
language plpgsql stable security definer set search_path = public set max_parallel_workers_per_gather = 0 set plan_cache_mode = force_generic_plan as $$
declare
  v_otica uuid := minha_otica();
begin
  if v_otica is null or not acesso('clientes', 'ver') then
    return;
  end if;
  return query
  with
  -- a última receita do cliente vence entre 60 dias atrás e 30 dias à frente
  receita as (
    select r.cliente_id, coalesce(r.validade, (r.data_receita + interval '1 year')::date) as vence
    from receitas r
    where r.otica_id = v_otica
      and coalesce(r.validade, (r.data_receita + interval '1 year')::date) between p_hoje - 60 and p_hoje + 30
      and not exists (select 1 from receitas n where n.otica_id = v_otica and n.cliente_id = r.cliente_id
                      and (n.data_receita, n.criado_em) > (r.data_receita, r.criado_em))
  ),
  -- aniversário de hoje até 7 dias (29/02 conta no 28/02 em ano que não é bissexto)
  dias as (
    select d::date as dia, extract(month from d)::int as mes, extract(day from d)::int as dd from generate_series(p_hoje, p_hoje + 7, interval '1 day') d
  ),
  aniversario as (
    select c.id as cliente_id, k.dia
    from dias k
    join clientes c on c.otica_id = v_otica and c.nascimento is not null
     and extract(month from c.nascimento) = k.mes
     and (extract(day from c.nascimento) = k.dd
          or (k.mes = 2 and k.dd = 28 and extract(day from c.nascimento) = 29
              and extract(day from (make_date(extract(year from k.dia)::int, 3, 1) - 1)) = 28))
  ),
  -- recebeu óculos há cerca de 1 ano (a entrega mais recente) e não comprou de novo
  oculos as (
    select distinct on (o.cliente_id) o.cliente_id, o.data_entrega::date as entregue
    from ordens_servico o
    where o.otica_id = v_otica and o.data_entrega between p_hoje - 395 and p_hoje - 335
      and not exists (select 1 from ordens_servico n where n.otica_id = v_otica and n.cliente_id = o.cliente_id and n.data_entrega > o.data_entrega)
      and not exists (select 1 from atendimentos a where a.otica_id = v_otica and a.cliente_id = o.cliente_id and a.criado_em::date > o.data_entrega)
    order by o.cliente_id, o.data_entrega desc
  ),
  -- orçamento perdido entre 30 e 180 dias atrás (o último) e nada depois
  perdido as (
    select distinct on (a.cliente_id) a.cliente_id, a.etapa_desde::date as perdido_em
    from atendimentos a join funil_etapas e on e.id = a.etapa_id and e.otica_id = v_otica
    where a.otica_id = v_otica and e.tipo = 'perdida' and a.etapa_desde::date between p_hoje - 180 and p_hoje - 30
      and not exists (select 1 from atendimentos n join funil_etapas ne on ne.id = n.etapa_id and ne.otica_id = v_otica
                      where n.otica_id = v_otica and n.cliente_id = a.cliente_id and ne.tipo = 'perdida' and n.etapa_desde > a.etapa_desde)
      and not exists (select 1 from atendimentos n where n.otica_id = v_otica and n.cliente_id = a.cliente_id and n.criado_em::date > a.etapa_desde::date)
    order by a.cliente_id, a.etapa_desde desc
  ),
  candidatos as (
    select r.cliente_id, 'receita_vencendo'::text as motivo, r.vence as quando,
           case when r.vence < p_hoje then 'receita venceu em ' else 'receita vence em ' end || to_char(r.vence, 'DD/MM/YYYY') as detalhe,
           (r.vence - 60) as desde
    from receita r
    union all
    select an.cliente_id, 'aniversario', an.dia,
           case when an.dia = p_hoje then 'faz aniversário hoje' else 'faz aniversário em ' || to_char(an.dia, 'DD/MM') end,
           p_hoje - 30
    from aniversario an
    union all
    select o.cliente_id, 'oculos_um_ano', o.entregue, 'recebeu os óculos em ' || to_char(o.entregue, 'DD/MM/YYYY'), p_hoje - 90
    from oculos o
    union all
    select p.cliente_id, 'orcamento_perdido', p.perdido_em, 'orçamento perdido em ' || to_char(p.perdido_em, 'DD/MM/YYYY'), p.perdido_em
    from perdido p
  )
  select c.id, c.nome, c.telefone, k.motivo, k.detalhe, k.quando
  from candidatos k
  join clientes c on c.id = k.cliente_id and c.otica_id = v_otica
  where c.telefone is not null and length(regexp_replace(c.telefone, '\D', '', 'g')) >= 10
    -- já foi chamado por esse motivo neste ciclo: sai da lista
    and not exists (
      select 1 from cliente_contatos cc
      where cc.otica_id = v_otica and cc.cliente_id = c.id and cc.motivo = k.motivo and cc.criado_em::date >= k.desde
    )
  order by case k.motivo when 'aniversario' then 1 when 'receita_vencendo' then 2 when 'oculos_um_ano' then 3 else 4 end, k.quando, c.nome;
end $$;
revoke execute on function clientes_para_chamar(date) from public, anon;
grant execute on function clientes_para_chamar(date) to authenticated;
