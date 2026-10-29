-- Vitral — estrutura base multiempresa (Postgres / Supabase)
--
-- Princípios:
--   1. Toda tabela de negócio tem otica_id e RLS: uma ótica nunca enxerga outra.
--   2. Permissões por perfil e por módulo (ver, criar, editar, excluir).
--   3. Recursos liberados por plano (plano_recursos): ligar um recurso = inserir uma linha.
--   4. Tabelas das versões futuras (PDV, financeiro) já existem; só as telas vêm depois.
--
-- Fora daqui (use a service role no backend): criar ótica + primeiro usuário dono,
-- agendamento público pelo site e o painel de super admin.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type plano_tipo     as enum ('essencial', 'profissional', 'rede');
create type otica_status   as enum ('teste', 'ativa', 'suspensa', 'cancelada');
create type etapa_tipo     as enum ('aberta', 'ganha', 'perdida');
create type consulta_status as enum ('agendada', 'confirmada', 'compareceu', 'faltou', 'remarcada', 'cancelada');

-- ---------------------------------------------------------------------------
-- Contas: ótica, lojas, perfis, usuários
-- ---------------------------------------------------------------------------
create table oticas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cnpj        text,
  telefone    text,
  logo_url    text,
  plano       plano_tipo   not null default 'essencial',
  status      otica_status not null default 'teste',
  criado_em   timestamptz  not null default now()
);

create table lojas (
  id         uuid primary key default gen_random_uuid(),
  otica_id   uuid not null references oticas(id) on delete cascade,
  nome       text not null,
  telefone   text,
  endereco   text,
  ativa      boolean not null default true,
  criado_em  timestamptz not null default now()
);
create index on lojas (otica_id);

-- permissoes: {"clientes": ["ver","criar","editar","excluir"], "vendas": ["ver"], ...}
create table perfis (
  id          uuid primary key default gen_random_uuid(),
  otica_id    uuid not null references oticas(id) on delete cascade,
  chave       text not null,
  nome        text not null,
  permissoes  jsonb not null default '{}'::jsonb,
  do_sistema  boolean not null default false,
  unique (otica_id, chave)
);

create table usuarios (
  id         uuid primary key,              -- = auth.users.id
  otica_id   uuid not null references oticas(id) on delete cascade,
  loja_id    uuid references lojas(id) on delete set null,
  perfil_id  uuid not null references perfis(id),
  nome       text not null,
  email      text not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
create index on usuarios (otica_id);

-- Quais recursos cada plano libera. Módulos que não aparecem aqui estão sempre liberados.
create table plano_recursos (
  plano    plano_tipo not null,
  recurso  text not null,
  primary key (plano, recurso)
);

insert into plano_recursos (plano, recurso) values
  ('profissional', 'agenda'), ('profissional', 'agendamento_online'), ('profissional', 'relatorios'),
  ('profissional', 'pdv'),    ('profissional', 'financeiro'),
  ('rede', 'agenda'), ('rede', 'agendamento_online'), ('rede', 'relatorios'),
  ('rede', 'pdv'),   ('rede', 'financeiro'),
  ('rede', 'multiloja'), ('rede', 'comissoes'), ('rede', 'nota_fiscal'), ('rede', 'permissoes_avancadas');

-- ---------------------------------------------------------------------------
-- Funções de acesso (usadas por todas as políticas)
-- ---------------------------------------------------------------------------
create or replace function minha_otica() returns uuid
language sql stable security definer set search_path = public as $$
  select u.otica_id
  from usuarios u
  join oticas o on o.id = u.otica_id
  where u.id = auth.uid() and u.ativo and o.status in ('teste', 'ativa')
$$;

create or replace function recurso_ativo(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from plano_recursos where recurso = r) then true
    else exists (
      select 1 from plano_recursos pr
      join oticas o on o.plano = pr.plano
      where o.id = minha_otica() and pr.recurso = r
    )
  end
$$;

-- Permissão do perfil do usuário logado em um módulo, respeitando o plano.
create or replace function acesso(modulo text, acao text) returns boolean
language sql stable security definer set search_path = public as $$
  select minha_otica() is not null
    and recurso_ativo(modulo)
    and exists (
      select 1
      from usuarios u join perfis p on p.id = u.perfil_id
      where u.id = auth.uid() and u.ativo
        and (p.permissoes -> modulo) ? acao
    )
$$;

create or replace function acesso_algum(modulos text[], acao text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from unnest(modulos) m where acesso(m, acao))
$$;

-- ---------------------------------------------------------------------------
-- Clientes e receitas
-- ---------------------------------------------------------------------------
create table clientes (
  id                     uuid primary key default gen_random_uuid(),
  otica_id               uuid not null references oticas(id) on delete cascade,
  nome                   text not null,
  telefone               text,
  email                  text,
  cpf                    text,
  nascimento             date,
  endereco               text,
  consentimento_lgpd_em  timestamptz,
  criado_por             uuid references usuarios(id),
  criado_em              timestamptz not null default now()
);
create index on clientes (otica_id, nome);
create index on clientes (otica_id, telefone);

create table anotacoes_cliente (
  id          uuid primary key default gen_random_uuid(),
  otica_id    uuid not null references oticas(id) on delete cascade,
  cliente_id  uuid not null references clientes(id) on delete cascade,
  texto       text not null,
  autor_id    uuid references usuarios(id),
  criado_em   timestamptz not null default now()
);
create index on anotacoes_cliente (cliente_id);

create table receitas (
  id            uuid primary key default gen_random_uuid(),
  otica_id      uuid not null references oticas(id) on delete cascade,
  cliente_id    uuid not null references clientes(id) on delete cascade,
  data_receita  date not null default current_date,
  tipo          text not null default 'oculos' check (tipo in ('oculos', 'contato')),
  medico        text,
  crm           text,
  validade      date,
  externa       boolean not null default false,
  anexo_path    text,                                  -- Supabase Storage (foto ou PDF)
  observacao    text,
  criado_por    uuid references usuarios(id),
  criado_em     timestamptz not null default now()
);
create index on receitas (cliente_id, data_receita desc);

-- Uma linha por olho e por distância (longe/perto)
create table receita_olhos (
  id            uuid primary key default gen_random_uuid(),
  otica_id      uuid not null references oticas(id) on delete cascade,
  receita_id    uuid not null references receitas(id) on delete cascade,
  olho          text not null check (olho in ('OD', 'OE')),
  distancia     text not null default 'longe' check (distancia in ('longe', 'perto')),
  esferico      numeric(4,2),
  cilindrico    numeric(4,2),
  eixo          smallint check (eixo between 0 and 180),
  adicao        numeric(3,2),
  prisma        numeric(4,2),
  base          text,
  dnp           numeric(4,1),
  altura        numeric(4,1),
  curva_base    numeric(3,1),                          -- lente de contato
  diametro      numeric(3,1),                          -- lente de contato
  unique (receita_id, olho, distancia)
);

-- ---------------------------------------------------------------------------
-- Catálogo e funil de vendas
-- ---------------------------------------------------------------------------
create table catalogo_itens (
  id        uuid primary key default gen_random_uuid(),
  otica_id  uuid not null references oticas(id) on delete cascade,
  categoria text not null check (categoria in ('lente', 'tratamento', 'armacao', 'lente_contato', 'acessorio', 'servico')),
  nome      text not null,
  preco     numeric(12,2) not null check (preco >= 0),
  ativo     boolean not null default true
);
create index on catalogo_itens (otica_id, categoria);

create table funil_etapas (
  id        uuid primary key default gen_random_uuid(),
  otica_id  uuid not null references oticas(id) on delete cascade,
  nome      text not null,
  tipo      etapa_tipo not null default 'aberta',
  ordem     int not null,
  visivel   boolean not null default true,
  dias_para_sem_retorno int,                           -- vira "Sem retorno" sozinho após N dias
  unique (otica_id, ordem)
);

create table motivos_perda (
  id        uuid primary key default gen_random_uuid(),
  otica_id  uuid not null references oticas(id) on delete cascade,
  nome      text not null,
  ativo     boolean not null default true
);

-- Cada card do funil
create table atendimentos (
  id                uuid primary key default gen_random_uuid(),
  otica_id          uuid not null references oticas(id) on delete cascade,
  loja_id           uuid references lojas(id),
  cliente_id        uuid not null references clientes(id) on delete cascade,
  etapa_id          uuid not null references funil_etapas(id),
  responsavel_id    uuid references usuarios(id),
  receita_id        uuid references receitas(id),
  descricao         text,
  valor_total       numeric(12,2) not null default 0,
  motivo_perda_id   uuid references motivos_perda(id),
  observacao_perda  text,
  etapa_desde       timestamptz not null default now(),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index on atendimentos (otica_id, etapa_id);
create index on atendimentos (cliente_id);

create table atendimento_itens (
  id               uuid primary key default gen_random_uuid(),
  otica_id         uuid not null references oticas(id) on delete cascade,
  atendimento_id   uuid not null references atendimentos(id) on delete cascade,
  catalogo_item_id uuid references catalogo_itens(id),
  descricao        text not null,
  quantidade       numeric(8,2) not null default 1 check (quantidade > 0),
  preco_unitario   numeric(12,2) not null check (preco_unitario >= 0)
);
create index on atendimento_itens (atendimento_id);

-- ---------------------------------------------------------------------------
-- Laboratório
-- ---------------------------------------------------------------------------
create table os_etapas (
  id        uuid primary key default gen_random_uuid(),
  otica_id  uuid not null references oticas(id) on delete cascade,
  nome      text not null,
  ordem     int not null,
  final     boolean not null default false,            -- Entregue
  avisa_cliente boolean not null default false,        -- "Chegou na loja": mostra o botão de WhatsApp
  unique (otica_id, ordem)
);

create table contadores (
  otica_id uuid not null references oticas(id) on delete cascade,
  nome     text not null,
  valor    int not null default 0,
  primary key (otica_id, nome)
);

create or replace function proximo_numero(p_otica uuid, p_nome text) returns int
language sql security definer set search_path = public as $$
  insert into contadores (otica_id, nome, valor) values (p_otica, p_nome, 1)
  on conflict (otica_id, nome) do update set valor = contadores.valor + 1
  returning valor
$$;
revoke all on function proximo_numero(uuid, text) from public;

-- Sem valores de venda: o perfil do laboratório não vê preços.
create table ordens_servico (
  id               uuid primary key default gen_random_uuid(),
  otica_id         uuid not null references oticas(id) on delete cascade,
  loja_id          uuid references lojas(id),
  numero           int,
  atendimento_id   uuid references atendimentos(id) on delete set null,
  cliente_id       uuid not null references clientes(id) on delete cascade,
  receita_id       uuid references receitas(id),
  etapa_id         uuid not null references os_etapas(id),
  descricao        text not null,
  laboratorio_nome text,                                -- interno ou fornecedor externo
  data_prometida   date,
  data_entrega     date,
  garantia_ate     date,
  retrabalho       boolean not null default false,
  motivo_retrabalho text,
  etapa_desde      timestamptz not null default now(),
  criado_em        timestamptz not null default now(),
  unique (otica_id, numero)
);
create index on ordens_servico (otica_id, etapa_id);
create index on ordens_servico (cliente_id);

create or replace function os_numero() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.numero is null then
    new.numero := proximo_numero(new.otica_id, 'os');
  end if;
  return new;
end $$;
create trigger trg_os_numero before insert on ordens_servico
  for each row execute function os_numero();

create table os_historico (
  id        uuid primary key default gen_random_uuid(),
  otica_id  uuid not null references oticas(id) on delete cascade,
  os_id     uuid not null references ordens_servico(id) on delete cascade,
  de_etapa  uuid references os_etapas(id),
  para_etapa uuid references os_etapas(id),
  usuario_id uuid references usuarios(id),
  em        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------
create table horarios_trabalho (
  id              uuid primary key default gen_random_uuid(),
  otica_id        uuid not null references oticas(id) on delete cascade,
  loja_id         uuid not null references lojas(id) on delete cascade,
  profissional_id uuid references usuarios(id) on delete cascade,
  dia_semana      smallint not null check (dia_semana between 0 and 6),   -- 0 = domingo
  inicio          time not null,
  fim             time not null,
  duracao_min     int not null default 60 check (duracao_min > 0),
  check (fim > inicio)
);

create table bloqueios_agenda (
  id              uuid primary key default gen_random_uuid(),
  otica_id        uuid not null references oticas(id) on delete cascade,
  loja_id         uuid not null references lojas(id) on delete cascade,
  profissional_id uuid references usuarios(id) on delete cascade,
  inicio          timestamptz not null,
  fim             timestamptz not null,
  motivo          text,
  check (fim > inicio)
);

create table consultas (
  id              uuid primary key default gen_random_uuid(),
  otica_id        uuid not null references oticas(id) on delete cascade,
  loja_id         uuid not null references lojas(id) on delete cascade,
  profissional_id uuid references usuarios(id),
  cliente_id      uuid references clientes(id) on delete set null,
  nome_contato    text,
  telefone_contato text,
  inicio          timestamptz not null,
  fim             timestamptz not null,
  status          consulta_status not null default 'agendada',
  origem          text not null default 'loja' check (origem in ('loja', 'site')),
  criado_em       timestamptz not null default now(),
  check (fim > inicio),
  -- o mesmo horário nunca é marcado duas vezes para o mesmo profissional
  constraint consulta_sem_conflito exclude using gist (
    profissional_id with =,
    tstzrange(inicio, fim) with &&
  ) where (status not in ('cancelada', 'remarcada') and profissional_id is not null)
);
create index on consultas (otica_id, inicio);

-- O site mostra só os horários ocupados, sem dados de ninguém.
create or replace function horarios_ocupados(p_loja uuid, p_dia date)
returns table (inicio timestamptz, fim timestamptz)
language sql stable security definer set search_path = public as $$
  select c.inicio, c.fim from consultas c
  where c.loja_id = p_loja and c.status not in ('cancelada', 'remarcada')
    and c.inicio >= p_dia::timestamptz and c.inicio < (p_dia + 1)::timestamptz
  union all
  select b.inicio, b.fim from bloqueios_agenda b
  where b.loja_id = p_loja
    and b.inicio < (p_dia + 1)::timestamptz and b.fim > p_dia::timestamptz
$$;
grant execute on function horarios_ocupados(uuid, date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Versões futuras (tabelas prontas, telas depois): PDV e financeiro
-- ---------------------------------------------------------------------------
create table caixas (
  id            uuid primary key default gen_random_uuid(),
  otica_id      uuid not null references oticas(id) on delete cascade,
  loja_id       uuid not null references lojas(id),
  operador_id   uuid not null references usuarios(id),
  aberto_em     timestamptz not null default now(),
  fechado_em    timestamptz,
  valor_abertura numeric(12,2) not null default 0,
  valor_fechamento numeric(12,2)
);

create table vendas (
  id            uuid primary key default gen_random_uuid(),
  otica_id      uuid not null references oticas(id) on delete cascade,
  loja_id       uuid not null references lojas(id),
  caixa_id      uuid references caixas(id),
  cliente_id    uuid references clientes(id),
  atendimento_id uuid references atendimentos(id),
  vendedor_id   uuid references usuarios(id),
  subtotal      numeric(12,2) not null,
  desconto      numeric(12,2) not null default 0,
  total         numeric(12,2) not null,
  cancelada     boolean not null default false,
  criado_em     timestamptz not null default now()
);

-- Usado já na Versão 1 (sinal e saldo do funil) e depois pelo PDV: mesma estrutura.
create table pagamentos (
  id             uuid primary key default gen_random_uuid(),
  otica_id       uuid not null references oticas(id) on delete cascade,
  atendimento_id uuid references atendimentos(id) on delete cascade,
  venda_id       uuid references vendas(id) on delete cascade,
  forma          text not null check (forma in ('dinheiro', 'pix', 'credito', 'debito', 'boleto', 'outro')),
  valor          numeric(12,2) not null check (valor > 0),
  parcelas       smallint not null default 1,
  sinal          boolean not null default false,
  pago_em        timestamptz not null default now(),
  registrado_por uuid references usuarios(id),
  check (atendimento_id is not null or venda_id is not null)
);

create table categorias_custo (
  id        uuid primary key default gen_random_uuid(),
  otica_id  uuid not null references oticas(id) on delete cascade,
  nome      text not null,
  tipo      text not null check (tipo in ('fornecedor', 'fixo', 'imposto', 'servico', 'comissao', 'outro'))
);

create table contas_pagar (
  id           uuid primary key default gen_random_uuid(),
  otica_id     uuid not null references oticas(id) on delete cascade,
  loja_id      uuid references lojas(id),
  categoria_id uuid references categorias_custo(id),
  descricao    text not null,
  valor        numeric(12,2) not null check (valor > 0),
  vencimento   date not null,
  pago_em      date,
  criado_em    timestamptz not null default now()
);
create index on contas_pagar (otica_id, vencimento);

create table contas_receber (
  id           uuid primary key default gen_random_uuid(),
  otica_id     uuid not null references oticas(id) on delete cascade,
  loja_id      uuid references lojas(id),
  venda_id     uuid references vendas(id) on delete set null,
  cliente_id   uuid references clientes(id) on delete set null,
  descricao    text not null,
  valor        numeric(12,2) not null check (valor > 0),
  vencimento   date not null,
  recebido_em  date,
  criado_em    timestamptz not null default now()
);
create index on contas_receber (otica_id, vencimento);

-- ---------------------------------------------------------------------------
-- Auditoria: quem alterou o quê e quando
-- ---------------------------------------------------------------------------
create table auditoria (
  id          bigint generated always as identity primary key,
  otica_id    uuid not null,
  usuario_id  uuid,
  tabela      text not null,
  registro_id uuid,
  acao        text not null,
  antes       jsonb,
  depois      jsonb,
  em          timestamptz not null default now()
);
create index on auditoria (otica_id, em desc);

create or replace function auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reg jsonb := to_jsonb(coalesce(new, old));
begin
  insert into auditoria (otica_id, usuario_id, tabela, registro_id, acao, antes, depois)
  values ((reg ->> 'otica_id')::uuid, auth.uid(), tg_table_name, (reg ->> 'id')::uuid, tg_op,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger aud_clientes  after insert or update or delete on clientes        for each row execute function auditar();
create trigger aud_receitas  after insert or update or delete on receitas        for each row execute function auditar();
create trigger aud_atend     after insert or update or delete on atendimentos    for each row execute function auditar();
create trigger aud_os        after insert or update or delete on ordens_servico  for each row execute function auditar();
create trigger aud_consultas after insert or update or delete on consultas       for each row execute function auditar();

-- ---------------------------------------------------------------------------
-- Regras do funil e do laboratório
-- ---------------------------------------------------------------------------
-- Mover para uma etapa "perdida" exige o motivo; mover limpa o motivo se voltar.
create or replace function atendimento_mudou() returns trigger
language plpgsql as $$
declare
  tipo_nova etapa_tipo;
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' or new.etapa_id is distinct from old.etapa_id then
    new.etapa_desde := now();
    select tipo into tipo_nova from funil_etapas where id = new.etapa_id;
    if tipo_nova = 'perdida' and new.motivo_perda_id is null then
      raise exception 'Informe o motivo da perda' using errcode = 'check_violation';
    elsif tipo_nova <> 'perdida' then
      new.motivo_perda_id := null;
      new.observacao_perda := null;
    end if;
  end if;
  return new;
end $$;
create trigger trg_atendimento_mudou before insert or update on atendimentos
  for each row execute function atendimento_mudou();

create or replace function os_mudou() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  eh_final boolean;
begin
  if new.etapa_id is distinct from old.etapa_id then
    new.etapa_desde := now();
    insert into os_historico (otica_id, os_id, de_etapa, para_etapa, usuario_id)
    values (new.otica_id, new.id, old.etapa_id, new.etapa_id, auth.uid());
    select final into eh_final from os_etapas where id = new.etapa_id;
    if eh_final then
      new.data_entrega := coalesce(new.data_entrega, current_date);
      new.garantia_ate := coalesce(new.garantia_ate, (current_date + interval '6 months')::date);
    end if;
  end if;
  return new;
end $$;
create trigger trg_os_mudou before update on ordens_servico
  for each row execute function os_mudou();

-- Quem vende cria a OS ao marcar como pago, sem precisar de permissão no laboratório.
create or replace function criar_os_do_atendimento(p_atendimento uuid, p_data_prometida date default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a atendimentos%rowtype;
  primeira uuid;
  nova uuid;
begin
  if not acesso('vendas', 'editar') then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  select * into a from atendimentos where id = p_atendimento and otica_id = minha_otica();
  if not found then
    raise exception 'Atendimento não encontrado';
  end if;
  select id into primeira from os_etapas where otica_id = a.otica_id order by ordem limit 1;
  insert into ordens_servico (otica_id, loja_id, atendimento_id, cliente_id, receita_id, etapa_id, descricao, data_prometida)
  values (a.otica_id, a.loja_id, a.id, a.cliente_id, a.receita_id, primeira,
          coalesce(a.descricao, 'Ordem de serviço'), p_data_prometida)
  returning id into nova;
  return nova;
end $$;
grant execute on function criar_os_do_atendimento(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Padrões criados junto com cada ótica (perfis, etapas, motivos)
-- ---------------------------------------------------------------------------
create or replace function preparar_otica() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tudo text := '["ver","criar","editar","excluir"]';
begin
  insert into perfis (otica_id, chave, nome, do_sistema, permissoes) values
    (new.id, 'dono', 'Dono / gerente', true, jsonb_build_object(
      'clientes', tudo::jsonb, 'receitas', tudo::jsonb, 'vendas', tudo::jsonb, 'laboratorio', tudo::jsonb,
      'agenda', tudo::jsonb, 'catalogo', tudo::jsonb, 'relatorios', '["ver"]'::jsonb,
      'pdv', tudo::jsonb, 'financeiro', tudo::jsonb, 'usuarios', tudo::jsonb, 'configuracoes', tudo::jsonb)),
    (new.id, 'vendedor', 'Vendedor', true, jsonb_build_object(
      'clientes', '["ver","criar","editar"]'::jsonb, 'receitas', '["ver","criar","editar"]'::jsonb,
      'vendas', '["ver","criar","editar"]'::jsonb, 'agenda', '["ver","criar","editar"]'::jsonb,
      'catalogo', '["ver"]'::jsonb, 'laboratorio', '["ver"]'::jsonb)),
    (new.id, 'laboratorio', 'Laboratório', true, jsonb_build_object(
      'laboratorio', '["ver","criar","editar"]'::jsonb, 'receitas', '["ver"]'::jsonb, 'clientes', '["ver"]'::jsonb)),
    (new.id, 'recepcao', 'Recepção', true, jsonb_build_object(
      'clientes', '["ver","criar","editar"]'::jsonb, 'agenda', tudo::jsonb)),
    (new.id, 'optometrista', 'Optometrista', true, jsonb_build_object(
      'agenda', '["ver","editar"]'::jsonb, 'receitas', '["ver","criar","editar"]'::jsonb, 'clientes', '["ver"]'::jsonb)),
    (new.id, 'caixa', 'Caixa (PDV)', true, jsonb_build_object(
      'pdv', '["ver","criar"]'::jsonb, 'clientes', '["ver"]'::jsonb)),
    (new.id, 'financeiro', 'Financeiro', true, jsonb_build_object(
      'financeiro', tudo::jsonb, 'relatorios', '["ver"]'::jsonb));

  insert into funil_etapas (otica_id, nome, tipo, ordem, dias_para_sem_retorno) values
    (new.id, 'Atendimento',        'aberta',  1, null),
    (new.id, 'Orçamento enviado',  'aberta',  2, 3),
    (new.id, 'Sem retorno',        'aberta',  3, null),
    (new.id, 'Recuperado',         'ganha',   4, null),
    (new.id, 'Perdido',            'perdida', 5, null);

  insert into motivos_perda (otica_id, nome) values
    (new.id, 'Achou caro'), (new.id, 'Foi em outra loja'), (new.id, 'Vai pensar'),
    (new.id, 'Sem receita'), (new.id, 'Desistiu');

  insert into os_etapas (otica_id, nome, ordem, final, avisa_cliente) values
    (new.id, 'Pago',            1, false, false),
    (new.id, 'No laboratório',  2, false, false),
    (new.id, 'Em montagem',     3, false, false),
    (new.id, 'Chegou na loja',  4, false, true),
    (new.id, 'Cliente avisado', 5, false, false),
    (new.id, 'Entregue',        6, true,  false);

  return new;
end $$;
create trigger trg_preparar_otica after insert on oticas
  for each row execute function preparar_otica();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table oticas            enable row level security;
alter table lojas             enable row level security;
alter table perfis            enable row level security;
alter table usuarios          enable row level security;
alter table plano_recursos    enable row level security;
alter table contadores        enable row level security;
alter table auditoria         enable row level security;
alter table funil_etapas      enable row level security;
alter table motivos_perda     enable row level security;
alter table os_etapas         enable row level security;

-- Contas e configurações
create policy oticas_ver on oticas for select to authenticated using (id = minha_otica());
create policy oticas_editar on oticas for update to authenticated
  using (id = minha_otica() and acesso('configuracoes', 'editar'))
  with check (id = minha_otica());
revoke update on oticas from authenticated;
grant update (nome, cnpj, telefone, logo_url) on oticas to authenticated;   -- plano e status só pela service role

create policy lojas_ver on lojas for select to authenticated using (otica_id = minha_otica());
create policy lojas_escrever on lojas for all to authenticated
  using (otica_id = minha_otica() and acesso('configuracoes', 'editar'))
  with check (otica_id = minha_otica() and acesso('configuracoes', 'editar'));

create policy perfis_ver on perfis for select to authenticated using (otica_id = minha_otica());
create policy perfis_escrever on perfis for all to authenticated
  using (otica_id = minha_otica() and acesso('usuarios', 'editar'))
  with check (otica_id = minha_otica() and acesso('usuarios', 'editar'));

create policy usuarios_ver on usuarios for select to authenticated using (otica_id = minha_otica());
create policy usuarios_criar on usuarios for insert to authenticated
  with check (otica_id = minha_otica() and acesso('usuarios', 'criar'));
create policy usuarios_editar on usuarios for update to authenticated
  using (otica_id = minha_otica() and acesso('usuarios', 'editar'))
  with check (otica_id = minha_otica());
create policy usuarios_excluir on usuarios for delete to authenticated
  using (otica_id = minha_otica() and acesso('usuarios', 'excluir') and id <> auth.uid());

create policy plano_recursos_ver on plano_recursos for select to authenticated using (true);

create policy auditoria_ver on auditoria for select to authenticated
  using (otica_id = minha_otica() and acesso('configuracoes', 'ver'));

-- Etapas e motivos: todos da ótica leem, só quem configura altera
create policy funil_etapas_ver on funil_etapas for select to authenticated using (otica_id = minha_otica());
create policy funil_etapas_escrever on funil_etapas for all to authenticated
  using (otica_id = minha_otica() and acesso('configuracoes', 'editar'))
  with check (otica_id = minha_otica() and acesso('configuracoes', 'editar'));
create policy motivos_perda_ver on motivos_perda for select to authenticated using (otica_id = minha_otica());
create policy motivos_perda_escrever on motivos_perda for all to authenticated
  using (otica_id = minha_otica() and acesso('configuracoes', 'editar'))
  with check (otica_id = minha_otica() and acesso('configuracoes', 'editar'));
create policy os_etapas_ver on os_etapas for select to authenticated using (otica_id = minha_otica());
create policy os_etapas_escrever on os_etapas for all to authenticated
  using (otica_id = minha_otica() and acesso('configuracoes', 'editar'))
  with check (otica_id = minha_otica() and acesso('configuracoes', 'editar'));

-- Tabelas de negócio: tabela -> módulos que dão acesso
do $$
declare
  m record;
begin
  for m in
    select * from (values
      ('clientes',           array['clientes']),
      ('anotacoes_cliente',  array['clientes']),
      ('receitas',           array['receitas']),
      ('receita_olhos',      array['receitas']),
      ('atendimentos',       array['vendas']),
      ('atendimento_itens',  array['vendas']),
      ('ordens_servico',     array['laboratorio']),
      ('os_historico',       array['laboratorio']),
      ('consultas',          array['agenda']),
      ('horarios_trabalho',  array['agenda']),
      ('bloqueios_agenda',   array['agenda']),
      ('catalogo_itens',     array['catalogo']),
      ('caixas',             array['pdv', 'financeiro']),
      ('vendas',             array['pdv', 'financeiro']),
      ('pagamentos',         array['vendas', 'pdv', 'financeiro']),
      ('categorias_custo',   array['financeiro']),
      ('contas_pagar',       array['financeiro']),
      ('contas_receber',     array['financeiro'])
    ) as t(tabela, modulos)
  loop
    execute format('alter table %I enable row level security', m.tabela);
    execute format($p$create policy %I on %I for select to authenticated
                      using (otica_id = minha_otica() and acesso_algum(%L::text[], 'ver'))$p$,
                   m.tabela || '_ver', m.tabela, m.modulos);
    execute format($p$create policy %I on %I for insert to authenticated
                      with check (otica_id = minha_otica() and acesso_algum(%L::text[], 'criar'))$p$,
                   m.tabela || '_criar', m.tabela, m.modulos);
    execute format($p$create policy %I on %I for update to authenticated
                      using (otica_id = minha_otica() and acesso_algum(%L::text[], 'editar'))
                      with check (otica_id = minha_otica())$p$,
                   m.tabela || '_editar', m.tabela, m.modulos);
    execute format($p$create policy %I on %I for delete to authenticated
                      using (otica_id = minha_otica() and acesso_algum(%L::text[], 'excluir'))$p$,
                   m.tabela || '_excluir', m.tabela, m.modulos);
  end loop;
end $$;
