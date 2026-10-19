-- O push de comunicado do admin passa a sair do servidor (gatilho), não do navegador de quem publica.
-- Antes: o painel chamava a função de push pelo navegador, ignorava falhas e o comunicado só aparecia no sininho.

-- Igual a push_interno, mas deixa a função de push resolver os destinatários (todos, por tipo de perfil ou individual).
create or replace function public.push_interno_destinatarios(
  p_tipo text, p_filtro jsonb, p_title text, p_body text, p_url text, p_tag text, p_category text default null)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare v_segredo text;
begin
  select valor into v_segredo from public.segredos_internos where chave = 'push_interno';
  if v_segredo is null then return; end if;
  perform net.http_post(
    url := 'https://fppsotlycinwqsjpoybg.supabase.co/functions/v1/send-carreira-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_segredo),
    body := jsonb_build_object(
      'destinatario_tipo', p_tipo, 'destinatario_filtro', coalesce(p_filtro, '{}'::jsonb),
      'title', p_title, 'body', p_body, 'url', p_url, 'tag', p_tag, 'category', p_category)
  );
exception when others then
  null;  -- aviso é best-effort: nunca derruba a gravação do comunicado
end $fn$;
revoke all on function public.push_interno_destinatarios(text, jsonb, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.carreira_comunicado_push() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
begin
  if new.enviar_push and new.ativo then
    perform public.push_interno_destinatarios(
      new.destinatario_tipo, new.destinatario_filtro,
      '📢 ' || new.titulo, left(new.mensagem, 200), '/feed', 'carreira-comunicado', 'comunicado_push');
  end if;
  return new;
end $fn$;
revoke all on function public.carreira_comunicado_push() from public, anon, authenticated;

drop trigger if exists trg_carreira_comunicado_push on public.carreira_comunicados;
create trigger trg_carreira_comunicado_push
  after insert on public.carreira_comunicados
  for each row execute function public.carreira_comunicado_push();
