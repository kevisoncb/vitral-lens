-- Vitral — migração 0006: uma área por perfil e plano único
--
-- Áreas (cada uma com tela própria):
--   loja         balcão: agenda, vendas, clientes, catálogo, acompanhar e entregar OS
--   consultorio  só exames e histórico de exames do paciente
--   laboratorio  só produção: quadro, ficha técnica, etapas. Não vê valores nem dados do cliente
--   gestao       dono/gerente: tudo, e pode abrir qualquer área
--
-- Plano único (R$ 99): tudo incluído. Adicionais pagos à parte: nota fiscal e lojas extras.

-- ---------------------------------------------------------------------------
-- 1. Área do perfil
-- ---------------------------------------------------------------------------
alter table perfis add column area text not null default 'loja'
  check (area in ('loja', 'consultorio', 'laboratorio', 'gestao'));

create or replace function minha_area() returns text
language sql stable security definer set search_path = public as $$
  select p.area from usuarios u join perfis p on p.id = u.perfil_id
  where u.id = auth.uid() and u.ativo
$$;
grant execute on function minha_area() to authenticated;
revoke execute on function minha_area() from anon;

-- Ajusta os perfis padrão de uma ótica (existente ou nova).
create or replace function perfis_por_area(p_otica uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('vitral.preparando_otica', 'sim', true);

  update perfis set area = case chave
      when 'dono'         then 'gestao'
      when 'financeiro'   then 'gestao'
      when 'optometrista' then 'consultorio'
      when 'laboratorio'  then 'laboratorio'
      else 'loja' end
   where otica_id = p_otica and do_sistema;

  -- laboratório: só produção. Sem clientes (o nome vem na própria OS).
  update perfis set permissoes = jsonb_build_object(
      'laboratorio', '["ver","criar","editar"]'::jsonb, 'receitas', '["ver"]'::jsonb)
   where otica_id = p_otica and chave = 'laboratorio';
  -- balcão acompanha a OS e faz a entrega (avisar, entregar)
  update perfis set permissoes = permissoes || '{"laboratorio": ["ver","editar"]}'::jsonb
   where otica_id = p_otica and chave in ('vendedor', 'recepcao');
  -- consultório cadastra paciente que chega sem cadastro
  update perfis set permissoes = permissoes || '{"clientes": ["ver","criar"]}'::jsonb
   where otica_id = p_otica and chave = 'optometrista';

  insert into perfis (otica_id, chave, nome, do_sistema, area, permissoes) values
    (p_otica, 'laboratorio_gerente', 'Gerente de laboratório', true, 'laboratorio', jsonb_build_object(
      'laboratorio', '["ver","criar","editar","excluir"]'::jsonb, 'receitas', '["ver"]'::jsonb))
  on conflict (otica_id, chave) do nothing;

  perform set_config('vitral.preparando_otica', '', true);
end $$;
revoke execute on function perfis_por_area(uuid) from public, anon, authenticated;

select perfis_por_area(id) from oticas;

create or replace function preparar_otica_areas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform perfis_por_area(new.id);
  return new;
end $$;
-- roda depois de trg_preparar_otica e trg_preparar_otica_v5 (ordem alfabética)
create trigger trg_preparar_otica_v6 after insert on oticas
  for each row execute function preparar_otica_areas();

-- ---------------------------------------------------------------------------
-- 2. Quem move a OS para cada etapa
-- ---------------------------------------------------------------------------
-- 'laboratorio': No laboratório, Em montagem, Chegou na loja (o lab entrega para a loja)
-- 'loja':        Pago, Cliente avisado, Entregue
-- Gestão move qualquer uma.
alter table os_etapas add column area text not null default 'laboratorio'
  check (area in ('loja', 'laboratorio'));
update os_etapas set area = 'loja' where nome in ('Pago', 'Cliente avisado', 'Entregue');

create or replace function etapas_os_por_area() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update os_etapas set area = 'loja' where otica_id = new.id and nome in ('Pago', 'Cliente avisado', 'Entregue');
  return new;
end $$;
create trigger trg_preparar_otica_v6b after insert on oticas
  for each row execute function etapas_os_por_area();

create or replace function os_etapa_permitida() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  area_etapa text;
  area_usuario text := minha_area();
begin
  if new.etapa_id is not distinct from old.etapa_id or auth.uid() is null or area_usuario = 'gestao' then
    return new;
  end if;
  select area into area_etapa from os_etapas where id = new.etapa_id;
  if area_etapa is distinct from area_usuario then
    raise exception 'Esta etapa é movida pela equipe %', case area_etapa when 'loja' then 'da loja' else 'do laboratório' end
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger os_etapa_permitida before update on ordens_servico
  for each row execute function os_etapa_permitida();

-- ---------------------------------------------------------------------------
-- 3. Nome do cliente na OS (o laboratório não acessa a tabela de clientes)
-- ---------------------------------------------------------------------------
alter table ordens_servico add column cliente_nome text;
update ordens_servico o set cliente_nome = c.nome from clientes c where c.id = o.cliente_id;

create or replace function os_nome_cliente() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select nome into new.cliente_nome from clientes where id = new.cliente_id;
  return new;
end $$;
create trigger os_nome_cliente before insert or update of cliente_id on ordens_servico
  for each row execute function os_nome_cliente();

-- ---------------------------------------------------------------------------
-- 4. Plano único + adicionais
-- ---------------------------------------------------------------------------
-- Tudo que não está em recursos_adicionais vem no plano. A coluna oticas.plano fica
-- só por compatibilidade (não muda mais nada).
create table recursos_adicionais (
  recurso  text primary key,
  nome     text not null
);
insert into recursos_adicionais (recurso, nome) values
  ('nota_fiscal', 'Emissão de nota fiscal (NF-e e NFC-e)'),
  ('multiloja',   'Lojas adicionais');

create table otica_adicionais (
  otica_id    uuid not null references oticas(id) on delete cascade,
  recurso     text not null references recursos_adicionais(recurso),
  quantidade  int not null default 1,                -- ex.: número de lojas extras
  desde       date not null default current_date,
  primary key (otica_id, recurso)
);
alter table recursos_adicionais enable row level security;
alter table otica_adicionais enable row level security;
create policy recursos_adicionais_ver on recursos_adicionais for select to authenticated using (true);
create policy otica_adicionais_ver on otica_adicionais for select to authenticated using (otica_id = minha_otica());
-- contratar/cancelar adicional: só a service role (painel do Vitral)

create or replace function recurso_ativo(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from recursos_adicionais where recurso = r) then true
    else exists (select 1 from otica_adicionais where otica_id = minha_otica() and recurso = r)
  end
$$;

-- o site oferece agendamento online quando a ótica cadastrou horários de atendimento
create or replace function site_da_otica(p_slug text)
returns table (
  nome text, titulo text, sobre text, endereco text, whatsapp text, horario text,
  instagram text, cor text, logo_url text, agendamento_online boolean
)
language sql stable security definer set search_path = public as $$
  select o.nome, o.site_titulo, o.site_sobre, o.site_endereco, o.site_whatsapp, o.site_horario,
         o.site_instagram, o.site_cor, o.logo_url,
         exists (select 1 from horarios_trabalho h where h.otica_id = o.id)
  from oticas o
  where o.slug = p_slug and o.site_publicado and o.status in ('teste', 'ativa')
$$;

create or replace function horarios_livres(p_slug text, p_dia date)
returns table (inicio timestamptz, fim timestamptz)
language sql stable security definer set search_path = public as $$
  with o as (
    select ot.id, (select id from lojas where otica_id = ot.id and ativa order by criado_em limit 1) as loja
    from oticas ot
    where ot.slug = p_slug and ot.site_publicado and ot.status in ('teste', 'ativa')
  ),
  janelas as (
    select distinct h.duracao_min,
           ((p_dia + h.inicio) at time zone 'America/Sao_Paulo') as ini,
           ((p_dia + h.fim)    at time zone 'America/Sao_Paulo') as fim
    from horarios_trabalho h join o on h.loja_id = o.loja
    where h.dia_semana = extract(dow from p_dia)
  ),
  slots as (
    select distinct s as inicio, s + make_interval(mins => j.duracao_min) as fim
    from janelas j, generate_series(j.ini, j.fim - make_interval(mins => j.duracao_min), make_interval(mins => j.duracao_min)) s
  )
  select s.inicio, s.fim from slots s, o
  where s.inicio > now() + interval '1 hour'
    and p_dia <= current_date + 60
    and not exists (
      select 1 from horarios_ocupados(o.loja, p_dia) oc
      where tstzrange(oc.inicio, oc.fim) && tstzrange(s.inicio, s.fim)
    )
  order by s.inicio
$$;

-- segunda loja em diante exige o adicional multiloja (quantidade = lojas extras)
create or replace function limite_de_lojas() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  extras int;
begin
  if auth.uid() is null then
    return new;  -- service role / painel do Vitral
  end if;
  select coalesce(sum(quantidade), 0) into extras from otica_adicionais
   where otica_id = new.otica_id and recurso = 'multiloja';
  if (select count(*) from lojas where otica_id = new.otica_id and ativa) >= 1 + extras then
    raise exception 'Seu plano inclui % loja(s). Para abrir outra, contrate o adicional de loja extra.', 1 + extras;
  end if;
  return new;
end $$;
create trigger limite_de_lojas before insert on lojas
  for each row execute function limite_de_lojas();

-- ---------------------------------------------------------------------------
-- 5. Os cards conversam entre as áreas
-- ---------------------------------------------------------------------------
--   consultório conclui o exame  -> card novo no funil da loja (receita pronta)
--   loja registra o pagamento    -> OS nasce em "Pago" e aparece como nova no laboratório
--   laboratório puxa a OS        -> fica com o nome de quem pegou
--   laboratório "Chegou na loja" -> aparece para a loja avisar o cliente
--   qualquer área                -> recado no card (os_mensagens), visto pelas outras

alter table atendimentos drop constraint atendimentos_origem_check;
alter table atendimentos add constraint atendimentos_origem_check check (origem in ('loja', 'site', 'consultorio'));

-- card criado pelo consultório (security definer: quem faz exame não precisa de acesso a vendas)
create or replace function card_do_exame(p_exame uuid, p_receita uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  e exames%rowtype;
begin
  select * into e from exames where id = p_exame and otica_id = minha_otica();
  if not found then
    return;
  end if;
  -- se o cliente já tem um card aberto, só liga a receita nova nele
  update atendimentos a set receita_id = p_receita
   from funil_etapas f
   where f.id = a.etapa_id and f.tipo = 'aberta' and a.cliente_id = e.cliente_id;
  if found then
    return;
  end if;
  insert into atendimentos (otica_id, loja_id, cliente_id, etapa_id, receita_id, descricao, origem)
  values (e.otica_id,
          (select loja_id from consultas where id = e.consulta_id),
          e.cliente_id,
          (select id from funil_etapas where otica_id = e.otica_id order by ordem limit 1),
          p_receita, 'Saiu do consultório: receita pronta', 'consultorio');
end $$;
revoke execute on function card_do_exame(uuid, uuid) from public, anon, authenticated;

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
  perform card_do_exame(e.id, rec);
  return rec;
end $$;
grant execute on function card_do_exame(uuid, uuid) to authenticated;  -- chamada por concluir_exame (confere a ótica)

-- quem do laboratório puxou a OS
alter table ordens_servico
  add column responsavel_lab_id uuid references usuarios(id),
  add column puxada_em timestamptz;

create or replace function os_puxada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.etapa_id is distinct from old.etapa_id and new.responsavel_lab_id is null
     and minha_area() = 'laboratorio' then
    new.responsavel_lab_id := auth.uid();
    new.puxada_em := now();
  end if;
  return new;
end $$;
create trigger os_puxada before update on ordens_servico
  for each row execute function os_puxada();

-- recados no card
create table os_mensagens (
  id         uuid primary key default gen_random_uuid(),
  otica_id   uuid not null references oticas(id) on delete cascade,
  os_id      uuid not null references ordens_servico(id) on delete cascade,
  autor_id   uuid references usuarios(id) default auth.uid(),
  area       text default minha_area(),
  texto      text not null check (length(texto) between 1 and 1000),
  criado_em  timestamptz not null default now()
);
create index on os_mensagens (os_id);
alter table os_mensagens enable row level security;
create trigger preencher_otica before insert on os_mensagens for each row execute function preencher_otica();
-- quem enxerga a OS lê e escreve recado; ninguém altera recado de ninguém
create policy os_mensagens_ver on os_mensagens for select to authenticated
  using (otica_id = minha_otica() and acesso('laboratorio', 'ver'));
create policy os_mensagens_criar on os_mensagens for insert to authenticated
  with check (otica_id = minha_otica() and acesso('laboratorio', 'ver') and autor_id = auth.uid());

-- atualização ao vivo dos quadros (Supabase Realtime respeita o RLS)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table ordens_servico, atendimentos, os_mensagens, consultas, exames;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Produto cadastrado na hora da venda
-- ---------------------------------------------------------------------------
-- Não achou o produto no catálogo? O balcão cadastra ali mesmo (nome, categoria, preço)
-- e ele já fica no catálogo. Armação pede foto depois; lente não precisa.
alter table catalogo_itens
  add column marca            text,
  add column codigo           text,                 -- referência / código de barras
  add column foto_path        text,                 -- Storage, pasta produtos/<otica_id>/...
  add column criado_na_venda  boolean not null default false,
  add column criado_por       uuid references usuarios(id) default auth.uid(),
  add column criado_em        timestamptz not null default now();

create or replace function catalogo_balcao(p_otica uuid) returns void
language sql security definer set search_path = public as $$
  update perfis set permissoes = permissoes || '{"catalogo": ["ver","criar"]}'::jsonb
   where otica_id = p_otica and chave in ('vendedor', 'recepcao');
$$;
revoke execute on function catalogo_balcao(uuid) from public, anon, authenticated;
select catalogo_balcao(id) from oticas;

create or replace function preparar_otica_catalogo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform catalogo_balcao(new.id);
  return new;
end $$;
create trigger trg_preparar_otica_v6c after insert on oticas
  for each row execute function preparar_otica_catalogo();
