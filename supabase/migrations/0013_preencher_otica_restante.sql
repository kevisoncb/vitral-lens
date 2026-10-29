-- Vitra — migração 0013: otica_id automático nas tabelas que faltavam
--
-- Achado pelos tipos gerados do banco: a tela "Horários e bloqueios" grava em horarios_trabalho
-- sem otica_id, e essa tabela não tinha o trigger preencher_otica() (0002). O cadastro de horários
-- falharia, e sem horários o agendamento online do site não abre.
-- Aproveita para ligar o mesmo trigger nas outras tabelas de configuração.
do $$
declare
  t text;
begin
  foreach t in array array['horarios_trabalho', 'lojas', 'perfis', 'motivos_perda', 'funil_etapas'] loop
    if not exists (select 1 from pg_trigger where tgrelid = t::regclass and tgname = 'preencher_otica') then
      execute format('create trigger preencher_otica before insert on %I for each row execute function preencher_otica()', t);
    end if;
  end loop;
end $$;
