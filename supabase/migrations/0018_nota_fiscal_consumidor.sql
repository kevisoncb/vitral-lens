-- Vitral — migração 0018: emissão de NFC-e (nota fiscal ao consumidor) pelo caixa, via Focus NFe
--
-- Fluxo (o servidor do Vitral conversa com a Focus NFe; o navegador nunca vê o token):
--   1. preparar_nfce(venda): confere adicional, permissão e cadastro fiscal, cria a nota "pendente" e
--      devolve os dados prontos (emitente, itens com NCM/CFOP/origem/CSOSN, pagamentos, desconto rateado).
--   2. o servidor manda para a Focus (POST /v2/nfce?ref=...), que autoriza ou rejeita na hora.
--   3. registrar_retorno_nfce(): grava autorizada (chave, número, DANFCe, QR code) ou rejeitada (motivo).
--   4. cancelamento: só nos 30 minutos que a SEFAZ dá, com justificativa de 15 a 255 letras, e só o gerente.
-- Primeira versão: ótica do Simples Nacional (CSOSN). O regime normal (CST com base de cálculo) vem depois.

-- ---------------------------------------------------------------------------
-- 1. Configuração fiscal da ótica e credenciais da Focus NFe
-- ---------------------------------------------------------------------------
alter table oticas
  add column regime_tributario   text not null default 'simples' check (regime_tributario in ('simples', 'simples_excesso', 'normal')),
  add column inscricao_estadual  text,
  add column nfce_ambiente       text not null default 'homologacao' check (nfce_ambiente in ('homologacao', 'producao')),
  add column nfce_serie          int not null default 1 check (nfce_serie between 1 and 999);
grant update (regime_tributario, inscricao_estadual, nfce_serie) on oticas to authenticated;
-- o ambiente (teste/produção) só a equipe do Vitral muda, junto com o token

-- token da Focus NFe por ótica e ambiente: ninguém lê a tabela; o servidor pega por credencial_nfce()
create table nfe_credenciais (
  otica_id           uuid primary key references oticas(id) on delete cascade,
  token_homologacao  text,
  token_producao     text,
  atualizado_em      timestamptz not null default now()
);
alter table nfe_credenciais enable row level security;
revoke all on nfe_credenciais from anon, authenticated;

create or replace function painel_definir_credenciais_nfce(p_otica uuid, p_ambiente text, p_token_homologacao text, p_token_producao text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin_vitral();
  if not exists (select 1 from oticas where id = p_otica) then
    raise exception 'Ótica não encontrada';
  end if;
  if p_ambiente not in ('homologacao', 'producao') then
    raise exception 'Ambiente inválido';
  end if;
  insert into nfe_credenciais (otica_id, token_homologacao, token_producao)
  values (p_otica, nullif(trim(p_token_homologacao), ''), nullif(trim(p_token_producao), ''))
  on conflict (otica_id) do update set
    token_homologacao = coalesce(nullif(trim(excluded.token_homologacao), ''), nfe_credenciais.token_homologacao),
    token_producao    = coalesce(nullif(trim(excluded.token_producao), ''), nfe_credenciais.token_producao),
    atualizado_em = now();
  update oticas set nfce_ambiente = p_ambiente where id = p_otica;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Notas emitidas
-- ---------------------------------------------------------------------------
create table notas_fiscais (
  id              uuid primary key default gen_random_uuid(),
  otica_id        uuid not null references oticas(id) on delete cascade,
  venda_id        uuid references vendas(id) on delete set null,
  modelo          text not null default 'nfce' check (modelo in ('nfce', 'nfe')),
  ambiente        text not null check (ambiente in ('homologacao', 'producao')),
  referencia      text not null unique,           -- "ref" enviado à Focus
  status          text not null default 'pendente' check (status in ('pendente', 'autorizada', 'rejeitada', 'cancelada')),
  valor           numeric(12,2) not null,
  numero          text,
  serie           text,
  chave           text,
  mensagem        text,                           -- motivo da rejeição ou do cancelamento
  caminho_xml     text,
  caminho_danfe   text,
  qrcode_url      text,
  autorizada_em   timestamptz,
  cancelada_em    timestamptz,
  justificativa   text,
  criado_por      uuid references usuarios(id) default auth.uid(),
  criado_em       timestamptz not null default now()
);
create index on notas_fiscais (otica_id, criado_em desc);
create index on notas_fiscais (venda_id);
-- uma venda tem no máximo uma nota viva (pendente ou autorizada)
create unique index notas_fiscais_uma_por_venda on notas_fiscais (venda_id) where status in ('pendente', 'autorizada');
alter table notas_fiscais enable row level security;
create policy notas_fiscais_ver on notas_fiscais for select to authenticated
  using (otica_id = (select minha_otica()) and (select acesso_algum(array['pdv', 'financeiro'], 'ver')));
revoke insert, update, delete on notas_fiscais from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Preparar, registrar e cancelar
-- ---------------------------------------------------------------------------
-- Devolve tudo o que o servidor precisa para chamar a Focus NFe (inclusive o token da ótica).
create or replace function preparar_nfce(p_venda uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_otica   uuid := minha_otica();
  o         oticas%rowtype;
  v         vendas%rowtype;
  v_token   text;
  v_nota    uuid;
  v_ref     text;
  v_faltam  text;
  v_itens   jsonb;
  v_pags    jsonb;
  v_cpf     text;
begin
  if v_otica is null or not acesso('pdv', 'criar') then
    raise exception 'Seu perfil não emite nota fiscal' using errcode = 'insufficient_privilege';
  end if;
  if not recurso_ativo('nota_fiscal') then
    raise exception 'A emissão de nota fiscal não está ativa para esta ótica';
  end if;
  select * into o from oticas where id = v_otica;
  if o.regime_tributario = 'normal' then
    raise exception 'Emissão pelo regime normal ainda não está disponível no Vitral (só Simples Nacional)';
  end if;
  if length(regexp_replace(coalesce(o.cnpj, ''), '\D', '', 'g')) <> 14 then
    raise exception 'Cadastre o CNPJ da ótica em Configurações';
  end if;
  select case when o.nfce_ambiente = 'producao' then token_producao else token_homologacao end into v_token
    from nfe_credenciais where otica_id = v_otica;
  if v_token is null then
    raise exception 'A emissão ainda não foi configurada para esta ótica (fale com o suporte do Vitral)';
  end if;

  select * into v from vendas where id = p_venda and otica_id = v_otica;
  if not found then
    raise exception 'Venda não encontrada';
  end if;
  if v.cancelada then
    raise exception 'Venda cancelada não tem nota';
  end if;
  if exists (select 1 from notas_fiscais where venda_id = v.id and status = 'autorizada') then
    raise exception 'Esta venda já tem nota fiscal';
  end if;
  -- nota que ficou sem resposta (queda de conexão): retoma com a MESMA referência, para a Focus
  -- devolver o que aconteceu com ela em vez de emitir outra
  select id, referencia into v_nota, v_ref from notas_fiscais where venda_id = v.id and status = 'pendente';
  -- todo produto precisa de NCM, origem e CSOSN
  select string_agg(vi.descricao, ', ') into v_faltam
  from venda_itens vi left join catalogo_itens c on c.id = vi.catalogo_item_id
  where vi.venda_id = v.id and (c.ncm is null or c.origem is null or c.csosn is null);
  if v_faltam is not null then
    raise exception 'Complete NCM, origem e CSOSN no cadastro de: %', v_faltam;
  end if;

  -- itens, com o desconto da venda rateado (o último item leva a sobra dos centavos)
  with base as (
    select vi.*, c.ncm, c.origem, c.csosn, coalesce(c.cfop, '5102') as cfop, c.unidade,
           coalesce(nullif(c.codigo, ''), left(c.id::text, 8)) as codigo_produto,
           vi.quantidade * vi.preco_unitario as bruto,
           -- ordem estável dos itens na nota: do mais caro para o mais barato, depois pelo nome
           row_number() over (order by vi.preco_unitario desc, vi.descricao, vi.id) as n, count(*) over () as total
    from venda_itens vi join catalogo_itens c on c.id = vi.catalogo_item_id
    where vi.venda_id = v.id
  ), rateio as (
    select b.*, case when v.subtotal > 0 then round(v.desconto * b.bruto / v.subtotal, 2) else 0 end as desc_bruto from base b
  ), final as (
    select r.*, case when r.n = r.total then v.desconto - coalesce(sum(r.desc_bruto) over (order by r.n rows between unbounded preceding and 1 preceding), 0)
                     else r.desc_bruto end as desconto_item
    from rateio r
  )
  select jsonb_agg(jsonb_build_object(
           'numero_item', n, 'codigo_produto', codigo_produto, 'descricao', left(descricao, 120), 'codigo_ncm', ncm,
           'cfop', cfop, 'unidade_comercial', unidade, 'unidade_tributavel', unidade,
           'quantidade_comercial', quantidade, 'quantidade_tributavel', quantidade,
           'valor_unitario_comercial', preco_unitario, 'valor_unitario_tributavel', preco_unitario,
           'valor_bruto', bruto, 'valor_desconto', desconto_item,
           'icms_origem', origem::text, 'icms_situacao_tributaria', csosn) order by n)
    into v_itens from final;

  -- formas de pagamento no código da NF-e: 01 dinheiro, 03 crédito, 04 débito, 05 crédito loja (crediário), 17 Pix
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_pags from (
    select jsonb_build_object('forma_pagamento', case p.forma when 'dinheiro' then '01' when 'credito' then '03' when 'debito' then '04' when 'pix' then '17' else '99' end,
                              'valor_pagamento', p.valor) ||
           case when p.forma in ('credito', 'debito') then jsonb_build_object('tipo_integracao', '2') else '{}'::jsonb end as x
    from pagamentos p where p.venda_id = v.id
    union all
    select jsonb_build_object('forma_pagamento', '05', 'valor_pagamento', sum(cr.valor)) from contas_receber cr where cr.venda_id = v.id having sum(cr.valor) > 0
  ) pg;

  select regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') into v_cpf from clientes c where c.id = v.cliente_id;

  if v_nota is null then
    v_ref := 'vitral-' || replace(gen_random_uuid()::text, '-', '');
    insert into notas_fiscais (otica_id, venda_id, ambiente, referencia, valor, serie)
    values (v_otica, v.id, o.nfce_ambiente, v_ref, v.total, o.nfce_serie::text)
    returning id into v_nota;
  end if;

  return jsonb_build_object(
    'nota_id', v_nota, 'referencia', v_ref, 'ambiente', o.nfce_ambiente, 'token', v_token,
    'retomada', exists (select 1 from notas_fiscais where id = v_nota and criado_em < now() - interval '1 second'),
    'dados', jsonb_build_object(
      'cnpj_emitente', regexp_replace(o.cnpj, '\D', '', 'g'),
      'natureza_operacao', 'VENDA AO CONSUMIDOR',
      'presenca_comprador', '1', 'modalidade_frete', '9', 'local_destino', '1',
      'serie', o.nfce_serie::text,
      'items', v_itens, 'formas_pagamento', v_pags)
      || case when length(v_cpf) = 11 then jsonb_build_object('cpf_destinatario', v_cpf) else '{}'::jsonb end);
end $$;

create or replace function registrar_retorno_nfce(p_nota uuid, p_retorno jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  n notas_fiscais%rowtype;
  v_status text := p_retorno ->> 'status';
begin
  select * into n from notas_fiscais where id = p_nota and otica_id = minha_otica();
  if not found then
    raise exception 'Nota não encontrada';
  end if;
  if n.status <> 'pendente' or not acesso('pdv', 'criar') then
    raise exception 'Esta nota não está aguardando retorno';
  end if;
  update notas_fiscais set
    status        = case when v_status = 'autorizado' then 'autorizada' else 'rejeitada' end,
    numero        = coalesce(p_retorno ->> 'numero', numero),
    serie         = coalesce(p_retorno ->> 'serie', serie),
    chave         = p_retorno ->> 'chave_nfe',
    mensagem      = left(coalesce(p_retorno ->> 'mensagem_sefaz', p_retorno ->> 'mensagem'), 500),
    caminho_xml   = p_retorno ->> 'caminho_xml_nota_fiscal',
    caminho_danfe = p_retorno ->> 'caminho_danfe',
    qrcode_url    = p_retorno ->> 'qrcode_url',
    autorizada_em = case when v_status = 'autorizado' then now() end
  where id = n.id;
  return case when v_status = 'autorizado' then 'autorizada' else 'rejeitada' end;
end $$;

-- confere se pode cancelar e devolve a referência e o token; o servidor chama a Focus e depois registrar_cancelamento_nfce()
create or replace function preparar_cancelamento_nfce(p_nota uuid, p_justificativa text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  n notas_fiscais%rowtype;
  v_token text;
begin
  if not acesso('pdv', 'editar') then
    raise exception 'Só o gerente cancela nota fiscal' using errcode = 'insufficient_privilege';
  end if;
  select * into n from notas_fiscais where id = p_nota and otica_id = minha_otica();
  if not found or n.status <> 'autorizada' then
    raise exception 'Só nota autorizada pode ser cancelada';
  end if;
  if n.autorizada_em < now() - interval '30 minutes' then
    raise exception 'O prazo de cancelamento da NFC-e (30 minutos) já passou. Fale com o contador sobre a devolução.';
  end if;
  if length(trim(coalesce(p_justificativa, ''))) not between 15 and 255 then
    raise exception 'A justificativa precisa ter de 15 a 255 letras';
  end if;
  select case when n.ambiente = 'producao' then token_producao else token_homologacao end into v_token
    from nfe_credenciais where otica_id = n.otica_id;
  return jsonb_build_object('referencia', n.referencia, 'ambiente', n.ambiente, 'token', v_token);
end $$;

create or replace function registrar_cancelamento_nfce(p_nota uuid, p_justificativa text, p_cancelado boolean, p_mensagem text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not acesso('pdv', 'editar') then
    raise exception 'Só o gerente cancela nota fiscal' using errcode = 'insufficient_privilege';
  end if;
  update notas_fiscais set
    status = case when p_cancelado then 'cancelada' else status end,
    cancelada_em = case when p_cancelado then now() end,
    justificativa = case when p_cancelado then left(trim(p_justificativa), 255) else justificativa end,
    mensagem = left(p_mensagem, 500)
  where id = p_nota and otica_id = minha_otica() and status = 'autorizada';
  return p_cancelado;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'painel_definir_credenciais_nfce(uuid, text, text, text)', 'preparar_nfce(uuid)', 'registrar_retorno_nfce(uuid, jsonb)',
    'preparar_cancelamento_nfce(uuid, text)', 'registrar_cancelamento_nfce(uuid, text, boolean, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
