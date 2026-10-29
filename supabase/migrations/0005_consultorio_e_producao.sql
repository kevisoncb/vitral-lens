-- Vitra — migração 0005: consultório e construção do óculos
--
-- O diferencial do Vitra é um fluxo só, do exame à entrega:
--   consultório (exame -> receita) -> loja (orçamento -> pagamento) -> laboratório (ficha técnica -> produção -> entrega)
-- tudo ligado ao mesmo cliente, sem redigitar nada.
--
-- 1. Exame de vista (prontuário) com refração por olho; concluir o exame gera a receita.
-- 2. Ficha técnica na OS, preenchida sozinha a partir da receita e do orçamento.
-- 3. Etapas de produção do óculos (quem fez, quando, conferência e retrabalho).
-- 4. Novo módulo de permissão: consultorio.

-- ---------------------------------------------------------------------------
-- 1. Consultório
-- ---------------------------------------------------------------------------
create table exames (
  id                    uuid primary key default gen_random_uuid(),
  otica_id              uuid not null references oticas(id) on delete cascade,
  cliente_id            uuid not null references clientes(id) on delete cascade,
  consulta_id           uuid references consultas(id) on delete set null,
  profissional_id       uuid references usuarios(id),
  registro_profissional text,                       -- CRM, CBOO etc. (quem assina o exame)
  queixa                text,
  historico             text,                       -- anamnese: doenças, cirurgias, medicamentos, família
  usa_oculos            boolean,
  usa_lente_contato     boolean,
  observacoes           text,
  conduta               text,                       -- orientação, encaminhamento
  retorno_em            date,
  status                text not null default 'em_andamento' check (status in ('em_andamento', 'concluido')),
  concluido_em          timestamptz,
  criado_em             timestamptz not null default now()
);
create index on exames (otica_id, cliente_id);

create table exame_olhos (
  id          uuid primary key default gen_random_uuid(),
  otica_id    uuid not null references oticas(id) on delete cascade,
  exame_id    uuid not null references exames(id) on delete cascade,
  olho        text not null check (olho in ('OD', 'OE')),
  av_sc       text,                                 -- acuidade visual sem correção (ex.: 20/40)
  av_cc       text,                                 -- com correção
  esferico    numeric(4,2),
  cilindrico  numeric(4,2),
  eixo        smallint check (eixo between 0 and 180),
  adicao      numeric(3,2),
  dnp         numeric(4,1),
  altura      numeric(4,1),
  unique (exame_id, olho)
);

alter table receitas add column exame_id uuid references exames(id) on delete set null;

-- Exame concluído não muda mais (é prontuário). Correção = novo exame.
create or replace function exame_travado() returns trigger
language plpgsql as $$
declare
  st text;
begin
  if tg_table_name = 'exames' then
    if old.status = 'concluido' then
      raise exception 'Exame concluído não pode ser alterado. Faça um novo exame.';
    end if;
    return coalesce(new, old);
  end if;
  select status into st from exames where id = coalesce(new.exame_id, old.exame_id);
  if st = 'concluido' then
    raise exception 'Exame concluído não pode ser alterado. Faça um novo exame.';
  end if;
  return coalesce(new, old);
end $$;
create trigger exame_travado before update or delete on exames
  for each row execute function exame_travado();
create trigger exame_olhos_travado before insert or update or delete on exame_olhos
  for each row execute function exame_travado();

-- Conclui o exame e gera a receita (roda com a permissão de quem chama: precisa
-- de consultorio:editar e receitas:criar).
create or replace function concluir_exame(p_exame uuid) returns uuid
language plpgsql set search_path = public as $$
declare
  e   exames%rowtype;
  rec uuid;
  nome_prof text;
begin
  select * into e from exames where id = p_exame;
  if not found then
    raise exception 'Exame não encontrado';
  end if;
  if e.status = 'concluido' then
    select id into rec from receitas where exame_id = e.id limit 1;
    return rec;
  end if;
  select nome into nome_prof from usuarios where id = e.profissional_id;

  insert into receitas (otica_id, cliente_id, tipo, medico, crm, externa, exame_id, criado_por, validade)
  values (e.otica_id, e.cliente_id, 'oculos', nome_prof, e.registro_profissional, false, e.id, auth.uid(),
          (current_date + interval '1 year')::date)
  returning id into rec;

  insert into receita_olhos (otica_id, receita_id, olho, distancia, esferico, cilindrico, eixo, adicao, dnp, altura)
  select e.otica_id, rec, o.olho, 'longe', o.esferico, o.cilindrico, o.eixo, o.adicao, o.dnp, o.altura
  from exame_olhos o where o.exame_id = e.id
    and (o.esferico is not null or o.cilindrico is not null or o.adicao is not null);

  update exames set status = 'concluido', concluido_em = now() where id = e.id;
  if e.consulta_id is not null then
    update consultas set status = 'compareceu' where id = e.consulta_id and status in ('agendada', 'confirmada');
  end if;
  return rec;
end $$;
grant execute on function concluir_exame(uuid) to authenticated;
revoke execute on function concluir_exame(uuid) from anon;

-- ---------------------------------------------------------------------------
-- 2. Ficha técnica da OS (o laboratório vê tudo isto, nunca os valores)
-- ---------------------------------------------------------------------------
alter table ordens_servico
  add column lente           text,
  add column tratamentos     text,
  add column armacao         text,
  add column armacao_tipo    text check (armacao_tipo in ('aro_fechado', 'fio_nylon', 'parafusada', 'outro')),
  add column aro             numeric(4,1),        -- tamanho horizontal da lente (mm)
  add column ponte           numeric(4,1),
  add column diagonal_maior  numeric(4,1),
  add column dnp_od          numeric(4,1),
  add column dnp_oe          numeric(4,1),
  add column altura_od       numeric(4,1),
  add column altura_oe       numeric(4,1),
  add column obs_tecnica     text;

-- Ao nascer, a OS puxa a receita (a do atendimento ou a mais recente do cliente),
-- as medidas e os itens do orçamento. Ninguém redigita.
create or replace function preencher_ficha_os() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  itens record;
begin
  if new.receita_id is null then
    select id into new.receita_id from receitas
     where cliente_id = new.cliente_id and tipo = 'oculos'
     order by data_receita desc, criado_em desc limit 1;
  end if;

  if new.receita_id is not null then
    select
      coalesce(new.dnp_od,    max(dnp)    filter (where olho = 'OD')),
      coalesce(new.dnp_oe,    max(dnp)    filter (where olho = 'OE')),
      coalesce(new.altura_od, max(altura) filter (where olho = 'OD')),
      coalesce(new.altura_oe, max(altura) filter (where olho = 'OE'))
    into new.dnp_od, new.dnp_oe, new.altura_od, new.altura_oe
    from receita_olhos where receita_id = new.receita_id and distancia = 'longe';
  end if;

  if new.atendimento_id is not null then
    select
      string_agg(i.descricao, ' + ') filter (where c.categoria in ('lente', 'lente_contato')) as lente,
      string_agg(i.descricao, ' + ') filter (where c.categoria = 'tratamento')                as tratamentos,
      string_agg(i.descricao, ' + ') filter (where c.categoria = 'armacao')                   as armacao
    into itens
    from atendimento_itens i left join catalogo_itens c on c.id = i.catalogo_item_id
    where i.atendimento_id = new.atendimento_id;
    new.lente       := coalesce(new.lente, itens.lente);
    new.tratamentos := coalesce(new.tratamentos, itens.tratamentos);
    new.armacao     := coalesce(new.armacao, itens.armacao);
  end if;
  return new;
end $$;
create trigger preencher_ficha_os before insert on ordens_servico
  for each row execute function preencher_ficha_os();

-- ---------------------------------------------------------------------------
-- 3. Produção do óculos
-- ---------------------------------------------------------------------------
create table os_producao (
  id          uuid primary key default gen_random_uuid(),
  otica_id    uuid not null references oticas(id) on delete cascade,
  os_id       uuid not null references ordens_servico(id) on delete cascade,
  etapa       text not null check (etapa in ('surfacagem', 'tratamento', 'coloracao', 'corte', 'montagem', 'conferencia')),
  aprovado    boolean not null default true,      -- conferência reprovada = retrabalho
  observacao  text,
  feito_por   uuid references usuarios(id) default auth.uid(),
  feito_em    timestamptz not null default now()
);
create index on os_producao (os_id);

-- Conferência reprovada marca a OS como retrabalho.
create or replace function producao_registrada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.etapa = 'conferencia' and not new.aprovado then
    update ordens_servico
       set retrabalho = true,
           motivo_retrabalho = coalesce(new.observacao, 'Reprovado na conferência')
     where id = new.os_id;
  end if;
  return new;
end $$;
create trigger producao_registrada after insert on os_producao
  for each row execute function producao_registrada();

-- ---------------------------------------------------------------------------
-- 4. RLS, otica_id automático e auditoria das tabelas novas
-- ---------------------------------------------------------------------------
do $$
declare
  m record;
begin
  for m in
    select * from (values
      ('exames',       array['consultorio']),
      ('exame_olhos',  array['consultorio']),
      ('os_producao',  array['laboratorio'])
    ) as t(tabela, modulos)
  loop
    execute format('alter table %I enable row level security', m.tabela);
    execute format($p$create policy %I on %I for select to authenticated
                      using (otica_id = minha_otica() and acesso_algum(%L::text[], 'ver'))$p$,
                   m.tabela || '_ver', m.tabela, m.modulos);
    execute format($p$create policy %I on %I for insert to authenticated
                      with check (otica_id = minha_otica() and acesso_algum(%L::text[], 'criar'))$p$,
                   m.tabela || '_criar', m.tabela, m.modulos);
    execute format($p$create policy %I on %I for update to authenticated
                      using (otica_id = minha_otica() and acesso_algum(%L::text[], 'editar'))
                      with check (otica_id = minha_otica())$p$,
                   m.tabela || '_editar', m.tabela, m.modulos);
    execute format($p$create policy %I on %I for delete to authenticated
                      using (otica_id = minha_otica() and acesso_algum(%L::text[], 'excluir'))$p$,
                   m.tabela || '_excluir', m.tabela, m.modulos);
    execute format('create trigger preencher_otica before insert on %I for each row execute function preencher_otica()', m.tabela);
  end loop;
end $$;

create trigger aud_exames after insert or update or delete on exames for each row execute function auditar();

-- ---------------------------------------------------------------------------
-- 5. Permissões do módulo consultorio (óticas novas e já existentes)
-- ---------------------------------------------------------------------------
create or replace function permissoes_consultorio(p_otica uuid) returns void
language sql security definer set search_path = public as $$
  update perfis set permissoes = permissoes || jsonb_build_object('consultorio',
    case chave
      when 'dono'         then '["ver","criar","editar","excluir"]'::jsonb
      when 'optometrista' then '["ver","criar","editar"]'::jsonb
      when 'recepcao'     then '["ver"]'::jsonb
      when 'vendedor'     then '["ver"]'::jsonb
    end)
  where otica_id = p_otica and chave in ('dono', 'optometrista', 'recepcao', 'vendedor')
    and not permissoes ? 'consultorio';
$$;
revoke execute on function permissoes_consultorio(uuid) from public, anon, authenticated;

-- o perfil Dono é protegido por trigger (0004): libera só para esta atualização
alter table perfis disable trigger proteger_perfil_dono;
select permissoes_consultorio(id) from oticas;
alter table perfis enable trigger proteger_perfil_dono;

-- roda depois de trg_preparar_otica (ordem alfabética dos triggers)
create or replace function preparar_otica_consultorio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('vitra.preparando_otica', 'sim', true);
  perform permissoes_consultorio(new.id);
  perform set_config('vitra.preparando_otica', '', true);
  return new;
end $$;
create trigger trg_preparar_otica_v5 after insert on oticas
  for each row execute function preparar_otica_consultorio();

-- a proteção do Dono deixa passar a preparação de uma ótica nova
create or replace function proteger_perfil_dono() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from oticas where id = old.otica_id) then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.chave = 'dono' or old.do_sistema then
      raise exception 'Perfis padrão do sistema não podem ser excluídos';
    end if;
    return old;
  end if;
  if old.chave = 'dono' and coalesce(current_setting('vitra.preparando_otica', true), '') <> 'sim'
     and (new.permissoes is distinct from old.permissoes or new.chave <> old.chave) then
    raise exception 'O perfil Dono sempre tem acesso total';
  end if;
  return new;
end $$;
