-- Quem recebe os avisos de admin (novo cadastro, e-mail aguardando aprovação). Antes o destino era uma conta fixa no código,
-- que não tinha aparelho com push. Agora é uma lista no banco: trocar o destinatário é um INSERT/UPDATE, sem mexer em função.
-- Os destinatários entram direto no banco (nenhum e-mail fica gravado no repositório, que é público).

create table if not exists public.carreira_admin_destinatarios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ativo boolean not null default true,
  observacao text,
  created_at timestamptz not null default now()
);

alter table public.carreira_admin_destinatarios enable row level security;

drop policy if exists "Admin gerencia os destinatarios dos avisos" on public.carreira_admin_destinatarios;
create policy "Admin gerencia os destinatarios dos avisos" on public.carreira_admin_destinatarios
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::user_role))
  with check (public.has_role(auth.uid(), 'admin'::user_role));

-- Ids dos destinatários ativos; sem nenhum cadastrado, cai na conta oficial como antes.
create or replace function public.admin_destinatarios_ids() returns uuid[]
language plpgsql security definer set search_path to 'public' as $fn$
declare v_ids uuid[];
begin
  select array_agg(user_id) into v_ids from public.carreira_admin_destinatarios where ativo;
  if v_ids is null or array_length(v_ids, 1) = 0 then
    select array_agg(id) into v_ids from auth.users where email = 'carreiraidoficial@gmail.com';
  end if;
  return v_ids;
end $fn$;

create or replace function public.notify_admin_novo_cadastro() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_destinos uuid[] := public.admin_destinatarios_ids();
  tipo_label text;
begin
  if v_destinos is null then return new; end if;
  if tg_table_name = 'perfil_atleta' then tipo_label := 'Atleta'; else tipo_label := new.tipo; end if;
  perform public.push_interno(
    v_destinos, 'Novo cadastro no Carreira ID',
    coalesce(new.nome, 'Alguém') || ' acabou de se cadastrar (' || coalesce(tipo_label, 'perfil') || ')',
    '/carreira/admin/perfis', 'novo-cadastro', null
  );
  return new;
end $fn$;

-- Antes chamava a função de push com a chave pública, que ela recusa desde que passou a exigir autenticação.
create or replace function public.notify_admin_email_pendente_aprovacao() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
declare v_destinos uuid[] := public.admin_destinatarios_ids();
begin
  if v_destinos is null then return new; end if;
  perform public.push_interno(
    v_destinos, 'E-mail aguardando sua aprovação',
    'Um e-mail do tipo "' || new.tipo_email || '" está esperando revisão antes de ser enviado.',
    '/carreira/admin', 'email-pendente', null
  );
  return new;
end $fn$;
