-- Vitral — migração 0024: o caixa recebe os óculos e o crediário, devolve parte da venda e tem resumo
--
-- 1. Receber no caixa: o sinal e o saldo dos óculos (atendimento do funil) e as parcelas do crediário podem ser
--    pagos no caixa do PDV. O pagamento guarda o caixa (pagamentos.caixa_id, contas_receber.caixa_id) e o que for
--    em dinheiro entra na conta da gaveta. A regra do funil continua a mesma: o primeiro pagamento ganha o
--    atendimento e cria a OS uma única vez (pagamento_do_atendimento, usada também por registrar_pagamento).
-- 2. Devolver parte da venda (gerente): o produto volta ao estoque, a comissão em aberto diminui na proporção e o
--    reembolso sai em dinheiro (da gaveta), Pix, estorno no cartão ou abatendo o crediário da própria venda.
-- 3. resumo_caixa(): os números do caixa num lugar só; o fechamento e o comprovante usam a mesma conta.

alter table pagamentos add column caixa_id uuid references caixas(id) on delete set null;
alter table contas_receber add column caixa_id uuid references caixas(id) on delete set null;
create index if not exists pagamentos_caixa on pagamentos (caixa_id) where caixa_id is not null;
create index if not exists contas_receber_caixa on contas_receber (caixa_id) where caixa_id is not null;

alter table caixa_movimentos drop constraint caixa_movimentos_tipo_check;
alter table caixa_movimentos add constraint caixa_movimentos_tipo_check check (tipo in ('sangria', 'suprimento', 'devolucao'));

-- ---------------------------------------------------------------------------
-- 1. Pagamento do atendimento (funil), com ou sem caixa
-- ---------------------------------------------------------------------------
-- Interna: sem conferência de permissão (quem chama confere). Ninguém de fora executa.
create or replace function pagamento_do_atendimento(
  p_atendimento uuid, p_valor numeric, p_forma text, p_parcelas smallint, p_sinal boolean, p_data_prometida date, p_caixa uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a      atendimentos%rowtype;
  ganha  uuid;
  os_id  uuid;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor maior que zero';
  end if;
  select * into a from atendimentos where id = p_atendimento and otica_id = minha_otica();
  if not found then
    raise exception 'Atendimento não encontrado';
  end if;

  insert into pagamentos (otica_id, atendimento_id, forma, valor, parcelas, sinal, registrado_por, caixa_id)
  values (a.otica_id, a.id, p_forma, round(p_valor, 2), coalesce(p_parcelas, 1), coalesce(p_sinal, false), auth.uid(), p_caixa);

  -- primeiro pagamento: o atendimento vira ganho
  select id into ganha from funil_etapas where otica_id = a.otica_id and tipo = 'ganha' order by ordem limit 1;
  if ganha is not null and a.etapa_id <> ganha then
    update atendimentos set etapa_id = ganha where id = a.id;
  end if;
  -- e a OS nasce uma única vez
  select id into os_id from ordens_servico where atendimento_id = a.id limit 1;
  if os_id is null then
    os_id := criar_os_do_atendimento(a.id, p_data_prometida);
  end if;
  return os_id;
end $$;
revoke execute on function pagamento_do_atendimento(uuid, numeric, text, smallint, boolean, date, uuid) from public, anon, authenticated;

-- a OS nasce no primeiro pagamento, feito pela loja ou pelo caixa
create or replace function criar_os_do_atendimento(p_atendimento uuid, p_data_prometida date default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a atendimentos%rowtype;
  primeira uuid;
  nova uuid;
begin
  if not (acesso('vendas', 'editar') or acesso('pdv', 'criar')) then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  select * into a from atendimentos where id = p_atendimento and otica_id = minha_otica();
  if not found then
    raise exception 'Atendimento não encontrado';
  end if;
  select id into primeira from os_etapas where otica_id = a.otica_id order by ordem limit 1;
  insert into ordens_servico (otica_id, loja_id, atendimento_id, cliente_id, receita_id, etapa_id, descricao, data_prometida)
  values (a.otica_id, a.loja_id, a.id, a.cliente_id, a.receita_id, primeira,
          coalesce(a.descricao, 'Ordem de serviço'), p_data_prometida)
  returning id into nova;
  return nova;
end $$;

-- a loja continua registrando pelo funil (sem caixa), como antes
create or replace function registrar_pagamento(
  p_atendimento uuid, p_valor numeric, p_forma text, p_parcelas smallint default 1, p_sinal boolean default false, p_data_prometida date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not acesso('vendas', 'editar') then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  return pagamento_do_atendimento(p_atendimento, p_valor, p_forma, p_parcelas, p_sinal, p_data_prometida, null);
end $$;

-- O que está para receber, para o caixa achar pelo nome do cliente: óculos com saldo e parcelas do crediário.
-- O caixa não lê o funil nem o financeiro; vê só isto.
create or replace function pendencias_para_receber(p_busca text)
returns table (tipo text, id uuid, cliente text, descricao text, total numeric, pago numeric, saldo numeric, vencimento date)
language plpgsql stable security definer set search_path = public as $$
declare
  v_busca text := nullif(trim(coalesce(p_busca, '')), '');
begin
  if minha_otica() is null or not acesso('pdv', 'criar') then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  if v_busca is null or length(v_busca) < 2 then
    return;
  end if;
  return query
    select 'oculos'::text, a.id, c.nome, coalesce(a.descricao, 'Óculos'), a.valor_total, coalesce(p.pago, 0),
           a.valor_total - coalesce(p.pago, 0), null::date
    from atendimentos a
    join clientes c on c.id = a.cliente_id
    join funil_etapas e on e.id = a.etapa_id
    left join lateral (select sum(valor) as pago from pagamentos where atendimento_id = a.id) p on true
    where a.otica_id = minha_otica() and e.tipo <> 'perdida' and a.valor_total > coalesce(p.pago, 0)
      and (c.nome ilike '%' || v_busca || '%' or regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') like '%' || regexp_replace(v_busca, '\D', '', 'g') || '%' and length(regexp_replace(v_busca, '\D', '', 'g')) >= 4)
    union all
    select 'parcela', r.id, coalesce(c.nome, '—'), r.descricao, r.valor, 0::numeric, r.valor, r.vencimento
    from contas_receber r
    left join clientes c on c.id = r.cliente_id
    where r.otica_id = minha_otica() and r.recebido_em is null
      and (c.nome ilike '%' || v_busca || '%' or regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') like '%' || regexp_replace(v_busca, '\D', '', 'g') || '%' and length(regexp_replace(v_busca, '\D', '', 'g')) >= 4)
    order by 3, 8 nulls first
    limit 30;
end $$;
revoke execute on function pendencias_para_receber(text) from public, anon;
grant execute on function pendencias_para_receber(text) to authenticated;

create or replace function receber_no_caixa(
  p_caixa uuid, p_tipo text, p_id uuid, p_valor numeric, p_forma text, p_parcelas smallint default 1, p_data_prometida date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c       caixas%rowtype;
  r       contas_receber%rowtype;
  v_saldo numeric;
begin
  if not acesso('pdv', 'criar') then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  c := caixa_do_operador(p_caixa);
  if p_forma not in ('dinheiro', 'pix', 'credito', 'debito') then
    raise exception 'Forma de pagamento inválida';
  end if;

  if p_tipo = 'oculos' then
    select a.valor_total - coalesce((select sum(valor) from pagamentos where atendimento_id = a.id), 0) into v_saldo
    from atendimentos a where a.id = p_id and a.otica_id = c.otica_id;
    if v_saldo is null then
      raise exception 'Atendimento não encontrado';
    end if;
    if p_valor > v_saldo + 0.005 then
      raise exception 'O valor (R$ %) passa do que falta pagar (R$ %)', round(p_valor, 2), round(v_saldo, 2);
    end if;
    return pagamento_do_atendimento(p_id, p_valor, p_forma, p_parcelas,
      not exists (select 1 from pagamentos where atendimento_id = p_id), p_data_prometida, c.id);
  elsif p_tipo = 'parcela' then
    select * into r from contas_receber where id = p_id and otica_id = c.otica_id for update;
    if not found then
      raise exception 'Parcela não encontrada';
    end if;
    if r.recebido_em is not null then
      raise exception 'Esta parcela já foi recebida';
    end if;
    update contas_receber set recebido_em = (now() at time zone 'America/Sao_Paulo')::date, recebido_forma = p_forma, caixa_id = c.id
    where id = r.id;
    return r.id;
  end if;
  raise exception 'Tipo inválido';
end $$;
revoke execute on function receber_no_caixa(uuid, text, uuid, numeric, text, smallint, date) from public, anon;
grant execute on function receber_no_caixa(uuid, text, uuid, numeric, text, smallint, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Devolução de parte da venda
-- ---------------------------------------------------------------------------
create table devolucoes (
  id          uuid primary key default gen_random_uuid(),
  otica_id    uuid not null references oticas(id) on delete cascade,
  venda_id    uuid not null references vendas(id) on delete cascade,
  caixa_id    uuid references caixas(id) on delete set null,
  valor       numeric(12,2) not null check (valor > 0),
  forma       text not null check (forma in ('dinheiro', 'pix', 'estorno_cartao', 'abater_crediario')),
  motivo      text not null,
  usuario_id  uuid references usuarios(id) on delete set null default auth.uid(),
  criado_em   timestamptz not null default now()
);
create table devolucao_itens (
  id             uuid primary key default gen_random_uuid(),
  otica_id       uuid not null references oticas(id) on delete cascade,
  devolucao_id   uuid not null references devolucoes(id) on delete cascade,
  venda_item_id  uuid not null references venda_itens(id) on delete cascade,
  quantidade     int not null check (quantidade > 0),
  valor          numeric(12,2) not null
);
create index on devolucoes (otica_id, venda_id);
create index on devolucoes (caixa_id) where caixa_id is not null;
create index on devolucao_itens (venda_item_id);
alter table devolucoes enable row level security;
alter table devolucao_itens enable row level security;
create policy devolucoes_ver on devolucoes for select to authenticated
  using (otica_id = (select minha_otica()) and (select acesso_algum(array['pdv', 'financeiro'], 'ver')));
create policy devolucao_itens_ver on devolucao_itens for select to authenticated
  using (otica_id = (select minha_otica()) and (select acesso_algum(array['pdv', 'financeiro'], 'ver')));
revoke insert, update, delete on devolucoes, devolucao_itens from anon, authenticated;
revoke all on devolucoes, devolucao_itens from anon;

-- p_itens: [{"venda_item_id": "...", "quantidade": 1}]
create or replace function devolver_itens(p_venda uuid, p_itens jsonb, p_forma text, p_motivo text, p_caixa uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v        vendas%rowtype;
  c        caixas%rowtype;
  it       record;
  vi       venda_itens%rowtype;
  v_dev    uuid;
  v_total  numeric := 0;
  v_ja     int;
  v_valor  numeric;
  v_aberto numeric;
  k        record;
  v_resto  numeric;
begin
  if not acesso('pdv', 'editar') then
    raise exception 'Só o gerente faz devolução' using errcode = 'insufficient_privilege';
  end if;
  select * into v from vendas where id = p_venda and otica_id = minha_otica() for update;
  if not found then
    raise exception 'Venda não encontrada';
  end if;
  if v.cancelada then
    raise exception 'Esta venda foi cancelada';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo da devolução';
  end if;
  if p_forma not in ('dinheiro', 'pix', 'estorno_cartao', 'abater_crediario') then
    raise exception 'Forma de reembolso inválida';
  end if;
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Escolha o que vai ser devolvido';
  end if;
  if p_forma = 'dinheiro' then
    if p_caixa is null then
      raise exception 'Reembolso em dinheiro sai de um caixa aberto';
    end if;
    c := caixa_do_operador(p_caixa);
  end if;

  insert into devolucoes (otica_id, venda_id, caixa_id, valor, forma, motivo)
  values (v.otica_id, v.id, c.id, 0.01, p_forma, left(trim(p_motivo), 300))
  returning id into v_dev;

  for it in
    select (e ->> 'venda_item_id')::uuid as item, (e ->> 'quantidade')::int as qtd from jsonb_array_elements(p_itens) e
  loop
    select * into vi from venda_itens where id = it.item and venda_id = v.id;
    if not found then
      raise exception 'Item não é desta venda';
    end if;
    select coalesce(sum(quantidade), 0) into v_ja from devolucao_itens where venda_item_id = vi.id;
    if it.qtd is null or it.qtd <= 0 or it.qtd > vi.quantidade - v_ja then
      raise exception 'Quantidade inválida para "%": pode devolver até %', vi.descricao, vi.quantidade - v_ja;
    end if;
    -- o desconto da venda vale na mesma proporção para o que volta
    v_valor := round(it.qtd * vi.preco_unitario * case when v.subtotal > 0 then v.total / v.subtotal else 1 end, 2);
    insert into devolucao_itens (otica_id, devolucao_id, venda_item_id, quantidade, valor) values (v.otica_id, v_dev, vi.id, it.qtd, v_valor);
    v_total := v_total + v_valor;
    -- volta ao estoque (só o que a venda tirou do estoque)
    if exists (select 1 from estoque_movimentos where venda_id = v.id and item_id = vi.catalogo_item_id and tipo = 'venda') then
      insert into estoque_movimentos (otica_id, loja_id, item_id, tipo, quantidade, venda_id, motivo)
      values (v.otica_id, v.loja_id, vi.catalogo_item_id, 'devolucao', it.qtd, v.id, left('Devolução: ' || trim(p_motivo), 300));
    end if;
  end loop;
  update devolucoes set valor = v_total where id = v_dev;

  if p_forma = 'dinheiro' then
    insert into caixa_movimentos (otica_id, caixa_id, tipo, valor, motivo)
    values (v.otica_id, c.id, 'devolucao', v_total, left('Devolução da venda ' || v.numero || ': ' || trim(p_motivo), 200));
  elsif p_forma = 'abater_crediario' then
    select coalesce(sum(valor), 0) into v_aberto from contas_receber where venda_id = v.id and recebido_em is null;
    if v_aberto < v_total then
      raise exception 'O crediário em aberto desta venda (R$ %) é menor que a devolução (R$ %)', v_aberto, v_total;
    end if;
    -- abate das últimas parcelas para as primeiras
    v_resto := v_total;
    for k in select id, valor from contas_receber where venda_id = v.id and recebido_em is null order by vencimento desc loop
      exit when v_resto <= 0;
      if k.valor <= v_resto then
        delete from contas_receber where id = k.id;
        v_resto := v_resto - k.valor;
      else
        update contas_receber set valor = valor - v_resto where id = k.id;
        v_resto := 0;
      end if;
    end loop;
  end if;

  -- comissão ainda não paga diminui na proporção do que voltou
  update comissoes set
    valor = round(valor * greatest(base - v_total, 0) / base, 2),
    base  = greatest(base - v_total, 0)
  where venda_id = v.id and status = 'aberta' and base > 0;

  return jsonb_build_object('devolucao_id', v_dev, 'valor', v_total);
end $$;
revoke execute on function devolver_itens(uuid, jsonb, text, text, uuid) from public, anon;
grant execute on function devolver_itens(uuid, jsonb, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Resumo do caixa (tela, fechamento e comprovante)
-- ---------------------------------------------------------------------------
create or replace function resumo_caixa(p_caixa uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c caixas%rowtype;
  v_vendas jsonb; v_receb jsonb;
  v_sangria numeric; v_suprimento numeric; v_devolucao numeric;
  v_dinheiro numeric; v_esperado numeric;
begin
  if not acesso_algum(array['pdv', 'financeiro'], 'ver') then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  select * into c from caixas where id = p_caixa and otica_id = minha_otica();
  if not found then
    raise exception 'Caixa não encontrado';
  end if;

  -- vendas do PDV, por forma (crediário não entra: vira conta a receber)
  select coalesce(jsonb_object_agg(forma, total), '{}') into v_vendas from (
    select p.forma, sum(p.valor) as total from pagamentos p join vendas v on v.id = p.venda_id
    where v.caixa_id = c.id and not v.cancelada group by p.forma) x;
  -- óculos e crediário recebidos neste caixa, por forma
  select coalesce(jsonb_object_agg(forma, total), '{}') into v_receb from (
    select forma, sum(valor) as total from (
      select forma, valor from pagamentos where caixa_id = c.id and venda_id is null
      union all
      select recebido_forma, valor from contas_receber where caixa_id = c.id) y
    group by forma) x;
  select coalesce(sum(valor) filter (where tipo = 'sangria'), 0), coalesce(sum(valor) filter (where tipo = 'suprimento'), 0),
         coalesce(sum(valor) filter (where tipo = 'devolucao'), 0)
    into v_sangria, v_suprimento, v_devolucao
  from caixa_movimentos where caixa_id = c.id;

  v_dinheiro := coalesce((v_vendas ->> 'dinheiro')::numeric, 0) + coalesce((v_receb ->> 'dinheiro')::numeric, 0);
  v_esperado := c.valor_abertura + v_dinheiro + v_suprimento - v_sangria - v_devolucao;

  return jsonb_build_object(
    'caixa_id', c.id, 'aberto_em', c.aberto_em, 'fechado_em', c.fechado_em,
    'operador', (select nome from usuarios where id = c.operador_id), 'loja', (select nome from lojas where id = c.loja_id),
    'abertura', c.valor_abertura, 'vendas_por_forma', v_vendas, 'recebimentos_por_forma', v_receb,
    'qtd_vendas', (select count(*) from vendas where caixa_id = c.id and not cancelada),
    'qtd_canceladas', (select count(*) from vendas where caixa_id = c.id and cancelada),
    'sangrias', v_sangria, 'suprimentos', v_suprimento, 'devolucoes_dinheiro', v_devolucao,
    'esperado', v_esperado, 'contado', c.valor_fechamento,
    'diferenca', case when c.valor_fechamento is not null then c.valor_fechamento - coalesce(c.valor_esperado, v_esperado) end,
    'observacao', c.observacao
  );
end $$;
revoke execute on function resumo_caixa(uuid) from public, anon;
grant execute on function resumo_caixa(uuid) to authenticated;

create or replace function fechar_caixa(p_caixa uuid, p_contado numeric, p_observacao text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c         caixas%rowtype;
  esperado  numeric;
begin
  if not acesso('pdv', 'criar') then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  c := caixa_do_operador(p_caixa);
  if p_contado is null or p_contado < 0 then
    raise exception 'Informe quanto dinheiro tem na gaveta';
  end if;
  esperado := (resumo_caixa(c.id) ->> 'esperado')::numeric;
  update caixas set fechado_em = now(), valor_fechamento = round(p_contado, 2), valor_esperado = esperado,
         observacao = nullif(left(trim(coalesce(p_observacao, '')), 300), '')
   where id = c.id;
  return jsonb_build_object('esperado', esperado, 'contado', round(p_contado, 2), 'diferenca', round(p_contado, 2) - esperado);
end $$;
