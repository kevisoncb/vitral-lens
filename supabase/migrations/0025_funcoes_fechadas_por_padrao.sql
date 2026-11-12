-- Vitral — migração 0025: funções fechadas por padrão
--
-- No Postgres toda função nasce executável por PUBLIC (e o anon herda daí); no Supabase ainda há grant explícito
-- para anon. As migrações antigas faziam "revoke ... from anon", o que não basta quando PUBLIC continua liberado:
-- o teste de segurança (supabase/tests/seguranca_smoke.sql) achou registrar_pagamento, criar_os_do_atendimento,
-- concluir_exame e definir_foto_produto alcançáveis sem login (elas recusavam por dentro, mas não deviam abrir).
--
-- Aqui: (1) nenhuma função do schema public fica para PUBLIC ou anon; (2) quem o usuário logado já usava continua;
-- (3) o público (site da ótica, lista de espera do Vitral, assinatura da OS) só alcança a lista abaixo;
-- (4) função nova já nasce fechada para PUBLIC e anon.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as fn, has_function_privilege('authenticated', p.oid, 'execute') as logado
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')  -- não mexe em extensões
  loop
    execute format('revoke execute on function %s from public, anon', f.fn);
    if f.logado then
      execute format('grant execute on function %s to authenticated', f.fn);
    end if;
  end loop;
end $$;

-- o que o público alcança (todas security definer, com validação e limite de uso dentro)
grant execute on function site_da_otica(text) to anon;
grant execute on function pedido_orcamento_site(text, text, text, text, boolean) to anon;
grant execute on function horarios_livres(text, date) to anon;
grant execute on function agendar_pelo_site(text, timestamptz, text, text, boolean) to anon;
grant execute on function entrar_lista_espera(text, text, text, text, text, text, integer, boolean) to anon;
grant execute on function os_para_assinar(uuid) to anon;
grant execute on function assinar_os(uuid, text, text, text, text) to anon;

-- função nova: fechada para PUBLIC e anon (quem cria libera o que precisa)
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
