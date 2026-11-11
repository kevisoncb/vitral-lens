-- Testes de segurança gerais. Rodar DEPOIS dos outros testes (usa os dados e usuários que eles criaram).
-- Cada bloco imprime "nenhum" quando está tudo certo; qualquer outra coisa é um problema, com o nome do culpado.
--   1. regra das tabelas: RLS em todas; otica_id obrigatório nas de negócio; gravação direta só com otica_id garantido
--   2. o que o público alcança: funções e tabelas que o anon usa, contra a lista permitida
--   3. varredura entre óticas: cada usuário de cada ótica, em cada tabela, não vê nenhuma linha de outra ótica
--   4. função nova nasce fechada para o público
\set ON_ERROR_STOP off

-- tabelas globais (sem otica_id de propósito)
create temp table globais (nome text primary key);
insert into globais values ('oticas'), ('recursos_adicionais'), ('plano_recursos'), ('vitral_admins'), ('lista_espera');

-- 1. regra das tabelas
select 'tabelas sem RLS' as teste, coalesce(string_agg(relname, ',' order by relname), 'nenhum') as resultado
from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r', 'p') and not relrowsecurity;

select 'tabelas de negocio sem otica_id obrigatorio' as teste, coalesce(string_agg(c.relname, ',' order by c.relname), 'nenhum') as resultado
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and c.relname not in (select nome from globais)
  and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'otica_id' and a.attnotnull and not a.attisdropped);

-- quem grava direto (privilégio + política de insert) precisa do gatilho preencher_otica ou de otica_id = minha_otica() na política
select 'gravacao direta sem otica_id garantido' as teste, coalesce(string_agg(c.relname, ',' order by c.relname), 'nenhum') as resultado
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname not in (select nome from globais)
  and has_table_privilege('authenticated', c.oid, 'insert')
  and exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polcmd in ('a', '*'))
  and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'preencher_otica')
  and not exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polcmd in ('a', '*')
                  and pg_get_expr(p.polwithcheck, p.polrelid) like '%otica_id = ( SELECT minha_otica()%');

-- 2. o que o público alcança
select 'funcoes abertas ao publico fora da lista' as teste, coalesce(string_agg(p.oid::regprocedure::text, ', ' order by 1), 'nenhum') as resultado
from pg_proc p
where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  and p.proname not in ('site_da_otica', 'pedido_orcamento_site', 'horarios_livres', 'agendar_pelo_site',
                        'entrar_lista_espera', 'os_para_assinar', 'assinar_os');

select 'funcoes publicas sem security definer' as teste, coalesce(string_agg(p.proname, ',' order by 1), 'nenhum') as resultado
from pg_proc p
where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute') and not p.prosecdef
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

select 'tabelas que o publico mexe' as teste, coalesce(string_agg(c.relname, ',' order by c.relname), 'nenhum') as resultado
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p')
  and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
       or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'));

-- 3. varredura entre óticas
create temp table vazamentos (usuario text, tabela text, linhas bigint);
create temp table tabelas_otica as
  select c.relname::text as nome from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'otica_id' and not a.attisdropped);
create temp table usuarios_teste as select id, otica_id, email from usuarios where ativo;
grant all on vazamentos, tabelas_otica, usuarios_teste to authenticated;

do $$
declare
  u record;
  t text;
  n bigint;
begin
  for u in select * from usuarios_teste order by email loop
    perform set_config('request.jwt.claim.sub', u.id::text, true);
    set local role authenticated;
    for t in select nome from tabelas_otica order by nome loop
      begin
        execute format('select count(*) from %I where otica_id is distinct from %L', t, u.otica_id) into n;
      exception when insufficient_privilege then
        n := 0;  -- sem acesso à tabela: não vê nada
      end;
      if n > 0 then
        insert into vazamentos values (u.email, t, n);
      end if;
    end loop;
    reset role;
  end loop;
end $$;
select 'usuarios varridos' as teste, count(*) > 20 as ok, count(distinct otica_id) > 10 as varias_oticas from usuarios_teste;
select 'tabelas varridas' as teste, count(*) > 40 as ok from tabelas_otica;
select 'vazamentos entre oticas' as teste, coalesce(string_agg(usuario || ' ve ' || linhas || ' de outra otica em ' || tabela, '; '), 'nenhum') as resultado from vazamentos;

-- o anônimo não lê nenhuma tabela
create temp table vistas_anon (tabela text, linhas bigint);
grant all on vistas_anon to anon;
do $$
declare
  t text;
  n bigint;
begin
  set local role anon;
  for t in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1 loop
    begin
      execute format('select count(*) from %I', t) into n;
    exception when insufficient_privilege then
      n := 0;
    end;
    if n > 0 then
      insert into vistas_anon values (t, n);
    end if;
  end loop;
  reset role;
end $$;
select 'anonimo le' as teste, coalesce(string_agg(tabela || '=' || linhas, ','), 'nenhum') as resultado from vistas_anon;

-- 4. função nova nasce fechada para o público (e aberta para quem está logado, como no Supabase)
create function zz_funcao_nova() returns int language sql as 'select 1';
select 'funcao nova' as teste, has_function_privilege('anon', 'zz_funcao_nova()', 'execute') as publico,
       has_function_privilege('authenticated', 'zz_funcao_nova()', 'execute') as logado;
drop function zz_funcao_nova();
