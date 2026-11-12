-- Vitral — migração 0026: o orçamento trava no primeiro pagamento
--
-- O card que vem do consultório ou do site chega sem itens: a loja monta o orçamento na tela do atendimento
-- (/vendas/[id]). No primeiro pagamento o estoque baixa, a comissão é calculada e a OS nasce a partir desses
-- itens; por isso, depois de pago, o orçamento não muda mais (nem por tela, nem direto no banco).

create or replace function orcamento_sem_pagamento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from pagamentos where atendimento_id = coalesce(new.atendimento_id, old.atendimento_id)) then
    raise exception 'O orçamento já tem pagamento e não muda mais. Para trocar, faça um atendimento novo.'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function orcamento_sem_pagamento() from public, anon, authenticated;

create trigger orcamento_sem_pagamento before insert or update or delete on atendimento_itens
  for each row execute function orcamento_sem_pagamento();
