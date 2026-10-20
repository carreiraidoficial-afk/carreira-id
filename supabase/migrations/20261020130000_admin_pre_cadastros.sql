-- Acompanhamento do cadastro de adolescente no admin: quando o adolescente mandou o pedido e quando o responsável abriu o link.

alter table public.pre_cadastro_adolescente
  add column if not exists enviado_em timestamptz,
  add column if not exists link_aberto_em timestamptz,
  add column if not exists link_aberturas int not null default 0;

create or replace function public.responsavel_ver_pre_cadastro(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $fn$
declare r public.pre_cadastro_adolescente;
begin
  select * into r from public.pre_cadastro_adolescente where token_hash = public._pre_cadastro_hash(p_token);
  if not found then return jsonb_build_object('status', 'invalido'); end if;
  if r.status = 'pendente' and r.expira_em < now() then return jsonb_build_object('status', 'expirado'); end if;
  if r.status <> 'pendente' then return jsonb_build_object('status', r.status); end if;
  -- acompanhamento do funil (admin): quando o responsável abriu o link
  update public.pre_cadastro_adolescente set link_aberto_em = coalesce(link_aberto_em, now()), link_aberturas = link_aberturas + 1 where id = r.id;
  return jsonb_build_object('status', 'pendente', 'primeiro_nome', split_part(r.nome, ' ', 1),
    'modalidade', r.modalidade, 'responsavel_nome', r.responsavel_nome, 'expira_em', r.expira_em,
    'escola_nome', case when r.convite_codigo is null then null else
      (select rr.nome from public.perfis_rede rr where rr.convite_codigo = r.convite_codigo and rr.tipo = 'dono_escola' limit 1) end);
end $fn$;
revoke all on function public.responsavel_ver_pre_cadastro(text) from public;
grant execute on function public.responsavel_ver_pre_cadastro(text) to anon, authenticated;

-- O adolescente tocou em "enviar pelo WhatsApp" (não prova que a mensagem saiu, mas mostra que ele chegou até aí).
create or replace function public.adolescente_marcar_envio() returns void
language plpgsql security definer set search_path to 'public' as $fn$
begin
  if auth.uid() is null then return; end if;
  update public.pre_cadastro_adolescente set enviado_em = coalesce(enviado_em, now()), updated_at = now()
   where adolescente_user_id = auth.uid() and status = 'pendente';
end $fn$;
revoke all on function public.adolescente_marcar_envio() from public, anon;
grant execute on function public.adolescente_marcar_envio() to authenticated;

-- Painel do admin: resumo do funil e lista. Só admin. Mostra pouco do menor (primeiro nome + inicial) e o telefone do responsável mascarado.
create or replace function public.admin_pre_cadastros() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $fn$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::user_role) then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'resumo', jsonb_build_object(
      'iniciaram', (select count(*) from public.pre_cadastro_adolescente),
      'aguardando', (select count(*) from public.pre_cadastro_adolescente where status = 'pendente' and expira_em >= now()),
      'enviaram', (select count(*) from public.pre_cadastro_adolescente where enviado_em is not null),
      'responsavel_abriu', (select count(*) from public.pre_cadastro_adolescente where link_aberto_em is not null),
      'aprovados', (select count(*) from public.pre_cadastro_adolescente where status = 'aprovado'),
      'expirados', (select count(*) from public.pre_cadastro_adolescente where status = 'expirado' or (status = 'pendente' and expira_em < now())),
      'recusados', (select count(*) from public.pre_cadastro_adolescente where status = 'recusado')
    ),
    'linhas', coalesce((
      select jsonb_agg(l order by (l->>'criado_em') desc) from (
        select jsonb_build_object(
          'id', p.id,
          'nome', split_part(p.nome, ' ', 1) || ' ' || coalesce(left(nullif(split_part(p.nome, ' ', 2), ''), 1) || '.', ''),
          'idade', extract(year from age(current_date, p.data_nascimento))::int,
          'modalidade', p.modalidade,
          'categoria', p.categoria,
          'local', nullif(btrim(coalesce(p.cidade, '') || case when p.estado is not null then '/' || p.estado else '' end), ''),
          'escola', (select rr.nome from public.perfis_rede rr where p.convite_codigo is not null and rr.convite_codigo = p.convite_codigo and rr.tipo = 'dono_escola' limit 1),
          'responsavel', p.responsavel_nome,
          'telefone_mascarado', case when coalesce(p.responsavel_whatsapp, '') = '' then null else '••••' || right(p.responsavel_whatsapp, 4) end,
          'status', case when p.status = 'pendente' and p.expira_em < now() then 'expirado' else p.status end,
          'criado_em', p.created_at,
          'enviado_em', p.enviado_em,
          'link_aberto_em', p.link_aberto_em,
          'link_aberturas', p.link_aberturas,
          'anuencia_em', p.anuencia_em,
          'expira_em', p.expira_em,
          'reenvios', p.reenvios
        ) as l from public.pre_cadastro_adolescente p
      ) x
    ), '[]'::jsonb)
  );
end $fn$;
revoke all on function public.admin_pre_cadastros() from public, anon;
grant execute on function public.admin_pre_cadastros() to authenticated;
