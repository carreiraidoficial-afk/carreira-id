-- Push de conexão pelo SERVIDOR: o banco avisa quando alguém pede para se conectar e quando a conexão é aceita,
-- por qualquer caminho do app (botão Conectar, Sugestões, aba Solicitações, link de convite).
-- A edge function send-carreira-push agora só aceita chamadas do servidor (chave de serviço ou segredo interno),
-- do admin ou de usuário logado com limites. O segredo NÃO fica no código: vive em public.segredos_internos
-- (sem acesso pela API) e na variável PUSH_INTERNAL_SECRET da edge function.

create table if not exists public.segredos_internos (
  chave text primary key,
  valor text not null
);
alter table public.segredos_internos enable row level security;
revoke all on public.segredos_internos from public, anon, authenticated;

-- Envia push chamando a edge function com o segredo interno (não faz nada se o segredo não existir).
create or replace function public.push_interno(
  p_user_ids uuid[], p_title text, p_body text, p_url text, p_tag text, p_category text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_segredo text;
begin
  select valor into v_segredo from public.segredos_internos where chave = 'push_interno';
  if v_segredo is null or coalesce(array_length(p_user_ids, 1), 0) = 0 then return; end if;
  perform net.http_post(
    url := 'https://fppsotlycinwqsjpoybg.supabase.co/functions/v1/send-carreira-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_segredo),
    body := jsonb_build_object(
      'user_ids', to_jsonb(p_user_ids), 'title', p_title, 'body', p_body,
      'url', p_url, 'tag', coalesce(p_tag, p_category, 'carreira'), 'category', p_category
    )
  );
exception when others then
  null;  -- aviso é best-effort: nunca derruba a conexão
end $$;
revoke all on function public.push_interno(uuid[], text, text, text, text, text) from public, anon, authenticated;

-- Nome que aparece no aviso (mesma regra do app: atleta primeiro, depois perfil de rede)
create or replace function public.nome_para_push(p_user uuid, p_perfil_atleta uuid default null) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nome from public.perfil_atleta where id = p_perfil_atleta),
    (select nome from public.perfil_atleta where user_id = p_user order by created_at asc limit 1),
    (select nome from public.perfis_rede where user_id = p_user order by created_at desc limit 1),
    'Alguém'
  )
$$;
revoke all on function public.nome_para_push(uuid, uuid) from public, anon, authenticated;

create or replace function public.notify_conexao_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pendente' then
      perform public.push_interno(
        array[new.destinatario_id], '🔗 Nova solicitação de conexão',
        public.nome_para_push(new.solicitante_id, new.solicitante_perfil_atleta_id) || ' quer se conectar com você',
        '/conexoes', 'conexao_solicitada', 'conexao_solicitada'
      );
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status = 'aceita' and old.status is distinct from 'aceita' then
      perform public.push_interno(
        array[new.solicitante_id], '✅ Conexão aceita',
        public.nome_para_push(new.destinatario_id, new.destinatario_perfil_atleta_id) || ' aceitou sua solicitação de conexão',
        '/conexoes', 'conexao_aceita', 'conexao_aceita'
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_conexao_push on public.rede_conexoes;
create trigger trg_notify_conexao_push
  after insert or update of status on public.rede_conexoes
  for each row execute function public.notify_conexao_push();

-- O aviso de novo cadastro (admin) também passa a usar o segredo interno
create or replace function public.notify_admin_novo_cadastro() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  admin_user_id uuid;
  tipo_label text;
begin
  select id into admin_user_id from auth.users where email = 'carreiraidoficial@gmail.com' limit 1;
  if admin_user_id is null then return new; end if;
  if tg_table_name = 'perfil_atleta' then tipo_label := 'Atleta'; else tipo_label := new.tipo; end if;
  perform public.push_interno(
    array[admin_user_id], 'Novo cadastro no Carreira ID',
    coalesce(new.nome, 'Alguém') || ' acabou de se cadastrar (' || coalesce(tipo_label, 'perfil') || ')',
    '/carreira/admin/perfis', 'novo-cadastro', null
  );
  return new;
end $$;
