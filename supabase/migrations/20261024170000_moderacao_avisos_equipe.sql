-- Moderação da comunidade: (1) novo motivo de denúncia "fora do tema" (propaganda, política, meme);
-- (2) a equipe é avisada por notificação quando chega uma denúncia e quando o filtro/IA bloqueia uma publicação.
-- Os avisos vão para a lista de destinatários dos avisos de admin (tabela carreira_admin_destinatarios).
alter table public.denuncias_conteudo drop constraint if exists denuncias_conteudo_motivo_check;
alter table public.denuncias_conteudo add constraint denuncias_conteudo_motivo_check
  check (motivo in ('spam', 'assedio', 'conteudo_sexual', 'violencia', 'info_falsa', 'menor_exposto', 'fora_do_tema', 'outro'));

create or replace function public.avisar_equipe_moderacao(p_titulo text, p_corpo text, p_url text, p_tag text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ids uuid[];
begin
  select array_agg(user_id) into v_ids from public.carreira_admin_destinatarios;
  if v_ids is null then return; end if;
  perform public.push_interno(v_ids, p_titulo, p_corpo, p_url, p_tag);
exception when others then
  null; -- aviso é best-effort: nunca impede a denúncia nem a moderação
end;
$function$;
revoke all on function public.avisar_equipe_moderacao(text, text, text, text) from public, anon, authenticated;

-- Denúncia nova -> aviso. Denúncia sobre criança ou adolescente tem título de alerta.
create or replace function public.trg_aviso_denuncia_nova()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_motivo text; v_tipo text;
begin
  v_motivo := case new.motivo
    when 'spam' then 'spam ou propaganda enganosa'
    when 'assedio' then 'assédio, ofensa ou bullying'
    when 'conteudo_sexual' then 'conteúdo sexual ou impróprio'
    when 'violencia' then 'violência ou ameaça'
    when 'info_falsa' then 'informação ou perfil falso'
    when 'menor_exposto' then 'exposição indevida de criança ou adolescente'
    when 'fora_do_tema' then 'fora do tema (propaganda, política, meme)'
    else 'outro motivo' end;
  v_tipo := case new.tipo_conteudo
    when 'post' then 'publicação' when 'comentario' then 'comentário' else 'perfil' end;
  perform public.avisar_equipe_moderacao(
    case when new.motivo = 'menor_exposto' then 'Denúncia envolvendo menor: prioridade' else 'Nova denúncia' end,
    'Denunciaram ' || v_tipo || ' por ' || v_motivo || '. Toque para analisar.',
    '/carreira/admin/denuncias',
    'denuncia'
  );
  return new;
end;
$function$;

drop trigger if exists trg_aviso_denuncia_nova on public.denuncias_conteudo;
create trigger trg_aviso_denuncia_nova
  after insert on public.denuncias_conteudo
  for each row execute function public.trg_aviso_denuncia_nova();

-- Publicação bloqueada pelo filtro de palavras ou pela IA -> aviso (no máximo 5 por pessoa a cada 10 minutos, para não virar enxurrada).
create or replace function public.trg_aviso_conteudo_bloqueado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status is distinct from 'bloqueado' then return new; end if;
  if (select count(*) from public.moderation_logs
        where user_id = new.user_id and status = 'bloqueado' and created_at > now() - interval '10 minutes') > 5 then
    return new;
  end if;
  perform public.avisar_equipe_moderacao(
    'Conteúdo bloqueado automaticamente',
    coalesce(new.reason, 'Bloqueado pelo filtro') || '. Toque para ver.',
    '/carreira/admin/moderacao',
    'moderacao'
  );
  return new;
end;
$function$;

drop trigger if exists trg_aviso_conteudo_bloqueado on public.moderation_logs;
create trigger trg_aviso_conteudo_bloqueado
  after insert on public.moderation_logs
  for each row execute function public.trg_aviso_conteudo_bloqueado();
