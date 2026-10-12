-- Backup interno de campeonatos (jogos, elencos e eventos), organizado para cruzar depois com os atletas do app.
-- Fica num schema à parte, SEM acesso pela API do app (nem anon, nem authenticated): só admin via SQL / service role.
-- Os dados de crianças de outras famílias NÃO aparecem no app. O vínculo com um atleta do Carreira ID só é feito
-- quando o responsável autoriza (colunas vinculo_status / autorizado_em / autorizado_por).

create schema if not exists campeonatos_backup;
revoke all on schema campeonatos_backup from public, anon, authenticated;

create table if not exists campeonatos_backup.campeonato (
  id uuid primary key default gen_random_uuid(),
  fonte text not null,                 -- 'ifut', 'copa_uniao', 'ritmo_do_esporte'...
  fonte_id text not null,              -- id do torneio/categoria na fonte
  nome text not null,                  -- "Super Copa Trivella 2026"
  edicao text,
  categoria text,                      -- "Sub 09"
  ano int,
  time_foco text,                      -- time cujo elenco foi guardado inteiro
  url_fonte text,
  coletado_em timestamptz not null default now(),
  unique (fonte, fonte_id)
);

create table if not exists campeonatos_backup.time (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references campeonatos_backup.campeonato(id) on delete cascade,
  fonte_time_id text not null,
  nome text not null,
  unique (campeonato_id, fonte_time_id)
);

create table if not exists campeonatos_backup.jogador (
  id uuid primary key default gen_random_uuid(),
  fonte text not null,
  fonte_user_id text not null,         -- id do jogador na fonte (iFut user_id)
  nome_completo text not null,
  nome_normalizado text not null,      -- minúsculo e sem acento, para busca/cruzamento
  posicao text,
  time_id uuid references campeonatos_backup.time(id) on delete set null,
  -- vínculo com o atleta do app (só preenchido com autorização do responsável)
  crianca_id uuid references public.criancas(id) on delete set null,
  vinculo_status text not null default 'nao_vinculado'
    check (vinculo_status in ('nao_vinculado', 'em_analise', 'vinculado', 'recusado')),
  autorizado_em timestamptz,
  autorizado_por uuid,
  observacao text,
  unique (fonte, fonte_user_id)
);
create index if not exists jogador_nome_idx on campeonatos_backup.jogador (nome_normalizado);
create index if not exists jogador_crianca_idx on campeonatos_backup.jogador (crianca_id);

create table if not exists campeonatos_backup.jogo (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references campeonatos_backup.campeonato(id) on delete cascade,
  fonte_jogo_id text not null,
  data_hora timestamptz,
  rodada text,                         -- "Rodada 1", "Semi Final", "Final"
  local text,
  mandante_id uuid references campeonatos_backup.time(id),
  visitante_id uuid references campeonatos_backup.time(id),
  placar_mandante int,
  placar_visitante int,
  finalizado boolean not null default false,
  wo boolean not null default false,
  prorrogacao boolean not null default false,
  penaltis boolean not null default false,
  payload jsonb,                       -- resposta original da fonte (auditoria)
  unique (campeonato_id, fonte_jogo_id)
);
create index if not exists jogo_data_idx on campeonatos_backup.jogo (data_hora);

create table if not exists campeonatos_backup.evento (
  id uuid primary key default gen_random_uuid(),
  jogo_id uuid not null references campeonatos_backup.jogo(id) on delete cascade,
  jogador_id uuid not null references campeonatos_backup.jogador(id) on delete cascade,
  tipo text not null
    check (tipo in ('gol', 'assistencia', 'presenca', 'destaque', 'amarelo', 'vermelho', 'defesa', 'outro')),
  codigo_fonte text,                   -- código original ('1', '2', '8', '12'...)
  ordem int not null default 1         -- 1º, 2º gol do mesmo jogador no jogo
);
create index if not exists evento_jogo_idx on campeonatos_backup.evento (jogo_id);
create index if not exists evento_jogador_idx on campeonatos_backup.evento (jogador_id);

-- tudo fechado para a API; o admin acessa pelo SQL / service role
alter table campeonatos_backup.campeonato enable row level security;
alter table campeonatos_backup.time enable row level security;
alter table campeonatos_backup.jogador enable row level security;
alter table campeonatos_backup.jogo enable row level security;
alter table campeonatos_backup.evento enable row level security;

-- Resumo por jogador e campeonato (jogos, gols, assistências, destaques, defesas, cartões)
create or replace view campeonatos_backup.resumo_jogador as
select
  j.id as jogador_id, j.nome_completo, j.posicao, t.nome as time, c.nome as campeonato, c.categoria,
  j.vinculo_status, j.crianca_id,
  count(*) filter (where e.tipo = 'presenca') as jogos,
  count(*) filter (where e.tipo = 'gol') as gols,
  count(*) filter (where e.tipo = 'assistencia') as assistencias,
  count(*) filter (where e.tipo = 'destaque') as destaques,
  count(*) filter (where e.tipo = 'defesa') as defesas,
  count(*) filter (where e.tipo = 'amarelo') as amarelos,
  count(*) filter (where e.tipo = 'vermelho') as vermelhos
from campeonatos_backup.jogador j
left join campeonatos_backup.time t on t.id = j.time_id
left join campeonatos_backup.campeonato c on c.id = t.campeonato_id
left join campeonatos_backup.evento e on e.jogador_id = j.id
group by j.id, j.nome_completo, j.posicao, t.nome, c.nome, c.categoria, j.vinculo_status, j.crianca_id;

-- Uma linha por jogador em cada jogo (para cruzar com carreira_jogos por data/adversário)
create or replace view campeonatos_backup.jogador_por_jogo as
select
  j.id as jogador_id, j.nome_completo, j.crianca_id, g.id as jogo_id, (g.data_hora at time zone 'America/Sao_Paulo')::date as data_jogo,
  g.rodada, tm.nome as mandante, tv.nome as visitante, g.placar_mandante, g.placar_visitante,
  count(*) filter (where e.tipo = 'presenca') as jogou,
  count(*) filter (where e.tipo = 'gol') as gols,
  count(*) filter (where e.tipo = 'assistencia') as assistencias,
  bool_or(e.tipo = 'destaque') as destaque
from campeonatos_backup.evento e
join campeonatos_backup.jogador j on j.id = e.jogador_id
join campeonatos_backup.jogo g on g.id = e.jogo_id
left join campeonatos_backup.time tm on tm.id = g.mandante_id
left join campeonatos_backup.time tv on tv.id = g.visitante_id
group by j.id, j.nome_completo, j.crianca_id, g.id, g.data_hora, g.rodada, tm.nome, tv.nome, g.placar_mandante, g.placar_visitante;

revoke all on all tables in schema campeonatos_backup from public, anon, authenticated;
