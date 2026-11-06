-- Vitral — migração 0020: direitos do cliente na LGPD
--
-- 1. Registro de acesso (acessos_dados_cliente): quem viu a receita ou o exame (dado de saúde), quem
--    exportou e quem anonimizou. Só se acrescenta; ninguém altera nem apaga. O dono vê na ficha do cliente.
-- 2. Exportar (exportar_cliente): tudo o que a ótica tem do cliente num JSON, para entregar a ele.
-- 3. Anonimizar (anonimizar_cliente): o cliente pediu para ser esquecido. Some o que identifica a pessoa
--    (nome, telefone, e-mail, CPF, nascimento, endereço, anotações); receita, exame e vendas ficam, sem nome,
--    porque prontuário e documentos fiscais têm prazo legal de guarda. Não tem volta.
-- Exportar e anonimizar exigem clientes:excluir (dono e gerente).

alter table clientes add column anonimizado_em timestamptz;
create index if not exists auditoria_registro on auditoria (otica_id, tabela, registro_id);

create table acessos_dados_cliente (
  id          uuid primary key default gen_random_uuid(),
  otica_id    uuid not null references oticas(id) on delete cascade,
  cliente_id  uuid not null references clientes(id) on delete cascade,
  usuario_id  uuid references usuarios(id) on delete set null,
  acao        text not null check (acao in ('viu_receita', 'viu_exame', 'exportou', 'anonimizou')),
  origem      text,
  criado_em   timestamptz not null default now()
);
create index on acessos_dados_cliente (otica_id, cliente_id, criado_em desc);
alter table acessos_dados_cliente enable row level security;
create policy acessos_dados_cliente_ver on acessos_dados_cliente for select to authenticated
  using (otica_id = (select minha_otica()) and (select acesso('clientes', 'excluir')));
revoke insert, update, delete on acessos_dados_cliente from anon, authenticated;
revoke all on acessos_dados_cliente from anon;

-- A tela chama ao mostrar receita ou exame. Repetido pela mesma pessoa em 10 minutos não grava de novo.
create or replace function registrar_acesso_saude(p_cliente uuid, p_acao text, p_origem text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_otica uuid := minha_otica();
begin
  if p_acao not in ('viu_receita', 'viu_exame') then
    raise exception 'Ação inválida';
  end if;
  if v_otica is null or not exists (select 1 from clientes where id = p_cliente and otica_id = v_otica) then
    return; -- cliente de outra ótica: nada a registrar (e nada a mostrar)
  end if;
  if exists (select 1 from acessos_dados_cliente
             where cliente_id = p_cliente and usuario_id = auth.uid() and acao = p_acao
               and criado_em > now() - interval '10 minutes') then
    return;
  end if;
  insert into acessos_dados_cliente (otica_id, cliente_id, usuario_id, acao, origem)
  values (v_otica, p_cliente, auth.uid(), p_acao, left(p_origem, 60));
end $$;
revoke execute on function registrar_acesso_saude(uuid, text, text) from public, anon;
grant execute on function registrar_acesso_saude(uuid, text, text) to authenticated;

create or replace function exportar_cliente(p_cliente uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_otica uuid := minha_otica();
  v_dados jsonb;
begin
  if v_otica is null or not acesso('clientes', 'excluir') then
    raise exception 'Só o dono ou o gerente exporta os dados do cliente' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from clientes where id = p_cliente and otica_id = v_otica) then
    raise exception 'Cliente não encontrado';
  end if;

  select jsonb_build_object(
    'gerado_em', now(),
    'otica', (select nome from oticas where id = v_otica),
    'cliente', (select to_jsonb(c) - 'otica_id' from clientes c where c.id = p_cliente),
    'anotacoes', coalesce((select jsonb_agg(to_jsonb(a) - 'otica_id' order by a.criado_em) from anotacoes_cliente a where a.cliente_id = p_cliente), '[]'),
    'receitas', coalesce((select jsonb_agg((to_jsonb(r) - 'otica_id') || jsonb_build_object('olhos',
                  coalesce((select jsonb_agg(to_jsonb(o) - 'otica_id') from receita_olhos o where o.receita_id = r.id), '[]')) order by r.data_receita)
                from receitas r where r.cliente_id = p_cliente), '[]'),
    'exames', coalesce((select jsonb_agg((to_jsonb(e) - 'otica_id') || jsonb_build_object('olhos',
                  coalesce((select jsonb_agg(to_jsonb(o) - 'otica_id') from exame_olhos o where o.exame_id = e.id), '[]')) order by e.criado_em)
                from exames e where e.cliente_id = p_cliente), '[]'),
    'consultas', coalesce((select jsonb_agg(to_jsonb(x) - 'otica_id' order by x.inicio) from consultas x where x.cliente_id = p_cliente), '[]'),
    'atendimentos', coalesce((select jsonb_agg((to_jsonb(a) - 'otica_id') || jsonb_build_object(
                  'itens', coalesce((select jsonb_agg(to_jsonb(i) - 'otica_id') from atendimento_itens i where i.atendimento_id = a.id), '[]'),
                  'pagamentos', coalesce((select jsonb_agg(to_jsonb(p) - 'otica_id') from pagamentos p where p.atendimento_id = a.id), '[]'))
                order by a.criado_em) from atendimentos a where a.cliente_id = p_cliente), '[]'),
    'ordens_servico', coalesce((select jsonb_agg(to_jsonb(o) - 'otica_id' order by o.criado_em) from ordens_servico o where o.cliente_id = p_cliente), '[]'),
    'vendas_caixa', coalesce((select jsonb_agg((to_jsonb(v) - 'otica_id') || jsonb_build_object(
                  'itens', coalesce((select jsonb_agg(to_jsonb(i) - 'otica_id') from venda_itens i where i.venda_id = v.id), '[]'))
                order by v.criado_em) from vendas v where v.cliente_id = p_cliente), '[]'),
    'contas_a_receber', coalesce((select jsonb_agg(to_jsonb(r) - 'otica_id' order by r.vencimento) from contas_receber r where r.cliente_id = p_cliente), '[]'),
    'contatos_da_loja', coalesce((select jsonb_agg(jsonb_build_object('motivo', k.motivo, 'em', k.criado_em) order by k.criado_em) from cliente_contatos k where k.cliente_id = p_cliente), '[]')
  ) into v_dados;

  insert into acessos_dados_cliente (otica_id, cliente_id, usuario_id, acao) values (v_otica, p_cliente, auth.uid(), 'exportou');
  return v_dados;
end $$;
revoke execute on function exportar_cliente(uuid) from public, anon;
grant execute on function exportar_cliente(uuid) to authenticated;

create or replace function anonimizar_cliente(p_cliente uuid, p_confirmacao text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_otica uuid := minha_otica();
  v_nome  text;
  v_quando timestamptz;
begin
  if v_otica is null or not acesso('clientes', 'excluir') then
    raise exception 'Só o dono ou o gerente anonimiza um cliente' using errcode = 'insufficient_privilege';
  end if;
  select nome, anonimizado_em into v_nome, v_quando from clientes where id = p_cliente and otica_id = v_otica;
  if not found then
    raise exception 'Cliente não encontrado';
  end if;
  if v_quando is not null then
    raise exception 'Este cliente já foi anonimizado';
  end if;
  -- a tela pede para digitar o nome: anonimizar não tem volta
  if lower(trim(coalesce(p_confirmacao, ''))) <> lower(trim(v_nome)) then
    raise exception 'Digite o nome do cliente exatamente como está para confirmar';
  end if;

  update clientes set
    nome = 'Cliente anonimizado', telefone = null, email = null, cpf = null, nascimento = null, endereco = null,
    consentimento_lgpd_em = null, anonimizado_em = now()
  where id = p_cliente;
  update ordens_servico set cliente_nome = 'Cliente anonimizado' where cliente_id = p_cliente;
  update consultas set nome_contato = null, telefone_contato = null where cliente_id = p_cliente;
  delete from anotacoes_cliente where cliente_id = p_cliente;
  delete from cliente_contatos where cliente_id = p_cliente;

  -- a auditoria (0001) guarda cópias antigas das linhas: tira delas o que identifica a pessoa,
  -- inclusive das cópias que as alterações acima acabaram de gerar
  update auditoria set
    antes  = antes  - array['nome', 'telefone', 'email', 'cpf', 'nascimento', 'endereco', 'cliente_nome', 'nome_contato', 'telefone_contato'],
    depois = depois - array['nome', 'telefone', 'email', 'cpf', 'nascimento', 'endereco', 'cliente_nome', 'nome_contato', 'telefone_contato']
  where otica_id = v_otica and (
    (tabela = 'clientes' and registro_id = p_cliente)
    or (tabela = 'ordens_servico' and registro_id in (select id from ordens_servico where cliente_id = p_cliente))
    or (tabela = 'consultas' and registro_id in (select id from consultas where cliente_id = p_cliente))
  );

  insert into acessos_dados_cliente (otica_id, cliente_id, usuario_id, acao) values (v_otica, p_cliente, auth.uid(), 'anonimizou');
end $$;
revoke execute on function anonimizar_cliente(uuid, text) from public, anon;
grant execute on function anonimizar_cliente(uuid, text) to authenticated;
