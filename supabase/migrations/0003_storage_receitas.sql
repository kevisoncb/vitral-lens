-- Vitra — migração 0003: pasta privada para foto/PDF da receita (dado de saúde, LGPD).
-- Caminho do arquivo: <otica_id>/<receita_id>/<arquivo>. Só quem tem acesso a receitas da
-- própria ótica lê ou grava. Só roda no Supabase (no Postgres puro dos testes não há schema storage).
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'schema storage ausente: pulando (ambiente de teste)';
    return;
  end if;

  insert into storage.buckets (id, name, public) values ('receitas', 'receitas', false)
  on conflict (id) do nothing;

  execute $p$create policy receitas_arquivos_ver on storage.objects for select to authenticated
    using (bucket_id = 'receitas' and (storage.foldername(name))[1] = minha_otica()::text and acesso('receitas', 'ver'))$p$;
  execute $p$create policy receitas_arquivos_criar on storage.objects for insert to authenticated
    with check (bucket_id = 'receitas' and (storage.foldername(name))[1] = minha_otica()::text and acesso('receitas', 'criar'))$p$;
  execute $p$create policy receitas_arquivos_excluir on storage.objects for delete to authenticated
    using (bucket_id = 'receitas' and (storage.foldername(name))[1] = minha_otica()::text and acesso('receitas', 'excluir'))$p$;
end $$;
