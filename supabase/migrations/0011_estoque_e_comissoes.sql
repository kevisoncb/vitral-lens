-- Vitra — migração 0011 (Versão 3): estoque e comissões
--
-- 1. Módulos de permissão novos: estoque e comissoes.
-- 2. Estoque por loja: livro de movimentos (nunca se apaga nem se altera) e saldo mantido pelo
--    banco. Entrada, saída (perda/quebra), ajuste de contagem e transferência entre lojas só pelas
--    funções abaixo. A venda dá baixa sozinha no primeiro pagamento.
-- 3. Comissões: regras por vendedor e/ou categoria (a mais específica vale) e a comissão gerada no
--    primeiro pagamento do atendimento. O vendedor vê só as dele; quem tem comissoes:editar vê
--    todas e marca como pagas.
--
-- Só os produtos com controla_estoque entram no estoque. Padrão: armação, lente de contato e
-- acessório (a lente é feita sob medida no laboratório, não fica na prateleira).

-- ---------------------------------------------------------------------------
-- 1. Permissões
-- ---------------------------------------------------------------------------
create or replace function permissoes_v3(p_otica uuid) returns void
language sql security definer set search_path = public as $$
  update perfis set permissoes = permissoes
    || case when not permissoes ? 'estoque' then jsonb_build_object('estoque',
         case chave
           when 'dono'       then '["ver","criar","editar","excluir"]'::jsonb
           when 'financeiro' then '["ver"]'::jsonb
           else '["ver"]'::jsonb
         end) else '{}'::jsonb end
    || case when not permissoes ? 'comissoes' then jsonb_build_object('comissoes',
         case chave
           when 'dono'       then '["ver","criar","editar","excluir"]'::jsonb
           when 'financeiro' then '["ver","editar"]'::jsonb
           else '["ver"]'::jsonb
         end) else '{}'::jsonb end
  where otica_id = p_otica and chave in ('dono', 'financeiro', 'vendedor', 'recepcao', 'caixa');
$$;
revoke execute on function permissoes_v3(uuid) from public, anon, authenticated;

alter table perfis disable trigger proteger_perfil_dono;
select permissoes_v3(id) from oticas;
alter table perfis enable trigger proteger_perfil_dono;

create or replace function preparar_otica_v3() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('vitra.preparando_otica', 'sim', true);
  perform permissoes_v3(new.id);
  perform set_config('vitra.preparando_otica', '', true);
  return new;
end $$;
-- roda depois dos trg_preparar_otica_v6* (ordem alfabética)
create trigger trg_preparar_otica_v7 after insert on oticas
  for each row execute function preparar_otica_v3();

-- ---------------------------------------------------------------------------
-- 2. Estoque
-- ---------------------------------------------------------------------------
alter table catalogo_itens
  add column controla_estoque boolean not null default false,
  add column estoque_minimo   int not null default 0 check (estoque_minimo >= 0),
  add column custo            numeric(12,2) check (custo >= 0);   -- último custo de compra
update catalogo_itens set controla_estoque = true where categoria in ('armacao', 'lente_contato', 'acessorio');
alter table catalogo_itens alter column controla_estoque drop default;

-- item novo sem dizer se controla estoque: decide pela categoria
create or replace function catalogo_controla_estoque() returns trigger
language plpgsql as $$
begin
  if new.controla_estoque is null then
    new.controla_estoque := new.categoria in ('armacao', 'lente_contato', 'acessorio');
  end if;
  return new;
end $$;
create trigger catalogo_controla_estoque before insert on catalogo_itens
  for each row execute function catalogo_controla_estoque();

create table estoque_saldos (
  otica_id      uuid not null references oticas(id) on delete cascade,
  loja_id       uuid not null references lojas(id) on delete cascade,
  item_id       uuid not null references catalogo_itens(id) on delete cascade,
  quantidade    int not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (loja_id, item_id)
);
create index on estoque_saldos (otica_id, item_id);

create table estoque_movimentos (
  id              uuid primary key default gen_random_uuid(),
  otica_id        uuid not null references oticas(id) on delete cascade,
  loja_id         uuid not null references lojas(id) on delete cascade,
  item_id         uuid not null references catalogo_itens(id) on delete cascade,
  tipo            text not null check (tipo in ('entrada', 'saida', 'ajuste', 'venda', 'devolucao', 'transferencia')),
  quantidade      int not null check (quantidade <> 0),       -- positivo entra, negativo sai
  custo_unitario  numeric(12,2),
  atendimento_id  uuid references atendimentos(id) on delete set null,
  venda_id        uuid references vendas(id) on delete set null,
  motivo          text,
  usuario_id      uuid references usuarios(id) default auth.uid(),
  criado_em       timestamptz not null default now()
);
create index on estoque_movimentos (item_id, criado_em desc);
create index on estoque_movimentos (otica_id, criado_em desc);
create index on estoque_movimentos (atendimento_id);

create or replace function estoque_somar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into estoque_saldos (otica_id, loja_id, item_id, quantidade)
  values (new.otica_id, new.loja_id, new.item_id, new.quantidade)
  on conflict (loja_id, item_id) do update
    set quantidade = estoque_saldos.quantidade + excluded.quantidade, atualizado_em = now();
  return null;
end $$;
create trigger estoque_somar after insert on estoque_movimentos
  for each row execute function estoque_somar();

-- livro de movimentos: só leitura para todos (as funções abaixo gravam como security definer)
alter table estoque_saldos enable row level security;
alter table estoque_movimentos enable row level security;
create policy estoque_saldos_ver on estoque_saldos for select to authenticated
  using (otica_id = (select minha_otica()) and (select acesso('estoque', 'ver')));
create policy estoque_movimentos_ver on estoque_movimentos for select to authenticated
  using (otica_id = (select minha_otica()) and (select acesso('estoque', 'ver')));
revoke insert, update, delete on estoque_saldos, estoque_movimentos from anon, authenticated;

-- loja informada (da ótica) ou a primeira loja ativa
create or replace function loja_ou_primeira(p_otica uuid, p_loja uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select id from lojas where id = p_loja and otica_id = p_otica),
    (select id from lojas where otica_id = p_otica and ativa order by criado_em limit 1))
$$;
revoke execute on function loja_ou_primeira(uuid, uuid) from public, anon, authenticated;

-- p_tipo: 'entrada' (compra, quantidade > 0), 'saida' (perda/quebra/uso, quantidade > 0, motivo
-- obrigatório) ou 'ajuste' (p_quantidade = o que foi contado na prateleira). Devolve o saldo novo.
create or replace function movimentar_estoque(
  p_item uuid, p_loja uuid, p_tipo text, p_quantidade int, p_custo numeric default null, p_motivo text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  otica  uuid := minha_otica();
  it     catalogo_itens%rowtype;
  loja   uuid;
  atual  int;
  delta  int;
begin
  select * into it from catalogo_itens where id = p_item and otica_id = otica;
  if not found then
    raise exception 'Produto não encontrado';
  end if;
  loja := loja_ou_primeira(otica, p_loja);
  if loja is null then
    raise exception 'Loja não encontrada';
  end if;
  if p_quantidade is null or p_quantidade < 0 or (p_tipo <> 'ajuste' and p_quantidade = 0) then
    raise exception 'Informe uma quantidade válida';
  end if;
  select coalesce((select quantidade from estoque_saldos where loja_id = loja and item_id = it.id), 0) into atual;

  if p_tipo = 'entrada' then
    if not acesso('estoque', 'criar') then
      raise exception 'Seu perfil não pode dar entrada no estoque' using errcode = 'insufficient_privilege';
    end if;
    delta := p_quantidade;
    if p_custo is not null then
      if p_custo < 0 then raise exception 'Custo inválido'; end if;
      update catalogo_itens set custo = round(p_custo, 2) where id = it.id;
    end if;
  elsif p_tipo in ('saida', 'ajuste') then
    if not acesso('estoque', 'editar') then
      raise exception 'Seu perfil não pode tirar nem ajustar o estoque' using errcode = 'insufficient_privilege';
    end if;
    if p_tipo = 'saida' and length(trim(coalesce(p_motivo, ''))) < 3 then
      raise exception 'Informe o motivo da saída (perda, quebra, uso interno…)';
    end if;
    delta := case when p_tipo = 'saida' then -p_quantidade else p_quantidade - atual end;
  else
    raise exception 'Tipo de movimento inválido';
  end if;

  if delta <> 0 then
    insert into estoque_movimentos (otica_id, loja_id, item_id, tipo, quantidade, custo_unitario, motivo)
    values (otica, loja, it.id, p_tipo, delta, case when p_tipo = 'entrada' then p_custo end,
            nullif(left(trim(coalesce(p_motivo, '')), 300), ''));
  end if;
  return atual + delta;
end $$;
grant execute on function movimentar_estoque(uuid, uuid, text, int, numeric, text) to authenticated;
revoke execute on function movimentar_estoque(uuid, uuid, text, int, numeric, text) from public, anon;

create or replace function transferir_estoque(p_item uuid, p_de uuid, p_para uuid, p_quantidade int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  otica uuid := minha_otica();
begin
  if not acesso('estoque', 'editar') then
    raise exception 'Seu perfil não pode transferir estoque' using errcode = 'insufficient_privilege';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Informe uma quantidade válida';
  end if;
  if p_de = p_para
     or not exists (select 1 from lojas where id = p_de and otica_id = otica)
     or not exists (select 1 from lojas where id = p_para and otica_id = otica)
     or not exists (select 1 from catalogo_itens where id = p_item and otica_id = otica) then
    raise exception 'Escolha duas lojas diferentes da sua ótica';
  end if;
  insert into estoque_movimentos (otica_id, loja_id, item_id, tipo, quantidade, motivo) values
    (otica, p_de,   p_item, 'transferencia', -p_quantidade, 'Para outra loja'),
    (otica, p_para, p_item, 'transferencia',  p_quantidade, 'De outra loja');
  return true;
end $$;
grant execute on function transferir_estoque(uuid, uuid, uuid, int) to authenticated;
revoke execute on function transferir_estoque(uuid, uuid, uuid, int) from public, anon;

-- ---------------------------------------------------------------------------
-- 3. Comissões
-- ---------------------------------------------------------------------------
-- Regra mais específica vale: vendedor + categoria > vendedor > categoria > todos.
create table comissao_regras (
  id          uuid primary key default gen_random_uuid(),
  otica_id    uuid not null references oticas(id) on delete cascade,
  usuario_id  uuid references usuarios(id) on delete cascade,      -- null = todos os vendedores
  categoria   text check (categoria in ('lente', 'tratamento', 'armacao', 'lente_contato', 'acessorio', 'servico')),
  percentual  numeric(5,2) not null check (percentual between 0 and 100),
  unique nulls not distinct (otica_id, usuario_id, categoria)
);

create table comissoes (
  id              uuid primary key default gen_random_uuid(),
  otica_id        uuid not null references oticas(id) on delete cascade,
  usuario_id      uuid not null references usuarios(id) on delete cascade,
  atendimento_id  uuid references atendimentos(id) on delete cascade,
  venda_id        uuid references vendas(id) on delete cascade,
  base            numeric(12,2) not null,      -- valor vendido que conta para a comissão
  valor           numeric(12,2) not null,
  competencia     date not null,               -- primeiro dia do mês da venda
  status          text not null default 'aberta' check (status in ('aberta', 'paga', 'cancelada')),
  paga_em         date,
  criado_em       timestamptz not null default now(),
  unique (atendimento_id, usuario_id),
  unique (venda_id, usuario_id)
);
create index on comissoes (otica_id, competencia);
create index on comissoes (usuario_id, competencia);

alter table comissao_regras enable row level security;
alter table comissoes enable row level security;
create trigger preencher_otica before insert on comissao_regras for each row execute function preencher_otica();

create policy comissao_regras_ver on comissao_regras for select to authenticated
  using (otica_id = (select minha_otica()) and (select acesso('comissoes', 'ver')));
create policy comissao_regras_escrever on comissao_regras for all to authenticated
  using (otica_id = (select minha_otica()) and (select acesso('comissoes', 'editar')))
  with check (otica_id = (select minha_otica()) and (select acesso('comissoes', 'editar')));

-- vendedor vê as dele; quem edita comissões vê todas
create policy comissoes_ver on comissoes for select to authenticated
  using (otica_id = (select minha_otica()) and (select acesso('comissoes', 'ver'))
         and (usuario_id = (select auth.uid()) or (select acesso('comissoes', 'editar'))));
revoke insert, update, delete on comissoes from anon, authenticated;

create or replace function percentual_comissao(p_otica uuid, p_usuario uuid, p_categoria text) returns numeric
language sql stable security definer set search_path = public as $$
  select percentual from comissao_regras
  where otica_id = p_otica
    and (usuario_id = p_usuario or usuario_id is null)
    and (categoria = p_categoria or categoria is null)
  order by (usuario_id is not null) desc, (categoria is not null) desc
  limit 1
$$;
revoke execute on function percentual_comissao(uuid, uuid, text) from public, anon, authenticated;

create or replace function marcar_comissoes_pagas(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not acesso('comissoes', 'editar') then
    raise exception 'Seu perfil não pode pagar comissões' using errcode = 'insufficient_privilege';
  end if;
  update comissoes set status = 'paga', paga_em = current_date
   where id = any(p_ids) and otica_id = minha_otica() and status = 'aberta';
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function marcar_comissoes_pagas(uuid[]) to authenticated;
revoke execute on function marcar_comissoes_pagas(uuid[]) from public, anon;

-- ---------------------------------------------------------------------------
-- 4. Venda fechada (primeiro pagamento do atendimento): baixa no estoque e comissão
-- ---------------------------------------------------------------------------
create or replace function venda_fechada() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a        atendimentos%rowtype;
  loja     uuid;
  vendedor uuid;
  v_base   numeric := 0;
  v_total  numeric := 0;
  it       record;
  pct      numeric;
begin
  if new.atendimento_id is null
     or exists (select 1 from pagamentos p where p.atendimento_id = new.atendimento_id and p.id <> new.id) then
    return null;   -- não é o primeiro pagamento
  end if;
  select * into a from atendimentos where id = new.atendimento_id;
  loja := loja_ou_primeira(a.otica_id, a.loja_id);

  -- baixa no estoque (uma vez por atendimento)
  if loja is not null and not exists (select 1 from estoque_movimentos where atendimento_id = a.id) then
    insert into estoque_movimentos (otica_id, loja_id, item_id, tipo, quantidade, atendimento_id, motivo, usuario_id)
    select a.otica_id, loja, ai.catalogo_item_id, 'venda', -ceil(ai.quantidade)::int, a.id, 'Venda', new.registrado_por
    from atendimento_itens ai join catalogo_itens c on c.id = ai.catalogo_item_id
    where ai.atendimento_id = a.id and c.controla_estoque;
  end if;

  -- comissão do vendedor do atendimento (ou de quem registrou o pagamento)
  vendedor := coalesce(a.responsavel_id, new.registrado_por);
  if vendedor is not null and not exists (select 1 from comissoes where atendimento_id = a.id) then
    for it in
      select ai.quantidade * ai.preco_unitario as subtotal, c.categoria
      from atendimento_itens ai left join catalogo_itens c on c.id = ai.catalogo_item_id
      where ai.atendimento_id = a.id
    loop
      pct := percentual_comissao(a.otica_id, vendedor, it.categoria);
      if pct is not null then
        v_base := v_base + it.subtotal;
        v_total := v_total + it.subtotal * pct / 100;
      end if;
    end loop;
    if v_total > 0 then
      insert into comissoes (otica_id, usuario_id, atendimento_id, base, valor, competencia)
      values (a.otica_id, vendedor, a.id, round(v_base, 2), round(v_total, 2),
              date_trunc('month', (new.pago_em at time zone 'America/Sao_Paulo'))::date);
    end if;
  end if;
  return null;
end $$;
create trigger venda_fechada after insert on pagamentos
  for each row execute function venda_fechada();
