-- Vitra — migração 0012 (Versão 4): PDV e financeiro
--
-- 1. Duas áreas novas, cada uma com tela e menu próprios: pdv (caixa) e financeiro (financeiro e
--    contador). Perfil novo: Contador (só leitura do financeiro e dos relatórios).
-- 2. PDV: caixa (abrir, sangria/suprimento, fechar com conferência), venda rápida com itens do
--    catálogo, várias formas de pagamento e crediário (vira conta a receber), baixa no estoque,
--    comissão e cancelamento com estorno. Tudo por funções do banco: ninguém grava venda direto.
--    Preço vem do catálogo; desconto acima de 10% só com pdv:editar (gerente).
-- 3. Financeiro: categorias de custo padrão, contas a pagar e a receber com mais campos,
--    alíquota de imposto para a estimativa do mês.

-- ---------------------------------------------------------------------------
-- 1. Áreas e perfis
-- ---------------------------------------------------------------------------
alter table perfis drop constraint perfis_area_check;
alter table perfis add constraint perfis_area_check
  check (area in ('loja', 'consultorio', 'laboratorio', 'gestao', 'pdv', 'financeiro'));

create or replace function perfis_v4(p_otica uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update perfis set area = 'pdv',
         permissoes = permissoes || '{"catalogo": ["ver"], "estoque": ["ver"]}'::jsonb
   where otica_id = p_otica and chave = 'caixa';
  -- financeiro cobra o crediário: vê o nome e o telefone do cliente (o contador não)
  update perfis set area = 'financeiro',
         permissoes = permissoes || '{"clientes": ["ver"]}'::jsonb
   where otica_id = p_otica and chave = 'financeiro';
  insert into perfis (otica_id, chave, nome, do_sistema, area, permissoes) values
    (p_otica, 'contador', 'Contador', true, 'financeiro', '{"financeiro": ["ver"], "relatorios": ["ver"]}'::jsonb)
  on conflict (otica_id, chave) do nothing;

  insert into categorias_custo (otica_id, nome, tipo)
  select p_otica, c.nome, c.tipo from (values
      ('Fornecedor de lentes', 'fornecedor'), ('Fornecedor de armações', 'fornecedor'), ('Laboratório externo', 'servico'),
      ('Aluguel', 'fixo'), ('Energia, água e internet', 'fixo'), ('Salários e encargos', 'fixo'),
      ('Simples Nacional / DAS', 'imposto'), ('Outros impostos e taxas', 'imposto'),
      ('Comissões', 'comissao'), ('Taxas de cartão', 'servico'), ('Outros', 'outro')) as c(nome, tipo)
  where not exists (select 1 from categorias_custo where otica_id = p_otica);
end $$;
revoke execute on function perfis_v4(uuid) from public, anon, authenticated;
select perfis_v4(id) from oticas;

create or replace function preparar_otica_v4() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform perfis_v4(new.id);
  return new;
end $$;
create trigger trg_preparar_otica_v8 after insert on oticas
  for each row execute function preparar_otica_v4();

-- ---------------------------------------------------------------------------
-- 2. PDV: estrutura
-- ---------------------------------------------------------------------------
alter table caixas
  add column valor_esperado numeric(12,2),           -- dinheiro que devia estar na gaveta ao fechar
  add column observacao     text;
create unique index caixas_um_aberto_por_operador on caixas (operador_id) where fechado_em is null;
create index on caixas (otica_id, aberto_em desc);

create table caixa_movimentos (
  id         uuid primary key default gen_random_uuid(),
  otica_id   uuid not null references oticas(id) on delete cascade,
  caixa_id   uuid not null references caixas(id) on delete cascade,
  tipo       text not null check (tipo in ('sangria', 'suprimento')),
  valor      numeric(12,2) not null check (valor > 0),
  motivo     text,
  usuario_id uuid references usuarios(id) default auth.uid(),
  criado_em  timestamptz not null default now()
);
create index on caixa_movimentos (caixa_id);

alter table vendas
  add column numero               int,
  add column observacao           text,
  add column cancelada_em         timestamptz,
  add column cancelada_por        uuid references usuarios(id),
  add column motivo_cancelamento  text;
create unique index vendas_numero on vendas (otica_id, numero);
create index on vendas (otica_id, criado_em desc);
create index on vendas (caixa_id);
create index if not exists pagamentos_venda_idx on pagamentos (venda_id);

create table venda_itens (
  id               uuid primary key default gen_random_uuid(),
  otica_id         uuid not null references oticas(id) on delete cascade,
  venda_id         uuid not null references vendas(id) on delete cascade,
  catalogo_item_id uuid references catalogo_itens(id),
  descricao        text not null,
  quantidade       int not null check (quantidade > 0),
  preco_unitario   numeric(12,2) not null check (preco_unitario >= 0)
);
create index on venda_itens (venda_id);

alter table caixa_movimentos enable row level security;
alter table venda_itens enable row level security;
create policy caixa_movimentos_ver on caixa_movimentos for select to authenticated
  using (otica_id = (select minha_otica()) and (select acesso_algum(array['pdv', 'financeiro'], 'ver')));
create policy venda_itens_ver on venda_itens for select to authenticated
  using (otica_id = (select minha_otica()) and (select acesso_algum(array['pdv', 'financeiro'], 'ver')));
-- caixa e venda só mudam pelas funções abaixo (as políticas de leitura da 0001 continuam)
revoke insert, update, delete on caixas, vendas, venda_itens, caixa_movimentos from anon, authenticated;

create trigger aud_vendas after insert or update or delete on vendas for each row execute function auditar();

-- ---------------------------------------------------------------------------
-- 3. PDV: funções
-- ---------------------------------------------------------------------------
create or replace function abrir_caixa(p_loja uuid, p_valor numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  otica uuid := minha_otica();
  v_caixa uuid;
begin
  if not acesso('pdv', 'criar') then
    raise exception 'Seu perfil não pode abrir o caixa' using errcode = 'insufficient_privilege';
  end if;
  select id into v_caixa from caixas where operador_id = auth.uid() and fechado_em is null;
  if v_caixa is not null then
    return v_caixa;   -- já tem um aberto
  end if;
  if coalesce(p_valor, 0) < 0 then
    raise exception 'Valor de abertura inválido';
  end if;
  insert into caixas (otica_id, loja_id, operador_id, valor_abertura)
  values (otica, loja_ou_primeira(otica, p_loja), auth.uid(), round(coalesce(p_valor, 0), 2))
  returning id into v_caixa;
  return v_caixa;
end $$;

-- caixa aberto do próprio operador (ou qualquer um, para o gerente)
create or replace function caixa_do_operador(p_caixa uuid) returns caixas
language plpgsql stable security definer set search_path = public as $$
declare
  c caixas%rowtype;
begin
  select * into c from caixas where id = p_caixa and otica_id = minha_otica();
  if not found then
    raise exception 'Caixa não encontrado';
  end if;
  if c.fechado_em is not null then
    raise exception 'Este caixa já foi fechado';
  end if;
  if c.operador_id <> auth.uid() and not acesso('pdv', 'editar') then
    raise exception 'Este caixa é de outra pessoa' using errcode = 'insufficient_privilege';
  end if;
  return c;
end $$;
revoke execute on function caixa_do_operador(uuid) from public, anon, authenticated;

create or replace function movimentar_caixa(p_caixa uuid, p_tipo text, p_valor numeric, p_motivo text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  c caixas%rowtype;
begin
  if not acesso('pdv', 'criar') then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  c := caixa_do_operador(p_caixa);
  if p_tipo not in ('sangria', 'suprimento') then
    raise exception 'Tipo inválido';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor maior que zero';
  end if;
  insert into caixa_movimentos (otica_id, caixa_id, tipo, valor, motivo)
  values (c.otica_id, c.id, p_tipo, round(p_valor, 2), nullif(left(trim(coalesce(p_motivo, '')), 200), ''));
  return true;
end $$;

-- p_itens:      [{"item_id": "...", "quantidade": 1}]
-- p_pagamentos: [{"forma": "pix", "valor": 100}, {"forma": "credito", "valor": 200, "parcelas": 3},
--                {"forma": "crediario", "valor": 150, "vencimento": "2026-12-10"}]
-- A soma dos pagamentos tem de ser o total (o troco do dinheiro fica fora: mande o valor da venda).
create or replace function registrar_venda(
  p_caixa uuid, p_cliente uuid, p_itens jsonb, p_desconto numeric, p_pagamentos jsonb, p_observacao text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c         caixas%rowtype;
  it        record;
  pg        record;
  cat       catalogo_itens%rowtype;
  v_venda   uuid;
  v_sub     numeric := 0;
  v_desc    numeric := round(coalesce(p_desconto, 0), 2);
  v_total   numeric;
  v_pago    numeric := 0;
  v_base    numeric := 0;
  v_comis   numeric := 0;
  pct       numeric;
begin
  if not acesso('pdv', 'criar') then
    raise exception 'Seu perfil não pode vender no PDV' using errcode = 'insufficient_privilege';
  end if;
  c := caixa_do_operador(p_caixa);
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A venda não tem itens';
  end if;
  if jsonb_array_length(p_itens) > 100 then
    raise exception 'Itens demais numa venda';
  end if;
  if p_cliente is not null and not exists (select 1 from clientes where id = p_cliente and otica_id = c.otica_id) then
    raise exception 'Cliente não encontrado';
  end if;

  insert into vendas (otica_id, loja_id, caixa_id, cliente_id, vendedor_id, subtotal, desconto, total, numero, observacao)
  values (c.otica_id, c.loja_id, c.id, p_cliente, auth.uid(), 0, 0, 0, proximo_numero(c.otica_id, 'venda'),
          nullif(left(trim(coalesce(p_observacao, '')), 300), ''))
  returning id into v_venda;

  for it in select (e ->> 'item_id')::uuid as item_id, (e ->> 'quantidade')::int as qtd from jsonb_array_elements(p_itens) e loop
    select * into cat from catalogo_itens where id = it.item_id and otica_id = c.otica_id and ativo;
    if not found then
      raise exception 'Produto não encontrado ou inativo';
    end if;
    if it.qtd is null or it.qtd <= 0 or it.qtd > 999 then
      raise exception 'Quantidade inválida para %', cat.nome;
    end if;
    insert into venda_itens (otica_id, venda_id, catalogo_item_id, descricao, quantidade, preco_unitario)
    values (c.otica_id, v_venda, cat.id, cat.nome, it.qtd, cat.preco);
    v_sub := v_sub + it.qtd * cat.preco;
    if cat.controla_estoque then
      insert into estoque_movimentos (otica_id, loja_id, item_id, tipo, quantidade, venda_id, motivo)
      values (c.otica_id, c.loja_id, cat.id, 'venda', -it.qtd, v_venda, 'Venda no PDV');
    end if;
  end loop;

  if v_desc < 0 or v_desc > v_sub then
    raise exception 'Desconto inválido';
  end if;
  if v_desc > round(v_sub * 0.10, 2) and not acesso('pdv', 'editar') then
    raise exception 'Desconto acima de 10%% precisa do gerente' using errcode = 'insufficient_privilege';
  end if;
  v_total := v_sub - v_desc;
  update vendas set subtotal = v_sub, desconto = v_desc, total = v_total where id = v_venda;

  if jsonb_typeof(p_pagamentos) is distinct from 'array' or jsonb_array_length(p_pagamentos) = 0 then
    raise exception 'Informe a forma de pagamento';
  end if;
  for pg in select e ->> 'forma' as forma, round((e ->> 'valor')::numeric, 2) as valor,
                   greatest(1, coalesce((e ->> 'parcelas')::int, 1)) as parcelas,
                   nullif(e ->> 'vencimento', '')::date as vencimento
            from jsonb_array_elements(p_pagamentos) e loop
    if pg.valor is null or pg.valor <= 0 then
      raise exception 'Valor de pagamento inválido';
    end if;
    if pg.forma = 'crediario' then
      if p_cliente is null then
        raise exception 'Crediário precisa do cliente identificado';
      end if;
      insert into contas_receber (otica_id, loja_id, venda_id, cliente_id, descricao, valor, vencimento)
      values (c.otica_id, c.loja_id, v_venda, p_cliente, 'Crediário da venda ' || (select numero from vendas where id = v_venda),
              pg.valor, coalesce(pg.vencimento, current_date + 30));
    elsif pg.forma in ('dinheiro', 'pix', 'credito', 'debito') then
      insert into pagamentos (otica_id, venda_id, forma, valor, parcelas, registrado_por)
      values (c.otica_id, v_venda, pg.forma, pg.valor, pg.parcelas, auth.uid());
    else
      raise exception 'Forma de pagamento inválida';
    end if;
    v_pago := v_pago + pg.valor;
  end loop;
  if v_pago <> v_total then
    raise exception 'Os pagamentos (R$ %) não fecham com o total da venda (R$ %)', v_pago, v_total;
  end if;

  -- comissão de quem vendeu, com o desconto repartido entre os itens
  for it in select vi.quantidade * vi.preco_unitario as subtotal, ci.categoria
            from venda_itens vi left join catalogo_itens ci on ci.id = vi.catalogo_item_id where vi.venda_id = v_venda loop
    pct := percentual_comissao(c.otica_id, auth.uid(), it.categoria);
    if pct is not null and v_sub > 0 then
      v_base := v_base + it.subtotal * v_total / v_sub;
      v_comis := v_comis + it.subtotal * v_total / v_sub * pct / 100;
    end if;
  end loop;
  if v_comis > 0 then
    insert into comissoes (otica_id, usuario_id, venda_id, base, valor, competencia)
    values (c.otica_id, auth.uid(), v_venda, round(v_base, 2), round(v_comis, 2),
            date_trunc('month', now() at time zone 'America/Sao_Paulo')::date);
  end if;
  return v_venda;
end $$;

create or replace function cancelar_venda(p_venda uuid, p_motivo text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v vendas%rowtype;
begin
  if not acesso('pdv', 'editar') then
    raise exception 'Só o gerente cancela venda' using errcode = 'insufficient_privilege';
  end if;
  select * into v from vendas where id = p_venda and otica_id = minha_otica();
  if not found then
    raise exception 'Venda não encontrada';
  end if;
  if v.cancelada then
    return true;
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo do cancelamento';
  end if;
  update vendas set cancelada = true, cancelada_em = now(), cancelada_por = auth.uid(),
         motivo_cancelamento = left(trim(p_motivo), 300)
   where id = v.id;
  -- devolve ao estoque o que a venda tirou
  insert into estoque_movimentos (otica_id, loja_id, item_id, tipo, quantidade, venda_id, motivo)
  select otica_id, loja_id, item_id, 'devolucao', -quantidade, venda_id, 'Venda cancelada'
  from estoque_movimentos where venda_id = v.id and tipo = 'venda';
  update comissoes set status = 'cancelada' where venda_id = v.id and status = 'aberta';
  delete from contas_receber where venda_id = v.id and recebido_em is null;
  return true;
end $$;

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
  esperado := c.valor_abertura
    + coalesce((select sum(p.valor) from pagamentos p join vendas v on v.id = p.venda_id
                 where v.caixa_id = c.id and not v.cancelada and p.forma = 'dinheiro'), 0)
    + coalesce((select sum(case tipo when 'suprimento' then valor else -valor end) from caixa_movimentos where caixa_id = c.id), 0);
  update caixas set fechado_em = now(), valor_fechamento = round(p_contado, 2), valor_esperado = esperado,
         observacao = nullif(left(trim(coalesce(p_observacao, '')), 300), '')
   where id = c.id;
  return jsonb_build_object('esperado', esperado, 'contado', round(p_contado, 2), 'diferenca', round(p_contado, 2) - esperado);
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'abrir_caixa(uuid, numeric)', 'movimentar_caixa(uuid, text, numeric, text)',
    'registrar_venda(uuid, uuid, jsonb, numeric, jsonb, text)', 'cancelar_venda(uuid, text)',
    'fechar_caixa(uuid, numeric, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Financeiro
-- ---------------------------------------------------------------------------
alter table contas_pagar
  add column fornecedor     text,
  add column observacao     text,
  add column recorrencia_id uuid;          -- mesma conta repetida em vários meses
alter table contas_receber
  add column observacao     text,
  add column recebido_forma text check (recebido_forma in ('dinheiro', 'pix', 'credito', 'debito', 'boleto', 'outro'));
create index if not exists contas_pagar_pago_idx on contas_pagar (otica_id, pago_em);
create index if not exists contas_receber_recebido_idx on contas_receber (otica_id, recebido_em);
create index if not exists contas_receber_venda_idx on contas_receber (venda_id);

do $$
declare
  t text;
begin
  foreach t in array array['categorias_custo', 'contas_pagar', 'contas_receber'] loop
    execute format('create trigger preencher_otica before insert on %I for each row execute function preencher_otica()', t);
  end loop;
end $$;

-- estimativa de imposto do mês: faturamento × alíquota (ex.: Simples Nacional)
alter table oticas add column aliquota_imposto numeric(5,2) check (aliquota_imposto between 0 and 100);
grant update (aliquota_imposto) on oticas to authenticated;

create trigger aud_contas_pagar after insert or update or delete on contas_pagar for each row execute function auditar();
create trigger aud_contas_receber after insert or update or delete on contas_receber for each row execute function auditar();
