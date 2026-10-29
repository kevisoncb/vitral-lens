-- Vitral — migração 0008: desempenho para muitas óticas e muitos usuários ao mesmo tempo
--
-- 1. Regras de segurança (RLS) mais rápidas: funções como minha_otica() e acesso() passam a
--    ser calculadas UMA vez por consulta, e não uma vez por linha. Recomendação oficial do
--    Supabase: envolver a chamada em (select ...).
-- 2. Índices que faltavam para as telas e relatórios.
-- 3. Busca de cliente por pedaço do nome (trigram).

-- ---------------------------------------------------------------------------
-- 1. RLS: (select minha_otica()) e (select acesso(...))
-- ---------------------------------------------------------------------------
do $$
declare
  p record;
  novo_using text;
  novo_check text;
  embrulhar constant text := '((?<!select )(minha_otica|minha_area|acesso_algum|acesso|auth\.uid)\([^()]*\))';
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies where schemaname = 'public'
  loop
    novo_using := regexp_replace(p.qual,       embrulhar, '(select \1)', 'g');
    novo_check := regexp_replace(p.with_check, embrulhar, '(select \1)', 'g');
    if novo_using is distinct from p.qual or novo_check is distinct from p.with_check then
      execute format('alter policy %I on %I.%I%s%s', p.policyname, p.schemaname, p.tablename,
        case when novo_using is not null then format(' using (%s)', novo_using) else '' end,
        case when novo_check is not null then format(' with check (%s)', novo_check) else '' end);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Índices
-- ---------------------------------------------------------------------------
create index if not exists pagamentos_atendimento_idx      on pagamentos (atendimento_id);
create index if not exists pagamentos_otica_pago_idx       on pagamentos (otica_id, pago_em);
create index if not exists os_atendimento_idx              on ordens_servico (atendimento_id);
create index if not exists os_otica_prometida_idx          on ordens_servico (otica_id, data_prometida);
create index if not exists os_historico_os_idx             on os_historico (os_id);
create index if not exists atendimentos_otica_criado_idx   on atendimentos (otica_id, criado_em);
create index if not exists consultas_loja_inicio_idx       on consultas (loja_id, inicio);
create index if not exists horarios_loja_idx               on horarios_trabalho (loja_id, dia_semana);
create index if not exists bloqueios_loja_inicio_idx       on bloqueios_agenda (loja_id, inicio);
create index if not exists usuarios_perfil_idx             on usuarios (perfil_id);
create index if not exists receitas_exame_idx              on receitas (exame_id);
create index if not exists exames_otica_status_idx         on exames (otica_id, status, criado_em);
create index if not exists exame_olhos_exame_idx           on exame_olhos (exame_id);

-- ---------------------------------------------------------------------------
-- 3. Busca de cliente por pedaço do nome ("silva", "ana pa")
-- ---------------------------------------------------------------------------
create extension if not exists pg_trgm;
create index if not exists clientes_nome_trgm_idx on clientes using gin (nome gin_trgm_ops);
