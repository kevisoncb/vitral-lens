-- Vitral — migração 0016: entrada de mercadoria pelo XML da NF-e do fornecedor
--
-- A tela lê o XML no navegador (src/lib/nfe.ts), mostra os itens e manda para registrar_entrada_nfe(),
-- que numa transação só:
--   1. cadastra no catálogo o que não existe (o código é o EAN da nota ou o código do fornecedor);
--   2. dá entrada no estoque com o custo de cada item;
--   3. lança as parcelas (duplicatas) em contas a pagar, para quem tem financeiro:criar;
--   4. guarda a nota em notas_entrada: a mesma chave não entra duas vezes.

create table notas_entrada (
  id           uuid primary key default gen_random_uuid(),
  otica_id     uuid not null references oticas(id) on delete cascade,
  loja_id      uuid references lojas(id) on delete set null,
  chave        text check (chave ~ '^\d{44}$'),
  numero       text not null,
  fornecedor   text not null,
  cnpj         text,
  emissao      date,
  valor_total  numeric(12,2),
  itens        int not null,
  unidades     int not null,
  usuario_id   uuid references usuarios(id) default auth.uid(),
  criado_em    timestamptz not null default now()
);
create unique index notas_entrada_chave on notas_entrada (otica_id, chave) where chave is not null;
create index on notas_entrada (otica_id, criado_em desc);
alter table notas_entrada enable row level security;
create policy notas_entrada_ver on notas_entrada for select to authenticated
  using (otica_id = (select minha_otica()) and (select acesso('estoque', 'ver')));
revoke insert, update, delete on notas_entrada from anon, authenticated;

alter table estoque_movimentos add column nota_id uuid references notas_entrada(id) on delete set null;
alter table contas_pagar add column nota_id uuid references notas_entrada(id) on delete set null;

-- p_nota:       {"chave": "...", "numero": "8812", "fornecedor": "...", "cnpj": "...", "emissao": "2026-11-03", "valor_total": 1254.80}
-- p_itens:      [{"codigo": "789...", "nome": "...", "categoria": "armacao", "quantidade": 3, "custo": 150, "preco_venda": 450}]
-- p_duplicatas: [{"numero": "001", "vencimento": "2026-12-03", "valor": 418.27}]
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
           round((e ->> 'custo')::numeric, 2) as custo, round(nullif(e ->> 'preco_venda', '')::numeric, 2) as preco_venda
    from jsonb_array_elements(p_itens) e
  loop
    if it.quantidade is null or it.quantidade <= 0 then
      raise exception 'Quantidade inválida em "%"', it.nome;
    end if;
    if it.custo is null or it.custo < 0 then
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
      insert into catalogo_itens (otica_id, categoria, nome, preco, codigo, custo, controla_estoque, criado_por)
      values (v_otica, it.categoria, it.nome, it.preco_venda, nullif(it.codigo, ''), it.custo, true, auth.uid())
      returning id into v_item;
      v_novos := v_novos + 1;
    else
      update catalogo_itens set custo = it.custo where id = v_item;
    end if;

    insert into estoque_movimentos (otica_id, loja_id, item_id, tipo, quantidade, custo_unitario, motivo, nota_id)
    values (v_otica, v_loja, v_item, 'entrada', it.quantidade, it.custo, left('NF ' || v_numero || ' · ' || v_forn, 300), v_nota);
    v_unidades := v_unidades + it.quantidade;
  end loop;
  update notas_entrada set unidades = v_unidades where id = v_nota;

  -- parcelas a pagar: só para quem lança no financeiro (sem isso, a entrada vale e as contas ficam de fora)
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
revoke execute on function registrar_entrada_nfe(jsonb, uuid, jsonb, jsonb, uuid) from public, anon;
grant execute on function registrar_entrada_nfe(jsonb, uuid, jsonb, jsonb, uuid) to authenticated;
