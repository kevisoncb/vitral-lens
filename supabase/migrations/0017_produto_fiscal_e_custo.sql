-- Vitral — migração 0017: impostos e formação de custo no cadastro do produto
--
-- 1. Dados fiscais do produto (usados na emissão da nota fiscal): NCM, CEST, origem, CFOP, CSOSN
--    (Simples Nacional) ou CST do ICMS (regime normal), alíquota de ICMS, unidade e a classificação
--    tributária do IBS/CBS (cClassTrib), que a reforma tributária passa a pedir. Tudo opcional: o gerente
--    preenche aos poucos; a entrada pela nota já traz NCM, CEST e origem.
-- 2. Custo em partes: compra (preço da nota) + insumos (frete, seguro, embalagem, outras despesas)
--    + impostos pagos na compra (IPI, ICMS-ST) = custo final, base do preço de venda.

alter table catalogo_itens
  add column ncm             text check (ncm ~ '^\d{8}$'),
  add column cest            text check (cest ~ '^\d{7}$'),
  add column origem          smallint check (origem between 0 and 8),
  add column cfop            text check (cfop ~ '^\d{4}$'),
  add column csosn           text check (csosn ~ '^\d{3}$'),
  add column cst_icms        text check (cst_icms ~ '^\d{2}$'),
  add column aliquota_icms   numeric(5,2) check (aliquota_icms between 0 and 100),
  add column cclass_trib     text check (cclass_trib ~ '^\d{6}$'),
  add column unidade         text not null default 'UN' check (unidade ~ '^[A-Z0-9]{1,6}$'),
  add column custo_insumos   numeric(12,2) not null default 0,
  add column custo_impostos  numeric(12,2) not null default 0 check (custo_impostos >= 0),
  add column custo_final     numeric(12,2) generated always as (coalesce(custo, 0) + custo_insumos + custo_impostos) stored;

-- Entrada pela nota, agora com os dados fiscais e o custo em partes.
-- Itens: {"codigo", "nome", "categoria", "quantidade", "custo", "preco_venda",
--         "insumos", "impostos", "ncm", "cest", "origem", "unidade"}
-- Produto que já existe: atualiza o custo (compra, insumos, impostos) e só PREENCHE o fiscal que estiver
-- vazio; o que o gerente já corrigiu no cadastro não é sobrescrito pela nota.
create or replace function registrar_entrada_nfe(
  p_nota jsonb, p_loja uuid, p_itens jsonb, p_duplicatas jsonb, p_categoria_custo uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_otica    uuid := minha_otica();
  v_loja     uuid;
  v_nota     uuid;
  v_chave    text := nullif(trim(coalesce(p_nota ->> 'chave', '')), '');
  v_numero   text := left(trim(coalesce(p_nota ->> 'numero', '')), 20);
  v_forn     text := left(trim(coalesce(p_nota ->> 'fornecedor', '')), 120);
  it         record;
  v_item     uuid;
  v_novos    int := 0;
  v_unidades int := 0;
  v_contas   int := 0;
  d          record;
  v_total_d  int;
  v_quando   timestamptz;
begin
  if v_otica is null or not acesso('estoque', 'criar') then
    raise exception 'Seu perfil não pode dar entrada no estoque' using errcode = 'insufficient_privilege';
  end if;
  if v_numero = '' or v_forn = '' then
    raise exception 'A nota precisa de número e fornecedor';
  end if;
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A nota não tem produtos';
  end if;
  if jsonb_array_length(p_itens) > 500 then
    raise exception 'Nota com produtos demais (máximo 500)';
  end if;
  if v_chave is not null then
    select criado_em into v_quando from notas_entrada where otica_id = v_otica and chave = v_chave;
    if found then
      raise exception 'Esta nota já foi lançada em %', to_char(v_quando at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
    end if;
  end if;
  if p_categoria_custo is not null and not exists (select 1 from categorias_custo where id = p_categoria_custo and otica_id = v_otica) then
    raise exception 'Categoria de custo não encontrada';
  end if;
  v_loja := loja_ou_primeira(v_otica, p_loja);

  insert into notas_entrada (otica_id, loja_id, chave, numero, fornecedor, cnpj, emissao, valor_total, itens, unidades)
  values (v_otica, v_loja, v_chave, v_numero, v_forn, nullif(left(trim(coalesce(p_nota ->> 'cnpj', '')), 18), ''),
          nullif(p_nota ->> 'emissao', '')::date, nullif(p_nota ->> 'valor_total', '')::numeric, jsonb_array_length(p_itens), 0)
  returning id into v_nota;

  for it in
    select left(trim(coalesce(e ->> 'codigo', '')), 40) as codigo, left(trim(coalesce(e ->> 'nome', '')), 160) as nome,
           coalesce(e ->> 'categoria', 'acessorio') as categoria, round((e ->> 'quantidade')::numeric)::int as quantidade,
           round((e ->> 'custo')::numeric, 2) as custo, round(nullif(e ->> 'preco_venda', '')::numeric, 2) as preco_venda,
           round(coalesce(nullif(e ->> 'insumos', '')::numeric, 0), 2) as insumos,
           round(coalesce(nullif(e ->> 'impostos', '')::numeric, 0), 2) as impostos,
           nullif(regexp_replace(coalesce(e ->> 'ncm', ''), '\D', '', 'g'), '') as ncm,
           nullif(regexp_replace(coalesce(e ->> 'cest', ''), '\D', '', 'g'), '') as cest,
           nullif(e ->> 'origem', '')::smallint as origem,
           nullif(upper(regexp_replace(coalesce(e ->> 'unidade', ''), '[^A-Za-z0-9]', '', 'g')), '') as unidade
    from jsonb_array_elements(p_itens) e
  loop
    if it.quantidade is null or it.quantidade <= 0 then
      raise exception 'Quantidade inválida em "%"', it.nome;
    end if;
    if it.custo is null or it.custo < 0 or it.impostos < 0 or it.custo + it.insumos < 0 then
      raise exception 'Custo inválido em "%"', it.nome;
    end if;
    if it.categoria not in ('lente', 'tratamento', 'armacao', 'lente_contato', 'acessorio') then
      raise exception 'Categoria inválida em "%"', it.nome;
    end if;

    v_item := null;
    if it.codigo <> '' then
      select id into v_item from catalogo_itens where otica_id = v_otica and codigo = it.codigo;
    end if;
    if v_item is null then
      if not acesso('catalogo', 'criar') then
        raise exception 'Seu perfil não pode cadastrar produtos novos ("%")', it.nome;
      end if;
      if length(it.nome) < 2 or it.preco_venda is null or it.preco_venda < 0 then
        raise exception 'Informe o preço de venda do produto novo "%"', it.nome;
      end if;
      insert into catalogo_itens (otica_id, categoria, nome, preco, codigo, custo, custo_insumos, custo_impostos,
                                  ncm, cest, origem, unidade, controla_estoque, criado_por)
      values (v_otica, it.categoria, it.nome, it.preco_venda, nullif(it.codigo, ''), it.custo, it.insumos, it.impostos,
              case when it.ncm ~ '^\d{8}$' then it.ncm end, case when it.cest ~ '^\d{7}$' then it.cest end,
              case when it.origem between 0 and 8 then it.origem end,
              case when it.unidade ~ '^[A-Z0-9]{1,6}$' then it.unidade else 'UN' end, true, auth.uid())
      returning id into v_item;
      v_novos := v_novos + 1;
    else
      update catalogo_itens set
        custo = it.custo, custo_insumos = it.insumos, custo_impostos = it.impostos,
        ncm    = coalesce(ncm,    case when it.ncm ~ '^\d{8}$' then it.ncm end),
        cest   = coalesce(cest,   case when it.cest ~ '^\d{7}$' then it.cest end),
        origem = coalesce(origem, case when it.origem between 0 and 8 then it.origem end)
      where id = v_item;
    end if;

    -- o custo do movimento é o custo final da unidade (compra + insumos + impostos)
    insert into estoque_movimentos (otica_id, loja_id, item_id, tipo, quantidade, custo_unitario, motivo, nota_id)
    values (v_otica, v_loja, v_item, 'entrada', it.quantidade, it.custo + it.insumos + it.impostos,
            left('NF ' || v_numero || ' · ' || v_forn, 300), v_nota);
    v_unidades := v_unidades + it.quantidade;
  end loop;
  update notas_entrada set unidades = v_unidades where id = v_nota;

  if jsonb_typeof(p_duplicatas) = 'array' and jsonb_array_length(p_duplicatas) > 0 and acesso('financeiro', 'criar') then
    v_total_d := jsonb_array_length(p_duplicatas);
    for d in
      select (x.e ->> 'vencimento')::date as vencimento, round((x.e ->> 'valor')::numeric, 2) as valor, x.n
      from jsonb_array_elements(p_duplicatas) with ordinality as x(e, n)
    loop
      if d.valor is null or d.valor <= 0 or d.vencimento is null then
        raise exception 'Parcela % da nota com valor ou vencimento inválido', d.n;
      end if;
      insert into contas_pagar (otica_id, loja_id, categoria_id, descricao, valor, vencimento, fornecedor, nota_id)
      values (v_otica, v_loja, p_categoria_custo,
              'NF ' || v_numero || case when v_total_d > 1 then ' (' || d.n || '/' || v_total_d || ')' else '' end,
              d.valor, d.vencimento, v_forn, v_nota);
      v_contas := v_contas + 1;
    end loop;
  end if;

  return jsonb_build_object('nota_id', v_nota, 'produtos_novos', v_novos, 'unidades', v_unidades, 'contas', v_contas,
                            'contas_sem_permissao', jsonb_typeof(p_duplicatas) = 'array' and jsonb_array_length(p_duplicatas) > 0 and v_contas = 0);
end $$;
