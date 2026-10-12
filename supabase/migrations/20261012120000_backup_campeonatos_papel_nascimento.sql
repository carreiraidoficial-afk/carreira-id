-- Comissão técnica, camisa e data de nascimento no backup de campeonatos (ajuda a cruzar com o atleta quando ele se cadastrar).
alter table campeonatos_backup.jogador
  add column if not exists papel text not null default 'jogador' check (papel in ('jogador', 'comissao')),
  add column if not exists camisa int,
  add column if not exists data_nascimento date,
  add column if not exists genero text,
  add column if not exists status_fonte text;
create index if not exists jogador_nascimento_idx on campeonatos_backup.jogador (data_nascimento);
update campeonatos_backup.jogador set papel = 'comissao' where posicao = 'Comissão técnica';

-- funções de consulta: filtro por papel e novos campos na linha
drop function if exists public.backup_jogadores(text, uuid, uuid, text, int, int);
create or replace function public.backup_jogadores(
  p_busca text default null, p_campeonato uuid default null, p_time uuid default null,
  p_vinculo text default null, p_limite int default 50, p_offset int default 0, p_papel text default null
) returns jsonb
language plpgsql stable security definer set search_path = public, campeonatos_backup as $$
declare
  v_termos text[];
  v_total bigint;
  v_linhas jsonb;
begin
  perform public.backup_checar_admin();
  v_termos := regexp_split_to_array(trim(public.backup_normalizar(p_busca)), '\s+');
  if v_termos = array['']::text[] then v_termos := '{}'; end if;

  select count(*) into v_total
  from campeonatos_backup.jogador j
  join campeonatos_backup.time t on t.id = j.time_id
  where (p_campeonato is null or t.campeonato_id = p_campeonato)
    and (p_time is null or j.time_id = p_time)
    and (p_vinculo is null or j.vinculo_status = p_vinculo)
    and (p_papel is null or j.papel = p_papel)
    and not exists (select 1 from unnest(v_termos) as x(termo) where j.nome_normalizado not like '%' || x.termo || '%');

  select coalesce(jsonb_agg(to_jsonb(r) order by r.nome_completo), '[]'::jsonb) into v_linhas from (
    select j.id, j.nome_completo, j.posicao, j.papel, j.camisa, j.data_nascimento, j.vinculo_status, j.crianca_id, j.autorizado_em,
      t.nome as time, c.nome as campeonato, c.categoria,
      count(e.id) filter (where e.tipo = 'presenca') as jogos,
      count(e.id) filter (where e.tipo = 'gol') as gols,
      count(e.id) filter (where e.tipo = 'assistencia') as assistencias,
      count(e.id) filter (where e.tipo = 'destaque') as destaques,
      count(e.id) filter (where e.tipo = 'defesa') as defesas,
      count(e.id) filter (where e.tipo = 'amarelo') as amarelos,
      count(e.id) filter (where e.tipo = 'vermelho') as vermelhos
    from campeonatos_backup.jogador j
    join campeonatos_backup.time t on t.id = j.time_id
    join campeonatos_backup.campeonato c on c.id = t.campeonato_id
    left join campeonatos_backup.evento e on e.jogador_id = j.id
    where (p_campeonato is null or t.campeonato_id = p_campeonato)
      and (p_time is null or j.time_id = p_time)
      and (p_vinculo is null or j.vinculo_status = p_vinculo)
      and (p_papel is null or j.papel = p_papel)
      and not exists (select 1 from unnest(v_termos) as x(termo) where j.nome_normalizado not like '%' || x.termo || '%')
    group by j.id, j.nome_completo, j.posicao, j.papel, j.camisa, j.data_nascimento, j.vinculo_status, j.crianca_id, j.autorizado_em, t.nome, c.nome, c.categoria
    order by j.nome_completo
    limit greatest(least(p_limite, 200), 1) offset greatest(p_offset, 0)
  ) r;

  return jsonb_build_object('total', v_total, 'linhas', v_linhas);
end $$;

revoke all on function public.backup_jogadores(text, uuid, uuid, text, int, int, text) from public, anon;
grant execute on function public.backup_jogadores(text, uuid, uuid, text, int, int, text) to authenticated;

-- resumo e lista de times passam a separar atletas de comissão
create or replace function public.backup_resumo() returns jsonb
language plpgsql stable security definer set search_path = public, campeonatos_backup as $$
begin
  perform public.backup_checar_admin();
  return jsonb_build_object(
    'campeonatos', (select count(*) from campeonatos_backup.campeonato),
    'times', (select count(*) from campeonatos_backup.time),
    'jogadores', (select count(*) from campeonatos_backup.jogador where papel = 'jogador'),
    'comissao', (select count(*) from campeonatos_backup.jogador where papel = 'comissao'),
    'jogos', (select count(*) from campeonatos_backup.jogo),
    'jogos_finalizados', (select count(*) from campeonatos_backup.jogo where finalizado),
    'eventos', (select count(*) from campeonatos_backup.evento),
    'vinculados', (select count(*) from campeonatos_backup.jogador where vinculo_status = 'vinculado'),
    'em_analise', (select count(*) from campeonatos_backup.jogador where vinculo_status = 'em_analise'),
    'ultima_coleta', (select max(coletado_em) from campeonatos_backup.campeonato),
    'tamanho_mb', round((select coalesce(sum(pg_total_relation_size(c.oid)), 0) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'campeonatos_backup' and c.relkind = 'r') / 1048576.0, 2)
  );
end $$;
