-- Vitra — migração 0004: site institucional, pedido de orçamento pelo site,
-- agendamento online e "Sem retorno" automático.
--
-- Tudo que o público (anon) usa passa por funções security definer que expõem
-- só o necessário: dados do site, horários livres e a criação do pedido.

-- ---------------------------------------------------------------------------
-- 1. Dados do site na ótica
-- ---------------------------------------------------------------------------
alter table oticas
  add column slug            text unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  add column site_publicado  boolean not null default false,
  add column site_titulo     text,
  add column site_sobre      text,
  add column site_endereco   text,
  add column site_whatsapp   text,
  add column site_horario    text,
  add column site_instagram  text,
  add column site_cor        text check (site_cor ~ '^#[0-9a-fA-F]{6}$');

-- quem configura edita o conteúdo do site; o slug (endereço) só pela service role
grant update (site_publicado, site_titulo, site_sobre, site_endereco, site_whatsapp,
              site_horario, site_instagram, site_cor) on oticas to authenticated;

-- origem do card no funil
alter table atendimentos
  add column origem text not null default 'loja' check (origem in ('loja', 'site'));

-- ---------------------------------------------------------------------------
-- 2. Leitura pública do site
-- ---------------------------------------------------------------------------
create or replace function site_da_otica(p_slug text)
returns table (
  nome text, titulo text, sobre text, endereco text, whatsapp text, horario text,
  instagram text, cor text, logo_url text, agendamento_online boolean
)
language sql stable security definer set search_path = public as $$
  select o.nome, o.site_titulo, o.site_sobre, o.site_endereco, o.site_whatsapp, o.site_horario,
         o.site_instagram, o.site_cor, o.logo_url,
         exists (select 1 from plano_recursos pr where pr.plano = o.plano and pr.recurso = 'agendamento_online')
  from oticas o
  where o.slug = p_slug and o.site_publicado and o.status in ('teste', 'ativa')
$$;
grant execute on function site_da_otica(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Pedido de orçamento pelo site -> card em "Atendimento"
-- ---------------------------------------------------------------------------
create or replace function pedido_orcamento_site(
  p_slug text, p_nome text, p_telefone text, p_mensagem text, p_aceite_lgpd boolean
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  o        oticas%rowtype;
  digitos  text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  cli      uuid;
  etapa    uuid;
begin
  if coalesce(p_aceite_lgpd, false) is false then
    raise exception 'É preciso aceitar o uso dos dados para enviar o pedido';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 2 or length(p_nome) > 120 then
    raise exception 'Informe seu nome';
  end if;
  if length(digitos) < 10 or length(digitos) > 13 then
    raise exception 'Informe um telefone com DDD';
  end if;
  if length(coalesce(p_mensagem, '')) > 1000 then
    raise exception 'Mensagem muito longa';
  end if;

  select * into o from oticas where slug = p_slug and site_publicado and status in ('teste', 'ativa');
  if not found then
    raise exception 'Ótica não encontrada';
  end if;

  -- freio contra robô: no máximo 3 pedidos por telefone por dia e 40 por ótica por hora
  if (select count(*) from atendimentos a join clientes c on c.id = a.cliente_id
       where a.otica_id = o.id and a.origem = 'site' and a.criado_em > now() - interval '1 day'
         and regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') = digitos) >= 3
     or (select count(*) from atendimentos a
          where a.otica_id = o.id and a.origem = 'site' and a.criado_em > now() - interval '1 hour') >= 40 then
    raise exception 'Recebemos muitos pedidos agora. Tente mais tarde ou chame no WhatsApp.';
  end if;

  -- reaproveita o cliente pelo telefone
  select id into cli from clientes
   where otica_id = o.id and regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = digitos
   order by criado_em limit 1;
  if cli is null then
    insert into clientes (otica_id, nome, telefone, consentimento_lgpd_em)
    values (o.id, trim(p_nome), p_telefone, now()) returning id into cli;
  end if;

  select id into etapa from funil_etapas where otica_id = o.id order by ordem limit 1;
  insert into atendimentos (otica_id, loja_id, cliente_id, etapa_id, descricao, origem)
  values (o.id, (select id from lojas where otica_id = o.id and ativa order by criado_em limit 1),
          cli, etapa, left('Pelo site: ' || coalesce(nullif(trim(p_mensagem), ''), 'pedido de orçamento'), 200), 'site');
  return true;
end $$;
grant execute on function pedido_orcamento_site(text, text, text, text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Agendamento online (plano com 'agendamento_online')
-- ---------------------------------------------------------------------------
-- Horários livres de um dia, a partir dos horários de trabalho da primeira loja ativa,
-- tirando consultas e bloqueios. Hora local de São Paulo.
create or replace function horarios_livres(p_slug text, p_dia date)
returns table (inicio timestamptz, fim timestamptz)
language sql stable security definer set search_path = public as $$
  with o as (
    select ot.id, (select id from lojas where otica_id = ot.id and ativa order by criado_em limit 1) as loja
    from oticas ot
    where ot.slug = p_slug and ot.site_publicado and ot.status in ('teste', 'ativa')
      and exists (select 1 from plano_recursos pr where pr.plano = ot.plano and pr.recurso = 'agendamento_online')
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
grant execute on function horarios_livres(text, date) to anon, authenticated;

create or replace function agendar_pelo_site(
  p_slug text, p_inicio timestamptz, p_nome text, p_telefone text, p_aceite_lgpd boolean
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  o       oticas%rowtype;
  loja    uuid;
  dia     date := (p_inicio at time zone 'America/Sao_Paulo')::date;
  vaga    record;
  digitos text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  cli     uuid;
begin
  if coalesce(p_aceite_lgpd, false) is false then
    raise exception 'É preciso aceitar o uso dos dados para agendar';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 2 or length(p_nome) > 120 then
    raise exception 'Informe seu nome';
  end if;
  if length(digitos) < 10 or length(digitos) > 13 then
    raise exception 'Informe um telefone com DDD';
  end if;

  select * into o from oticas where slug = p_slug;
  if not found then
    raise exception 'Ótica não encontrada';
  end if;
  select id into loja from lojas where otica_id = o.id and ativa order by criado_em limit 1;

  -- uma marcação por vez nesta loja: evita dois clientes pegarem o mesmo horário
  perform pg_advisory_xact_lock(hashtext('agenda:' || loja::text));

  select * into vaga from horarios_livres(p_slug, dia) h where h.inicio = p_inicio;
  if not found then
    raise exception 'Esse horário não está mais disponível';
  end if;

  if (select count(*) from consultas c
       where c.otica_id = o.id and c.origem = 'site' and c.status in ('agendada', 'confirmada')
         and c.inicio > now()
         and regexp_replace(coalesce(c.telefone_contato, ''), '\D', '', 'g') = digitos) >= 2 then
    raise exception 'Este telefone já tem consultas marcadas. Fale com a ótica pelo WhatsApp.';
  end if;

  select id into cli from clientes
   where otica_id = o.id and regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = digitos
   order by criado_em limit 1;

  insert into consultas (otica_id, loja_id, cliente_id, nome_contato, telefone_contato, inicio, fim, origem)
  values (o.id, loja, cli, trim(p_nome), p_telefone, vaga.inicio, vaga.fim, 'site');
  return true;
end $$;
grant execute on function agendar_pelo_site(text, timestamptz, text, text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. "Sem retorno" automático
-- ---------------------------------------------------------------------------
-- Card parado numa etapa com dias_para_sem_retorno vai para a etapa seguinte.
-- Chamado ao abrir o funil (só a ótica do usuário) e, se quiser, pelo pg_cron (todas).
create or replace function mover_sem_retorno() returns int
language plpgsql security definer set search_path = public as $$
declare
  movidos int;
begin
  if auth.uid() is not null and not acesso('vendas', 'ver') then
    return 0;
  end if;

  update atendimentos a
     set etapa_id = prox.id
    from funil_etapas f
    join lateral (
      select n.id from funil_etapas n
       where n.otica_id = f.otica_id and n.ordem > f.ordem and n.tipo = 'aberta'
       order by n.ordem limit 1
    ) prox on true
   where a.etapa_id = f.id
     and f.dias_para_sem_retorno is not null
     and a.etapa_desde < now() - make_interval(days => f.dias_para_sem_retorno)
     and (auth.uid() is null or a.otica_id = minha_otica());
  get diagnostics movidos = row_count;
  return movidos;
end $$;
revoke execute on function mover_sem_retorno() from public;
grant execute on function mover_sem_retorno() to authenticated;
-- No Supabase (opcional): select cron.schedule('sem-retorno', '0 * * * *', 'select mover_sem_retorno()');

-- ---------------------------------------------------------------------------
-- 6. Endurecimento: no Supabase, funções novas do schema public ganham EXECUTE
--    para anon e authenticated por padrão. "revoke from public" não basta.
-- ---------------------------------------------------------------------------
revoke execute on function proximo_numero(uuid, text) from anon, authenticated;
revoke execute on function mover_sem_retorno() from anon;
revoke execute on function criar_os_do_atendimento(uuid, date) from anon;
revoke execute on function registrar_pagamento(uuid, numeric, text, smallint, boolean, date) from anon;

-- ---------------------------------------------------------------------------
-- 7. Proteções da equipe: o perfil Dono não perde acesso e a ótica nunca fica sem dono ativo
-- ---------------------------------------------------------------------------
create or replace function proteger_perfil_dono() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- a ótica inteira está sendo apagada (cascade): deixa passar
  if not exists (select 1 from oticas where id = old.otica_id) then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.chave = 'dono' or old.do_sistema then
      raise exception 'Perfis padrão do sistema não podem ser excluídos';
    end if;
    return old;
  end if;
  if old.chave = 'dono' and (new.permissoes is distinct from old.permissoes or new.chave <> old.chave) then
    raise exception 'O perfil Dono sempre tem acesso total';
  end if;
  return new;
end $$;
create trigger proteger_perfil_dono before update or delete on perfis
  for each row execute function proteger_perfil_dono();

create or replace function proteger_ultimo_dono() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dono uuid;
begin
  if not exists (select 1 from oticas where id = old.otica_id) then
    return coalesce(new, old);
  end if;
  select id into dono from perfis where otica_id = old.otica_id and chave = 'dono';
  if old.perfil_id = dono and old.ativo
     and (tg_op = 'DELETE' or new.perfil_id <> dono or not new.ativo)
     and not exists (select 1 from usuarios u
                      where u.otica_id = old.otica_id and u.perfil_id = dono and u.ativo and u.id <> old.id) then
    raise exception 'A ótica precisa de pelo menos um Dono ativo';
  end if;
  return coalesce(new, old);
end $$;
create trigger proteger_ultimo_dono before update or delete on usuarios
  for each row execute function proteger_ultimo_dono();
