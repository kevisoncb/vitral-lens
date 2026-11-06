-- Vitral — migração 0021: assinatura da OS pelo link
--
-- A loja gera um link (gerar_link_assinatura) e manda pelo WhatsApp. O cliente abre no celular, sem login,
-- confere o que foi pedido (receita, lente, armação, prazo e valor) e assina com o dedo.
-- O que ele viu fica guardado como foi mostrado (resumo): se a OS mudar depois, vale o que ele assinou.
-- O link vale 7 dias e só assina uma vez. O público só alcança duas funções (os_para_assinar e assinar_os),
-- e só com o código do link, que não dá para adivinhar.

create table os_assinaturas (
  id              uuid primary key default gen_random_uuid(),
  otica_id        uuid not null references oticas(id) on delete cascade,
  os_id           uuid not null references ordens_servico(id) on delete cascade,
  token           uuid not null unique default gen_random_uuid(),
  resumo          jsonb not null,
  criado_por      uuid references usuarios(id) on delete set null default auth.uid(),
  criado_em       timestamptz not null default now(),
  expira_em       timestamptz not null default now() + interval '7 days',
  assinada_em     timestamptz,
  nome_assinante  text,
  assinatura      text,   -- imagem PNG (data URL) do traço
  ip              text,
  navegador       text
);
create index on os_assinaturas (otica_id, os_id, criado_em desc);
alter table os_assinaturas enable row level security;
-- a loja vê (o laboratório não: o resumo tem valores)
create policy os_assinaturas_ver on os_assinaturas for select to authenticated
  using (otica_id = (select minha_otica()) and (select acesso('vendas', 'ver')));
revoke insert, update, delete on os_assinaturas from anon, authenticated;
revoke all on os_assinaturas from anon;

-- Cria o link (ou devolve o que ainda vale e não foi assinado). Retorna o token.
create or replace function gerar_link_assinatura(p_os uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_otica  uuid := minha_otica();
  v_os     ordens_servico%rowtype;
  v_token  uuid;
  v_resumo jsonb;
begin
  if v_otica is null or not acesso('vendas', 'editar') then
    raise exception 'Seu perfil não pode pedir a assinatura do cliente' using errcode = 'insufficient_privilege';
  end if;
  select * into v_os from ordens_servico where id = p_os and otica_id = v_otica;
  if not found then
    raise exception 'OS não encontrada';
  end if;
  if exists (select 1 from os_assinaturas where os_id = p_os and assinada_em is not null) then
    raise exception 'Esta OS já foi assinada pelo cliente';
  end if;

  select token into v_token from os_assinaturas
  where os_id = p_os and assinada_em is null and expira_em > now() + interval '1 day'
  order by criado_em desc limit 1;
  if v_token is not null then
    return v_token;
  end if;

  select jsonb_build_object(
    'otica', (select nome from oticas where id = v_otica),
    'os_numero', v_os.numero,
    'cliente', v_os.cliente_nome,
    'descricao', v_os.descricao,
    'lente', v_os.lente,
    'tratamentos', v_os.tratamentos,
    'armacao', v_os.armacao,
    'data_prometida', v_os.data_prometida,
    'receita', (select jsonb_build_object(
                  'data', r.data_receita, 'medico', r.medico,
                  'olhos', coalesce((select jsonb_agg(jsonb_build_object('olho', o.olho, 'distancia', o.distancia, 'esferico', o.esferico,
                                       'cilindrico', o.cilindrico, 'eixo', o.eixo, 'adicao', o.adicao) order by o.distancia, o.olho)
                                     from receita_olhos o where o.receita_id = r.id), '[]'))
                from receitas r where r.id = v_os.receita_id),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('descricao', i.descricao, 'quantidade', i.quantidade, 'preco', i.preco_unitario) order by i.preco_unitario desc)
                       from atendimento_itens i where i.atendimento_id = v_os.atendimento_id), '[]'),
    'total', (select valor_total from atendimentos where id = v_os.atendimento_id),
    'pago', (select coalesce(sum(valor), 0) from pagamentos where atendimento_id = v_os.atendimento_id)
  ) into v_resumo;

  insert into os_assinaturas (otica_id, os_id, resumo) values (v_otica, p_os, v_resumo) returning token into v_token;
  return v_token;
end $$;
revoke execute on function gerar_link_assinatura(uuid) from public, anon;
grant execute on function gerar_link_assinatura(uuid) to authenticated;

-- Página pública: o que mostrar para o cliente. Só com o token; nunca o id da OS nem o telefone.
create or replace function os_para_assinar(p_token uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'resumo', a.resumo,
    'situacao', case when a.assinada_em is not null then 'assinada' when a.expira_em < now() then 'expirada' else 'pendente' end,
    'assinada_em', a.assinada_em,
    'nome_assinante', a.nome_assinante,
    'expira_em', a.expira_em
  )
  from os_assinaturas a join oticas o on o.id = a.otica_id
  where a.token = p_token and o.status in ('teste', 'ativa')
$$;
revoke execute on function os_para_assinar(uuid) from public;
grant execute on function os_para_assinar(uuid) to anon, authenticated;

create or replace function assinar_os(p_token uuid, p_nome text, p_assinatura text, p_ip text default null, p_navegador text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  a os_assinaturas%rowtype;
  v_nome text := left(trim(coalesce(p_nome, '')), 120);
begin
  select * into a from os_assinaturas where token = p_token for update;
  if not found then
    raise exception 'Link inválido. Peça um novo à ótica.';
  end if;
  if a.assinada_em is not null then
    raise exception 'Esta OS já foi assinada.';
  end if;
  if a.expira_em < now() then
    raise exception 'Este link venceu. Peça um novo à ótica.';
  end if;
  if length(v_nome) < 3 then
    raise exception 'Escreva seu nome completo.';
  end if;
  -- traço desenhado no celular: PNG em data URL, até ~300 KB
  if p_assinatura is null or p_assinatura !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or length(p_assinatura) < 200 or length(p_assinatura) > 400000 then
    raise exception 'Faça a sua assinatura no quadro.';
  end if;

  update os_assinaturas set assinada_em = now(), nome_assinante = v_nome, assinatura = p_assinatura,
         ip = left(p_ip, 64), navegador = left(p_navegador, 300)
  where id = a.id;
  -- recado na OS: a loja e o laboratório veem que o cliente conferiu e assinou
  insert into os_mensagens (otica_id, os_id, autor_id, area, texto)
  values (a.otica_id, a.os_id, null, 'loja', 'Cliente conferiu e assinou a OS pelo link (' || v_nome || ').');
end $$;
revoke execute on function assinar_os(uuid, text, text, text, text) from public;
grant execute on function assinar_os(uuid, text, text, text, text) to anon, authenticated;
