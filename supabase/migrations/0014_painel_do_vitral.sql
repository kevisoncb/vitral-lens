-- Vitral — migração 0014: painel do Vitral (o dono do produto, não uma ótica)
--
-- Quem administra o Vitral fica em vitral_admins (cadastrado pelo SQL Editor). O painel não usa a
-- service role para dados: chama as funções abaixo, que conferem sou_admin_vitral(). A service role
-- continua só no Auth (criar o login do dono de uma ótica nova).
--
--   insert into vitral_admins (usuario_id, email) values ('<id do seu usuário no Auth>', 'voce@exemplo.com');

create table vitral_admins (
  usuario_id  uuid primary key,          -- = auth.users.id
  email       text not null,
  criado_em   timestamptz not null default now()
);
alter table vitral_admins enable row level security;   -- sem políticas: só o SQL Editor mexe

create or replace function sou_admin_vitral() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vitral_admins where usuario_id = auth.uid())
$$;

create or replace function exigir_admin_vitral() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not sou_admin_vitral() then
    raise exception 'Só a equipe do Vitral acessa o painel' using errcode = 'insufficient_privilege';
  end if;
end $$;
revoke execute on function exigir_admin_vitral() from public, anon, authenticated;

create or replace function painel_oticas()
returns table (id uuid, nome text, slug text, status otica_status, criado_em timestamptz,
               usuarios bigint, lojas bigint, clientes bigint, adicionais jsonb, dono_email text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_admin_vitral();
  return query
  select o.id, o.nome, o.slug, o.status, o.criado_em,
         (select count(*) from usuarios u where u.otica_id = o.id and u.ativo),
         (select count(*) from lojas l where l.otica_id = o.id and l.ativa),
         (select count(*) from clientes c where c.otica_id = o.id),
         coalesce((select jsonb_object_agg(a.recurso, a.quantidade) from otica_adicionais a where a.otica_id = o.id), '{}'::jsonb),
         (select u.email from usuarios u join perfis p on p.id = u.perfil_id
           where u.otica_id = o.id and p.chave = 'dono' and u.ativo order by u.criado_em limit 1)
  from oticas o
  order by o.criado_em desc;
end $$;

-- Cria a ótica (em teste), a primeira loja e liga o login do dono, já criado no Auth pelo servidor.
create or replace function painel_criar_otica(
  p_nome text, p_slug text, p_dono_id uuid, p_dono_nome text, p_dono_email text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_otica uuid;
begin
  perform exigir_admin_vitral();
  if length(trim(coalesce(p_nome, ''))) < 2 then
    raise exception 'Informe o nome da ótica';
  end if;
  if p_slug is not null and p_slug !~ '^[a-z0-9-]{3,40}$' then
    raise exception 'Endereço do site: 3 a 40 letras minúsculas, números ou hífen';
  end if;
  if exists (select 1 from oticas where slug = p_slug) then
    raise exception 'Esse endereço de site já é de outra ótica';
  end if;
  if exists (select 1 from usuarios where id = p_dono_id) then
    raise exception 'Esse login já pertence a uma ótica';
  end if;

  insert into oticas (nome, slug, status) values (trim(p_nome), p_slug, 'teste') returning id into v_otica;
  insert into lojas (otica_id, nome) values (v_otica, 'Loja principal');
  insert into usuarios (id, otica_id, loja_id, perfil_id, nome, email)
  values (p_dono_id, v_otica, (select id from lojas where otica_id = v_otica limit 1),
          (select id from perfis where otica_id = v_otica and chave = 'dono'), trim(p_dono_nome), lower(trim(p_dono_email)));
  return v_otica;
end $$;

-- quantidade 0 (ou menos) cancela o adicional
create or replace function painel_definir_adicional(p_otica uuid, p_recurso text, p_quantidade int) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin_vitral();
  if not exists (select 1 from oticas where id = p_otica) then
    raise exception 'Ótica não encontrada';
  end if;
  if not exists (select 1 from recursos_adicionais where recurso = p_recurso) then
    raise exception 'Adicional desconhecido';
  end if;
  if coalesce(p_quantidade, 0) <= 0 then
    delete from otica_adicionais where otica_id = p_otica and recurso = p_recurso;
  else
    insert into otica_adicionais (otica_id, recurso, quantidade) values (p_otica, p_recurso, p_quantidade)
    on conflict (otica_id, recurso) do update set quantidade = excluded.quantidade;
  end if;
  return true;
end $$;

create or replace function painel_mudar_status(p_otica uuid, p_status otica_status) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin_vitral();
  update oticas set status = p_status where id = p_otica;
  if not found then
    raise exception 'Ótica não encontrada';
  end if;
  return true;
end $$;

create or replace function painel_lista_espera() returns setof lista_espera
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_admin_vitral();
  return query select * from lista_espera order by criado_em desc limit 500;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'sou_admin_vitral()', 'painel_oticas()', 'painel_criar_otica(text, text, uuid, text, text)',
    'painel_definir_adicional(uuid, text, int)', 'painel_mudar_status(uuid, otica_status)', 'painel_lista_espera()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
