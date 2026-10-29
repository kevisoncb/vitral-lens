-- Vitra — migração 0010 (Versão 2): importação de planilhas e lista de espera do Vitra
--
-- 1. importar_clientes() e importar_produtos(): a tela lê a planilha (CSV) no navegador, mostra
--    a prévia e manda as linhas em JSON. O banco grava com as permissões de quem importa (RLS),
--    pula os repetidos e devolve quantos entraram e por que cada linha ficou de fora.
-- 2. Busca de cliente pelo telefone ou CPF só com os números (também deixa mais rápidos o
--    pedido de orçamento e o agendamento pelo site, que já procuram assim).
-- 3. Lista de espera do site do Vitra (óticas interessadas). Só a service role lê.

-- ---------------------------------------------------------------------------
-- 1. Índices por número (telefone e CPF sem pontuação)
-- ---------------------------------------------------------------------------
create index if not exists clientes_telefone_digitos_idx
  on clientes (otica_id, (regexp_replace(coalesce(telefone, ''), '\D', '', 'g')));
create index if not exists clientes_cpf_digitos_idx
  on clientes (otica_id, (regexp_replace(coalesce(cpf, ''), '\D', '', 'g')));
create index if not exists catalogo_codigo_idx on catalogo_itens (otica_id, codigo);

-- ---------------------------------------------------------------------------
-- 2. Importar clientes
-- ---------------------------------------------------------------------------
-- p_linhas: [{"nome": "...", "telefone": "...", "email": "...", "cpf": "...", "nascimento": "1980-05-01", "endereco": "..."}]
-- Repetido = mesmo CPF ou mesmo telefone (só os números) de um cliente que já existe ou de uma
-- linha anterior da mesma planilha.
create or replace function importar_clientes(p_linhas jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare
  l          record;
  v_otica      uuid := minha_otica();
  v_nome       text;
  v_tel        text;
  v_cpf        text;
  v_nasc       date;
  v_inseridos  int := 0;
  v_repetidos  int := 0;
  v_erros      jsonb := '[]'::jsonb;
begin
  if v_otica is null or not acesso('clientes', 'criar') then
    raise exception 'Seu perfil não pode cadastrar clientes' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' then
    raise exception 'Formato inválido';
  end if;
  if jsonb_array_length(p_linhas) > 5000 then
    raise exception 'Envie no máximo 5.000 linhas por vez';
  end if;

  for l in select value as v, ordinality as n from jsonb_array_elements(p_linhas) with ordinality loop
    v_nome := left(trim(coalesce(l.v ->> 'nome', '')), 120);
    v_tel  := regexp_replace(coalesce(l.v ->> 'telefone', ''), '\D', '', 'g');
    v_cpf  := regexp_replace(coalesce(l.v ->> 'cpf', ''), '\D', '', 'g');

    if length(v_nome) < 2 then
      v_erros := v_erros || jsonb_build_object('linha', l.n, 'motivo', 'sem nome');
      continue;
    end if;
    if v_cpf <> '' and length(v_cpf) <> 11 then
      v_erros := v_erros || jsonb_build_object('linha', l.n, 'motivo', 'CPF com ' || length(v_cpf) || ' números');
      continue;
    end if;
    if v_tel <> '' and (length(v_tel) < 10 or length(v_tel) > 13) then
      v_erros := v_erros || jsonb_build_object('linha', l.n, 'motivo', 'telefone sem DDD');
      continue;
    end if;
    begin
      v_nasc := nullif(trim(coalesce(l.v ->> 'nascimento', '')), '')::date;
    exception when others then
      v_erros := v_erros || jsonb_build_object('linha', l.n, 'motivo', 'data de nascimento inválida');
      continue;
    end;

    if (v_cpf <> '' and exists (select 1 from clientes c where c.otica_id = v_otica
                               and regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') = v_cpf))
       or (v_tel <> '' and exists (select 1 from clientes c where c.otica_id = v_otica
                                  and regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') = v_tel)) then
      v_repetidos := v_repetidos + 1;
      continue;
    end if;

    insert into clientes (otica_id, nome, telefone, email, cpf, nascimento, endereco, criado_por)
    values (v_otica, v_nome, nullif(trim(coalesce(l.v ->> 'telefone', '')), ''),
            nullif(lower(trim(coalesce(l.v ->> 'email', ''))), ''), nullif(v_cpf, ''), v_nasc,
            nullif(left(trim(coalesce(l.v ->> 'endereco', '')), 300), ''), auth.uid());
    v_inseridos := v_inseridos + 1;
  end loop;

  return jsonb_build_object('inseridos', v_inseridos, 'repetidos', v_repetidos, 'erros', v_erros);
end $$;
grant execute on function importar_clientes(jsonb) to authenticated;
revoke execute on function importar_clientes(jsonb) from public, anon;

-- ---------------------------------------------------------------------------
-- 3. Importar produtos do catálogo
-- ---------------------------------------------------------------------------
-- p_linhas: [{"categoria": "armacao", "nome": "...", "preco": 450, "marca": "...", "codigo": "..."}]
-- Repetido = mesmo código, ou (sem código) mesmo nome na mesma categoria.
create or replace function importar_produtos(p_linhas jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare
  l          record;
  v_otica      uuid := minha_otica();
  v_nome       text;
  v_cat        text;
  v_cod        text;
  v_preco      numeric;
  v_inseridos  int := 0;
  v_repetidos  int := 0;
  v_erros      jsonb := '[]'::jsonb;
begin
  if v_otica is null or not acesso('catalogo', 'criar') then
    raise exception 'Seu perfil não pode cadastrar produtos' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' then
    raise exception 'Formato inválido';
  end if;
  if jsonb_array_length(p_linhas) > 5000 then
    raise exception 'Envie no máximo 5.000 linhas por vez';
  end if;

  for l in select value as v, ordinality as n from jsonb_array_elements(p_linhas) with ordinality loop
    v_nome := left(trim(coalesce(l.v ->> 'nome', '')), 160);
    v_cat  := lower(trim(coalesce(l.v ->> 'categoria', '')));
    v_cod  := nullif(trim(coalesce(l.v ->> 'codigo', '')), '');

    if length(v_nome) < 2 then
      v_erros := v_erros || jsonb_build_object('linha', l.n, 'motivo', 'sem nome');
      continue;
    end if;
    if v_cat not in ('lente', 'tratamento', 'armacao', 'lente_contato', 'acessorio', 'servico') then
      v_erros := v_erros || jsonb_build_object('linha', l.n, 'motivo', 'categoria desconhecida');
      continue;
    end if;
    begin
      v_preco := (l.v ->> 'preco')::numeric;
    exception when others then
      v_preco := null;
    end;
    if v_preco is null or v_preco < 0 then
      v_erros := v_erros || jsonb_build_object('linha', l.n, 'motivo', 'preço inválido');
      continue;
    end if;

    if exists (select 1 from catalogo_itens c where c.otica_id = v_otica
                and ((v_cod is not null and c.codigo = v_cod)
                     or (v_cod is null and c.categoria = v_cat and lower(c.nome) = lower(v_nome)))) then
      v_repetidos := v_repetidos + 1;
      continue;
    end if;

    insert into catalogo_itens (otica_id, categoria, nome, preco, marca, codigo)
    values (v_otica, v_cat, v_nome, round(v_preco, 2), nullif(left(trim(coalesce(l.v ->> 'marca', '')), 80), ''), v_cod);
    v_inseridos := v_inseridos + 1;
  end loop;

  return jsonb_build_object('inseridos', v_inseridos, 'repetidos', v_repetidos, 'erros', v_erros);
end $$;
grant execute on function importar_produtos(jsonb) to authenticated;
revoke execute on function importar_produtos(jsonb) from public, anon;

-- ---------------------------------------------------------------------------
-- 4. Lista de espera do Vitra (site do produto)
-- ---------------------------------------------------------------------------
-- Tabela da plataforma, não de uma ótica: sem otica_id, com RLS ligado e nenhuma política
-- (ninguém do app lê; o painel do Vitra usa a service role).
create table lista_espera (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  otica_nome      text not null,
  cidade          text,
  uf              text check (uf ~ '^[A-Z]{2}$'),
  telefone        text not null,
  email           text,
  lojas           int check (lojas between 1 and 500),
  aceite_lgpd_em  timestamptz not null,
  criado_em       timestamptz not null default now()
);
create index on lista_espera (criado_em);
create index on lista_espera ((regexp_replace(telefone, '\D', '', 'g')));
alter table lista_espera enable row level security;

create or replace function entrar_lista_espera(
  p_nome text, p_otica text, p_cidade text, p_uf text, p_telefone text, p_email text,
  p_lojas int, p_aceite_lgpd boolean
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  digitos text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  uf      text := nullif(upper(trim(coalesce(p_uf, ''))), '');
begin
  if coalesce(p_aceite_lgpd, false) is false then
    raise exception 'É preciso aceitar o uso dos dados para entrar na lista';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 2 or length(p_nome) > 120 then
    raise exception 'Informe seu nome';
  end if;
  if length(trim(coalesce(p_otica, ''))) < 2 or length(p_otica) > 120 then
    raise exception 'Informe o nome da ótica';
  end if;
  if length(digitos) < 10 or length(digitos) > 13 then
    raise exception 'Informe um telefone com DDD';
  end if;
  if p_email is not null and trim(p_email) <> '' and trim(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido';
  end if;
  if uf is not null and uf !~ '^[A-Z]{2}$' then
    raise exception 'UF inválida';
  end if;

  -- mesmo telefone de novo: já está na lista, não duplica
  if exists (select 1 from lista_espera where regexp_replace(telefone, '\D', '', 'g') = digitos) then
    return true;
  end if;
  -- freio contra robô: no máximo 60 inscrições por hora no total
  if (select count(*) from lista_espera where criado_em > now() - interval '1 hour') >= 60 then
    raise exception 'Recebemos muitas inscrições agora. Tente de novo em alguns minutos.';
  end if;

  insert into lista_espera (nome, otica_nome, cidade, uf, telefone, email, lojas, aceite_lgpd_em)
  values (trim(p_nome), trim(p_otica), nullif(left(trim(coalesce(p_cidade, '')), 80), ''), uf, trim(p_telefone),
          nullif(lower(trim(coalesce(p_email, ''))), ''), p_lojas, now());
  return true;
end $$;
grant execute on function entrar_lista_espera(text, text, text, text, text, text, int, boolean) to anon, authenticated;
