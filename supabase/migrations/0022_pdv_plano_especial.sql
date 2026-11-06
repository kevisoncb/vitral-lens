-- Vitral — migração 0022: PDV e caixa só no Plano Especial
--
-- O PDV (abrir caixa, venda rápida, sangria, suprimento, fechamento) é do Plano Especial, contratado à parte
-- (adicional "plano_especial" em otica_adicionais, ligado pela equipe do Vitral no painel).
-- O nome não é "pdv" de propósito: acesso() desliga o módulo inteiro quando o adicional tem o nome do
-- módulo, e aí nem fechar o caixa daria. Aqui a trava é só em abrir caixa e gravar venda.
-- Sem ele, o banco não abre caixa nem grava venda do PDV. Fechar caixa, cancelar venda e ver o histórico
-- continuam liberados: se o plano mudar com um caixa aberto, o dinheiro da gaveta nunca fica preso.
-- O funil da loja (orçamento, sinal e saldo) não usa o PDV e segue no plano único.

insert into recursos_adicionais (recurso, nome) values ('plano_especial', 'Plano Especial: PDV e caixa')
on conflict (recurso) do update set nome = excluded.nome;

create or replace function exige_plano_especial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- confere pela ótica da linha (não pela sessão): vale para qualquer caminho que grave aqui
  if not exists (select 1 from otica_adicionais where otica_id = new.otica_id and recurso = 'plano_especial') then
    raise exception 'O PDV e o caixa fazem parte do Plano Especial. Fale com o suporte do Vitral para contratar.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke execute on function exige_plano_especial() from public, anon, authenticated;

create trigger exige_plano_especial before insert on caixas for each row execute function exige_plano_especial();
create trigger exige_plano_especial before insert on vendas for each row execute function exige_plano_especial();
