-- Consulta do backup de campeonatos pelo painel admin.
-- O schema campeonatos_backup continua fechado para a API; estas funções (security definer) só respondem para admin.

create or replace function public.backup_checar_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'acesso restrito ao admin' using errcode = '42501';
  end if;
end $$;

-- texto sem acento e minúsculo, igual ao de nome_normalizado
create or replace function public.backup_normalizar(p text) returns text
language sql immutable set search_path = public as $$
  select lower(translate(coalesce(p, ''), 'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇáàãâäéèêëíìîïóòõôöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'))
$$;

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

create or replace function public.backup_campeonatos() returns jsonb
language plpgsql stable security definer set search_path = public, campeonatos_backup as $$
begin
  perform public.backup_checar_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.categoria) from (
      select c.id, c.fonte, c.fonte_id, c.nome, c.edicao, c.categoria, c.ano, c.time_foco, c.coletado_em,
        (select count(*) from campeonatos_backup.time t where t.campeonato_id = c.id) as times,
        (select count(*) from campeonatos_backup.jogo g where g.campeonato_id = c.id) as jogos,
        (select count(*) from campeonatos_backup.jogo g where g.campeonato_id = c.id and g.finalizado) as jogos_finalizados,
        (select count(*) from campeonatos_backup.jogador j join campeonatos_backup.time t on t.id = j.time_id where t.campeonato_id = c.id and j.papel = 'jogador') as jogadores
      from campeonatos_backup.campeonato c
    ) x
  ), '[]'::jsonb);
end $$;

-- Times de um campeonato com campanha (jogos finalizados)
create or replace function public.backup_times(p_campeonato uuid) returns jsonb
language plpgsql stable security definer set search_path = public, campeonatos_backup as $$
begin
  perform public.backup_checar_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.pontos desc, x.saldo desc, x.nome) from (
      select t.id, t.nome,
        (select count(*) from campeonatos_backup.jogador j where j.time_id = t.id and j.papel = 'jogador') as jogadores,
        count(g.id) as jogos,
        count(g.id) filter (where (g.mandante_id = t.id and g.placar_mandante > g.placar_visitante) or (g.visitante_id = t.id and g.placar_visitante > g.placar_mandante)) as vitorias,
        count(g.id) filter (where g.placar_mandante = g.placar_visitante) as empates,
        count(g.id) filter (where (g.mandante_id = t.id and g.placar_mandante < g.placar_visitante) or (g.visitante_id = t.id and g.placar_visitante < g.placar_mandante)) as derrotas,
        coalesce(sum(case when g.mandante_id = t.id then g.placar_mandante else g.placar_visitante end), 0) as gols_pro,
        coalesce(sum(case when g.mandante_id = t.id then g.placar_visitante else g.placar_mandante end), 0) as gols_contra,
        coalesce(sum(case when g.mandante_id = t.id then g.placar_mandante - g.placar_visitante else g.placar_visitante - g.placar_mandante end), 0) as saldo,
        count(g.id) filter (where (g.mandante_id = t.id and g.placar_mandante > g.placar_visitante) or (g.visitante_id = t.id and g.placar_visitante > g.placar_mandante)) * 3
          + count(g.id) filter (where g.placar_mandante = g.placar_visitante) as pontos
      from campeonatos_backup.time t
      left join campeonatos_backup.jogo g on g.finalizado and (g.mandante_id = t.id or g.visitante_id = t.id)
      where t.campeonato_id = p_campeonato
      group by t.id, t.nome
    ) x
  ), '[]'::jsonb);
end $$;

-- Jogos de um campeonato
create or replace function public.backup_jogos(p_campeonato uuid) returns jsonb
language plpgsql stable security definer set search_path = public, campeonatos_backup as $$
begin
  perform public.backup_checar_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.data_hora) from (
      select g.id, g.data_hora, g.rodada, g.local, tm.nome as mandante, tv.nome as visitante,
        g.placar_mandante, g.placar_visitante, g.finalizado, g.wo, g.prorrogacao, g.penaltis,
        (select count(*) from campeonatos_backup.evento e where e.jogo_id = g.id) as eventos
      from campeonatos_backup.jogo g
      left join campeonatos_backup.time tm on tm.id = g.mandante_id
      left join campeonatos_backup.time tv on tv.id = g.visitante_id
      where g.campeonato_id = p_campeonato
    ) x
  ), '[]'::jsonb);
end $$;

-- Eventos de um jogo (quem fez gol, assistência, destaque, cartões...)
create or replace function public.backup_jogo_eventos(p_jogo uuid) returns jsonb
language plpgsql stable security definer set search_path = public, campeonatos_backup as $$
begin
  perform public.backup_checar_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.time, x.nome_completo, x.tipo) from (
      select j.id as jogador_id, j.nome_completo as nome_completo, t.nome as time, e.tipo, count(*) as quantidade
      from campeonatos_backup.evento e
      join campeonatos_backup.jogador j on j.id = e.jogador_id
      left join campeonatos_backup.time t on t.id = j.time_id
      where e.jogo_id = p_jogo
      group by j.id, j.nome_completo, t.nome, e.tipo
    ) x
  ), '[]'::jsonb);
end $$;

-- Busca de jogadores (por nome sem acento, campeonato, time e vínculo)
create or replace function public.backup_jogadores(
  p_busca text default null, p_campeonato uuid default null, p_time uuid default null,
  p_vinculo text default null, p_limite int default 50, p_offset int default 0
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
    and not exists (select 1 from unnest(v_termos) as x(termo) where j.nome_normalizado not like '%' || x.termo || '%');

  select coalesce(jsonb_agg(to_jsonb(r) order by r.nome_completo), '[]'::jsonb) into v_linhas from (
    select j.id, j.nome_completo, j.posicao, j.vinculo_status, j.crianca_id, j.autorizado_em,
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
      and not exists (select 1 from unnest(v_termos) as x(termo) where j.nome_normalizado not like '%' || x.termo || '%')
    group by j.id, j.nome_completo, j.posicao, j.vinculo_status, j.crianca_id, j.autorizado_em, t.nome, c.nome, c.categoria
    order by j.nome_completo
    limit greatest(least(p_limite, 200), 1) offset greatest(p_offset, 0)
  ) r;

  return jsonb_build_object('total', v_total, 'linhas', v_linhas);
end $$;

-- Jogos de um jogador (uma linha por partida)
create or replace function public.backup_jogador_jogos(p_jogador uuid) returns jsonb
language plpgsql stable security definer set search_path = public, campeonatos_backup as $$
begin
  perform public.backup_checar_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.data_hora) from (
      select g.id as jogo_id, g.data_hora, g.rodada, tm.nome as mandante, tv.nome as visitante,
        g.placar_mandante, g.placar_visitante, g.finalizado,
        count(*) filter (where e.tipo = 'presenca') as jogou,
        count(*) filter (where e.tipo = 'gol') as gols,
        count(*) filter (where e.tipo = 'assistencia') as assistencias,
        count(*) filter (where e.tipo = 'destaque') as destaque,
        count(*) filter (where e.tipo = 'defesa') as defesas,
        count(*) filter (where e.tipo = 'amarelo') as amarelos,
        count(*) filter (where e.tipo = 'vermelho') as vermelhos
      from campeonatos_backup.evento e
      join campeonatos_backup.jogo g on g.id = e.jogo_id
      left join campeonatos_backup.time tm on tm.id = g.mandante_id
      left join campeonatos_backup.time tv on tv.id = g.visitante_id
      where e.jogador_id = p_jogador
      group by g.id, g.data_hora, g.rodada, tm.nome, tv.nome, g.placar_mandante, g.placar_visitante, g.finalizado
    ) x
  ), '[]'::jsonb);
end $$;

revoke all on function public.backup_checar_admin(), public.backup_resumo(), public.backup_campeonatos(),
  public.backup_times(uuid), public.backup_jogos(uuid), public.backup_jogo_eventos(uuid),
  public.backup_jogadores(text, uuid, uuid, text, int, int), public.backup_jogador_jogos(uuid) from public, anon;
grant execute on function public.backup_resumo(), public.backup_campeonatos(), public.backup_times(uuid),
  public.backup_jogos(uuid), public.backup_jogo_eventos(uuid), public.backup_jogadores(text, uuid, uuid, text, int, int),
  public.backup_jogador_jogos(uuid) to authenticated;
