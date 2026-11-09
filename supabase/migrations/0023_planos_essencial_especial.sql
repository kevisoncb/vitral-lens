-- Vitral — migração 0023: dois planos
--
--   Essencial (R$ 99/mês): consultório, loja, laboratório, agenda, clientes, estoque, site.
--   Especial  (R$ 199/mês): tudo do Essencial + PDV e caixa + notas fiscais (NFC-e no caixa e entrada pela nota).
--   Loja extra: + R$ 49/mês cada. Notas fiscais avulsas (para quem fica no Essencial): preço a definir.
--
-- O Especial é o adicional "plano_especial" (0022), que agora inclui "nota_fiscal": recurso_ativo('nota_fiscal')
-- vale para quem tem o avulso ou o Especial. Os preços ficam aqui para o painel do Vitral somar a receita.

alter table recursos_adicionais
  add column inclui       text[] not null default '{}',   -- outros recursos que este libera junto
  add column preco_mensal numeric(10,2),                  -- por unidade (ex.: cada loja extra); null = a definir
  add column ordem        int not null default 100;

update recursos_adicionais set nome = 'Plano Especial: PDV, caixa e notas fiscais', inclui = '{nota_fiscal}', preco_mensal = 100, ordem = 1
 where recurso = 'plano_especial';
update recursos_adicionais set nome = 'Notas fiscais avulsas (NFC-e e entrada pela nota)', preco_mensal = null, ordem = 2
 where recurso = 'nota_fiscal';
update recursos_adicionais set nome = 'Lojas extras', preco_mensal = 49, ordem = 3
 where recurso = 'multiloja';

-- o que não é adicional vem no plano; o adicional vale se a ótica tem ele ou um plano que o inclui
create or replace function recurso_ativo(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from recursos_adicionais where recurso = r) then true
    else exists (
      select 1 from otica_adicionais a join recursos_adicionais ra on ra.recurso = a.recurso
      where a.otica_id = minha_otica() and (a.recurso = r or r = any (ra.inclui))
    )
  end
$$;
