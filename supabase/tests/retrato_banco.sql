-- Retrato do banco para comparar o original com o restaurado (supabase/tests/backup_teste.sh):
-- dados de cada tabela (contagem + md5), logins, RLS, políticas, gatilhos, funções e permissões, restrições, índices.
\pset tuples_only on
\pset format unaligned
do $$ declare t text; r text; begin
  create temp table retrato (k text);
  for t in select tablename from pg_tables where schemaname = 'public' order by 1 loop
    execute format('select %L || '' '' || count(*) || '' '' || coalesce(md5(string_agg(x::text, ''|'' order by x::text)), ''-'') from %I x', t, t) into r;
    insert into retrato values ('tabela ' || r);
  end loop;
end $$;
select * from retrato order by 1;
select 'auth ' || (select count(*) from auth.users) || ' ' || (select count(*) from auth.identities);
select 'rls ' || relname || ' ' || relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname;
select 'politica ' || tablename || ' ' || policyname || ' ' || md5(coalesce(qual,'') || coalesce(with_check,'')) from pg_policies where schemaname = 'public' order by 1;
select 'gatilho ' || event_object_table || ' ' || trigger_name || ' ' || event_manipulation from information_schema.triggers where trigger_schema = 'public' order by 1;
select 'funcao ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') anon=' || has_function_privilege('anon', p.oid, 'execute') || ' auth=' || has_function_privilege('authenticated', p.oid, 'execute') || ' definer=' || p.prosecdef
  from pg_proc p where p.pronamespace = 'public'::regnamespace and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') order by 1;
select 'tabela_priv ' || c.relname || ' anon=' || has_table_privilege('anon', c.oid, 'select') || ' auth=' || has_table_privilege('authenticated', c.oid, 'insert') from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','v') order by 1;
select 'restricao ' || conrelid::regclass || ' ' || conname from pg_constraint where connamespace = 'public'::regnamespace order by 1;
select 'indice ' || indexname from pg_indexes where schemaname = 'public' order by 1;
select 'seq ' || sequencename || ' ' || coalesce(last_value::text,'-') from pg_sequences where schemaname = 'public' order by 1;
