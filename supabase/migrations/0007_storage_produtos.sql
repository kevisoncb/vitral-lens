-- Vitra — migração 0007: fotos dos produtos (armações) no Storage.
-- Pasta pública "produtos" (foto de armação não é dado sensível e pode ir para o site depois).
-- Caminho: <otica_id>/<item_id>/<arquivo>. Só quem cria/edita catálogo da própria ótica grava.
-- Só roda no Supabase (no Postgres puro dos testes não há schema storage).
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'schema storage ausente: pulando (ambiente de teste)';
    return;
  end if;

  insert into storage.buckets (id, name, public) values ('produtos', 'produtos', true)
  on conflict (id) do nothing;

  execute $p$create policy produtos_arquivos_criar on storage.objects for insert to authenticated
    with check (bucket_id = 'produtos' and (storage.foldername(name))[1] = minha_otica()::text
                and (acesso('catalogo', 'criar') or acesso('catalogo', 'editar')))$p$;
  execute $p$create policy produtos_arquivos_trocar on storage.objects for update to authenticated
    using (bucket_id = 'produtos' and (storage.foldername(name))[1] = minha_otica()::text and acesso('catalogo', 'editar'))$p$;
  execute $p$create policy produtos_arquivos_excluir on storage.objects for delete to authenticated
    using (bucket_id = 'produtos' and (storage.foldername(name))[1] = minha_otica()::text and acesso('catalogo', 'excluir'))$p$;
end $$;
