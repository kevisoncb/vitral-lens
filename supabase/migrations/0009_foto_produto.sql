-- Vitra — migração 0009: quem cadastrou o produto na venda pode pôr a primeira foto
-- (o balcão cria produto, mas não edita o catálogo).
create or replace function definir_foto_produto(p_item uuid, p_caminho text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  it catalogo_itens%rowtype;
begin
  select * into it from catalogo_itens where id = p_item and otica_id = minha_otica();
  if not found then
    raise exception 'Produto não encontrado';
  end if;
  if not (acesso('catalogo', 'editar') or (it.criado_por = auth.uid() and it.foto_path is null)) then
    raise exception 'Seu perfil não pode trocar a foto deste produto' using errcode = 'insufficient_privilege';
  end if;
  if p_caminho is null or split_part(p_caminho, '/', 1) <> it.otica_id::text then
    raise exception 'Caminho da foto inválido';
  end if;
  update catalogo_itens set foto_path = p_caminho where id = p_item;
  return true;
end $$;
grant execute on function definir_foto_produto(uuid, text) to authenticated;
revoke execute on function definir_foto_produto(uuid, text) from anon;
