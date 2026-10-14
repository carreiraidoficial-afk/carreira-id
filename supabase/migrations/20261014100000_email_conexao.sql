-- E-mail de segurança para avisos de conexão: o gatilho de conexão chama a edge function send-conexao-email
-- (mesmo segredo interno do push). A função decide sozinha: só envia para quem não recebe push, no máx. 1 por 30 min.

create or replace function public.email_conexao_interno(p_user uuid, p_tipo text, p_nome text) returns void
language plpgsql security definer set search_path = public as $$
declare v_segredo text;
begin
  select valor into v_segredo from public.segredos_internos where chave = 'push_interno';
  if v_segredo is null or p_user is null then return; end if;
  perform net.http_post(
    url := 'https://fppsotlycinwqsjpoybg.supabase.co/functions/v1/send-conexao-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_segredo),
    body := jsonb_build_object('user_id', p_user, 'tipo', p_tipo, 'nome', p_nome)
  );
exception when others then
  null;  -- e-mail é best-effort: nunca derruba a conexão
end $$;
revoke all on function public.email_conexao_interno(uuid, text, text) from public, anon, authenticated;

create or replace function public.notify_conexao_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if tg_op = 'INSERT' then
    if new.status = 'pendente' then
      v_nome := public.nome_para_push(new.solicitante_id, new.solicitante_perfil_atleta_id);
      perform public.push_interno(
        array[new.destinatario_id], '🔗 Nova solicitação de conexão',
        v_nome || ' quer se conectar com você',
        '/conexoes', 'conexao_solicitada', 'conexao_solicitada'
      );
      perform public.email_conexao_interno(new.destinatario_id, 'conexao_solicitada', v_nome);
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status = 'aceita' and old.status is distinct from 'aceita' then
      v_nome := public.nome_para_push(new.destinatario_id, new.destinatario_perfil_atleta_id);
      perform public.push_interno(
        array[new.solicitante_id], '✅ Conexão aceita',
        v_nome || ' aceitou sua solicitação de conexão',
        '/conexoes', 'conexao_aceita', 'conexao_aceita'
      );
      perform public.email_conexao_interno(new.solicitante_id, 'conexao_aceita', v_nome);
    end if;
  end if;
  return new;
end $$;
