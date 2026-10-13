-- Denúncia de conteúdo pelos usuários (exigência de apps com conteúdo gerado por usuários).
-- O usuário denuncia pela função denunciar_conteudo (não insere direto); o admin trata pelas funções admin_*.

create table if not exists public.denuncias_conteudo (
  id uuid primary key default gen_random_uuid(),
  denunciante_id uuid not null,
  tipo_conteudo text not null check (tipo_conteudo in ('post', 'comentario', 'perfil_atleta', 'perfil_rede')),
  conteudo_id uuid not null,
  autor_id uuid,                         -- dono do conteúdo denunciado (user_id), quando conhecido
  motivo text not null check (motivo in ('spam', 'assedio', 'conteudo_sexual', 'violencia', 'info_falsa', 'menor_exposto', 'outro')),
  detalhes text check (detalhes is null or char_length(detalhes) <= 500),
  trecho text,                           -- cópia do texto na hora da denúncia (o conteúdo pode ser apagado depois)
  status text not null default 'pendente' check (status in ('pendente', 'procedente', 'improcedente')),
  acao_tomada text,                      -- 'conteudo_removido', 'mantido', ...
  nota_admin text,
  revisado_por uuid,
  revisado_em timestamptz,
  created_at timestamptz not null default now(),
  unique (denunciante_id, tipo_conteudo, conteudo_id)
);
create index if not exists denuncias_status_idx on public.denuncias_conteudo (status, created_at desc);
create index if not exists denuncias_conteudo_idx on public.denuncias_conteudo (tipo_conteudo, conteudo_id);

alter table public.denuncias_conteudo enable row level security;

-- Admin vê e trata tudo; o denunciante só enxerga as próprias (para mostrar "já denunciado").
create policy "Admin gerencia denuncias" on public.denuncias_conteudo
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::user_role))
  with check (public.has_role(auth.uid(), 'admin'::user_role));

create policy "Usuario ve as proprias denuncias" on public.denuncias_conteudo
  for select to authenticated
  using (denunciante_id = auth.uid());

-- Registra uma denúncia. Valida o conteúdo, impede denunciar a si mesmo e repetir a mesma denúncia.
create or replace function public.denunciar_conteudo(
  p_tipo text, p_conteudo_id uuid, p_motivo text, p_detalhes text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_autor uuid;
  v_trecho text;
begin
  if v_uid is null then
    raise exception 'entre na sua conta para denunciar' using errcode = '28000';
  end if;

  if p_tipo = 'post' then
    select coalesce(a.user_id, r.user_id, p.criado_por), left(coalesce(p.titulo || ' - ', '') || p.texto, 500)
      into v_autor, v_trecho
      from posts_atleta p
      left join perfil_atleta a on a.id = p.autor_id
      left join perfis_rede r on r.id = p.perfil_rede_id
     where p.id = p_conteudo_id;
  elsif p_tipo = 'comentario' then
    select c.user_id, left(c.texto, 500) into v_autor, v_trecho from post_comentarios c where c.id = p_conteudo_id;
  elsif p_tipo = 'perfil_atleta' then
    select a.user_id, left(coalesce(a.nome, '') || ' - ' || coalesce(a.bio, ''), 500) into v_autor, v_trecho
      from perfil_atleta a where a.id = p_conteudo_id;
  elsif p_tipo = 'perfil_rede' then
    select r.user_id, left(coalesce(r.nome, '') || ' - ' || coalesce(r.bio, ''), 500) into v_autor, v_trecho
      from perfis_rede r where r.id = p_conteudo_id;
  else
    raise exception 'tipo de conteudo invalido';
  end if;

  if v_trecho is null then
    raise exception 'conteudo nao encontrado';
  end if;
  if v_autor = v_uid then
    raise exception 'voce nao pode denunciar o proprio conteudo';
  end if;

  insert into public.denuncias_conteudo (denunciante_id, tipo_conteudo, conteudo_id, autor_id, motivo, detalhes, trecho)
  values (v_uid, p_tipo, p_conteudo_id, v_autor, p_motivo, nullif(trim(p_detalhes), ''), v_trecho)
  on conflict (denunciante_id, tipo_conteudo, conteudo_id) do nothing;

  return jsonb_build_object('ok', true);
end $$;

-- Lista para o admin: uma linha por denúncia, com nomes e quantas denúncias o mesmo conteúdo já recebeu.
create or replace function public.admin_listar_denuncias(p_status text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::user_role) then
    raise exception 'acesso restrito ao admin' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select d.id, d.tipo_conteudo, d.conteudo_id, d.motivo, d.detalhes, d.trecho, d.status, d.acao_tomada, d.nota_admin,
        d.revisado_em, d.created_at, d.autor_id, d.denunciante_id,
        (select p.nome from profiles p where p.user_id = d.denunciante_id limit 1) as denunciante_nome,
        (select p.nome from profiles p where p.user_id = d.autor_id limit 1) as autor_nome,
        (select count(*) from denuncias_conteudo o where o.tipo_conteudo = d.tipo_conteudo and o.conteudo_id = d.conteudo_id) as total_do_conteudo,
        case d.tipo_conteudo
          when 'post' then exists (select 1 from posts_atleta p where p.id = d.conteudo_id)
          when 'comentario' then exists (select 1 from post_comentarios c where c.id = d.conteudo_id)
          when 'perfil_atleta' then exists (select 1 from perfil_atleta a where a.id = d.conteudo_id)
          else exists (select 1 from perfis_rede r where r.id = d.conteudo_id)
        end as conteudo_existe,
        (select a.slug from perfil_atleta a where d.tipo_conteudo = 'perfil_atleta' and a.id = d.conteudo_id) as perfil_slug
      from denuncias_conteudo d
      where p_status is null or d.status = p_status
      limit 500
    ) x
  ), '[]'::jsonb);
end $$;

-- Decide uma denúncia. Se remover = true, apaga o post/comentário e fecha todas as denúncias do mesmo conteúdo.
create or replace function public.admin_resolver_denuncia(
  p_id uuid, p_procedente boolean, p_remover boolean default false, p_nota text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_d denuncias_conteudo%rowtype;
  v_acao text := 'mantido';
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::user_role) then
    raise exception 'acesso restrito ao admin' using errcode = '42501';
  end if;
  select * into v_d from denuncias_conteudo where id = p_id;
  if not found then raise exception 'denuncia nao encontrada'; end if;

  if p_procedente and p_remover then
    if v_d.tipo_conteudo = 'post' then
      delete from post_comentarios where post_id = v_d.conteudo_id;
      delete from post_likes where post_id = v_d.conteudo_id;
      delete from posts_atleta where id = v_d.conteudo_id;
      v_acao := 'conteudo_removido';
    elsif v_d.tipo_conteudo = 'comentario' then
      delete from post_comentarios where id = v_d.conteudo_id;
      v_acao := 'conteudo_removido';
    end if;
  end if;

  -- a mesma decisão vale para todas as denúncias pendentes do mesmo conteúdo
  update denuncias_conteudo
     set status = case when p_procedente then 'procedente' else 'improcedente' end,
         acao_tomada = v_acao, nota_admin = nullif(trim(p_nota), ''), revisado_por = auth.uid(), revisado_em = now()
   where tipo_conteudo = v_d.tipo_conteudo and conteudo_id = v_d.conteudo_id and status = 'pendente';

  return jsonb_build_object('ok', true, 'acao', v_acao);
end $$;

revoke all on function public.denunciar_conteudo(text, uuid, text, text), public.admin_listar_denuncias(text),
  public.admin_resolver_denuncia(uuid, boolean, boolean, text) from public, anon;
grant execute on function public.denunciar_conteudo(text, uuid, text, text), public.admin_listar_denuncias(text),
  public.admin_resolver_denuncia(uuid, boolean, boolean, text) to authenticated;
