-- Vitra — migração 0002: preenchimento automático da ótica, total do orçamento e pagamento (sinal e saldo)
--
-- 1. otica_id passa a ser preenchido pelo banco (minha_otica()) quando o app não informa.
--    A política de RLS continua exigindo que o otica_id seja o da ótica do usuário.
-- 2. valor_total do atendimento é recalculado a partir dos itens do orçamento.
-- 3. registrar_pagamento(): grava o pagamento; no primeiro pagamento o atendimento vira
--    "ganho" e a OS é criada no laboratório (uma só por atendimento).

-- ---------------------------------------------------------------------------
-- 1. otica_id automático
-- ---------------------------------------------------------------------------
create or replace function preencher_otica() returns trigger
language plpgsql as $$
begin
  if new.otica_id is null then
    new.otica_id := minha_otica();
  end if;
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes', 'anotacoes_cliente', 'receitas', 'receita_olhos', 'catalogo_itens',
    'atendimentos', 'atendimento_itens', 'ordens_servico', 'consultas',
    'bloqueios_agenda', 'pagamentos'
  ] loop
    execute format('create trigger preencher_otica before insert on %I for each row execute function preencher_otica()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Total do orçamento
-- ---------------------------------------------------------------------------
create or replace function recalcular_total_atendimento() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  alvo uuid := coalesce(new.atendimento_id, old.atendimento_id);
begin
  update atendimentos
     set valor_total = coalesce((select sum(quantidade * preco_unitario)
                                   from atendimento_itens where atendimento_id = alvo), 0)
   where id = alvo;
  return null;
end $$;

create trigger recalcular_total after insert or update or delete on atendimento_itens
  for each row execute function recalcular_total_atendimento();

-- ---------------------------------------------------------------------------
-- 3. Pagamento (sinal e saldo)
-- ---------------------------------------------------------------------------
-- Retorna o id da OS (nova ou já existente). Quem tem "vendas: editar" pode registrar,
-- mesmo sem acesso ao laboratório.
create or replace function registrar_pagamento(
  p_atendimento    uuid,
  p_valor          numeric,
  p_forma          text,
  p_parcelas       smallint default 1,
  p_sinal          boolean default false,
  p_data_prometida date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a        atendimentos%rowtype;
  ganha    uuid;
  os_id    uuid;
begin
  if not acesso('vendas', 'editar') then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor maior que zero';
  end if;

  select * into a from atendimentos where id = p_atendimento and otica_id = minha_otica();
  if not found then
    raise exception 'Atendimento não encontrado';
  end if;

  insert into pagamentos (otica_id, atendimento_id, forma, valor, parcelas, sinal, registrado_por)
  values (a.otica_id, a.id, p_forma, p_valor, coalesce(p_parcelas, 1), p_sinal, auth.uid());

  -- primeiro pagamento: o atendimento vira ganho
  select id into ganha from funil_etapas
   where otica_id = a.otica_id and tipo = 'ganha' order by ordem limit 1;
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

grant execute on function registrar_pagamento(uuid, numeric, text, smallint, boolean, date) to authenticated;
