-- Usado por restaurar.sh entre a criação dos objetos e as permissões do backup.
-- Deixa cada tabela, sequência e função do schema public no estado "padrão do Postgres"
-- (só o dono; funções executáveis por PUBLIC), que é a base de onde o pg_dump escreve as permissões.
-- Assim o que o projeto novo concedeu sozinho (default privileges do Supabase) não sobra.
do $$
declare
  o record;
  g text;
begin
  for o in
    select c.oid, format('%I.%I', n.nspname, c.relname) as nome,
           case c.relkind when 'S' then 'sequence' else 'table' end as tipo, c.relacl as acl, c.relowner as dono
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
  loop
    for g in select distinct case when a.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(a.grantee)) end
             from aclexplode(o.acl) a where a.grantee <> o.dono loop
      execute format('revoke all on %s %s from %s', o.tipo, o.nome, g);
    end loop;
  end loop;

  for o in
    select p.oid::regprocedure::text as nome, p.proacl as acl, p.proowner as dono, p.prokind
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') -- não mexe em extensões
  loop
    for g in select distinct case when a.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(a.grantee)) end
             from aclexplode(o.acl) a where a.grantee <> o.dono loop
      execute format('revoke all on %s %s from %s', case when o.prokind = 'p' then 'procedure' else 'function' end, o.nome, g);
    end loop;
    execute format('grant execute on %s %s to public', case when o.prokind = 'p' then 'procedure' else 'function' end, o.nome);
  end loop;
end $$;
