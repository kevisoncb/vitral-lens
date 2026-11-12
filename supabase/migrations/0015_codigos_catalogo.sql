-- Vitral — migração 0015: código interno para etiqueta com código de barras
--
-- Produto sem código (armação cadastrada na venda, por exemplo) ganha um código interno da ótica:
-- "2" + 9 dígitos (a faixa que começa com 2 é de uso interno da loja, não colide com EAN de fábrica).
-- Só números e com quantidade par de dígitos: o código de barras sai curto e cabe na etiqueta.
create or replace function gerar_codigos_catalogo(p_itens uuid[] default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_otica uuid := minha_otica();
  it record;
  v_codigo text;
  n int := 0;
begin
  if v_otica is null or not acesso('catalogo', 'editar') then
    raise exception 'Seu perfil não pode alterar o catálogo' using errcode = 'insufficient_privilege';
  end if;
  for it in
    select id from catalogo_itens
    where otica_id = v_otica and (codigo is null or trim(codigo) = '')
      and (p_itens is null or id = any(p_itens))
    order by criado_em
  loop
    -- pula números que alguém já usou à mão
    loop
      v_codigo := '2' || lpad(proximo_numero(v_otica, 'codigo_produto')::text, 9, '0');
      exit when not exists (select 1 from catalogo_itens where otica_id = v_otica and codigo = v_codigo);
    end loop;
    update catalogo_itens set codigo = v_codigo where id = it.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function gerar_codigos_catalogo(uuid[]) from public, anon;
grant execute on function gerar_codigos_catalogo(uuid[]) to authenticated;
