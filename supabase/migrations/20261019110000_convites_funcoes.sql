-- Segurança, fase 2, etapa 2b (parte aditiva): o código de convite deixa de ser legível por qualquer pessoa e passa a ser
-- lido, gerado e resolvido por funções. O fechamento da coluna vem na migration seguinte, depois do app novo no ar.

-- Gera um código de 6 caracteres que ainda não existe em nenhuma das duas tabelas.
create or replace function public.gerar_codigo_convite() returns text
language plpgsql volatile security definer set search_path to 'public' as $fn$
declare v_codigo text; v_tentativas int := 0;
begin
  loop
    v_codigo := upper(substr(md5(random()::text || clock_timestamp()::text || v_tentativas::text), 1, 6));
    exit when not exists (select 1 from public.perfis_rede where convite_codigo = v_codigo)
          and not exists (select 1 from public.perfil_atleta where convite_codigo = v_codigo);
    v_tentativas := v_tentativas + 1;
    if v_tentativas > 20 then raise exception 'não foi possível gerar um código de convite'; end if;
  end loop;
  return v_codigo;
end $fn$;
revoke all on function public.gerar_codigo_convite() from public, anon, authenticated;

-- Código de convite de um perfil específico (escola, profissional ou atleta): dono ou admin. Gera na primeira vez.
create or replace function public.codigo_convite_do_perfil(p_tipo text, p_perfil_id uuid) returns text
language plpgsql security definer set search_path to 'public' as $fn$
declare v_uid uuid := auth.uid(); v_dono uuid; v_codigo text;
begin
  if v_uid is null then return null; end if;
  if p_tipo = 'rede' then
    select user_id, convite_codigo into v_dono, v_codigo from public.perfis_rede where id = p_perfil_id;
    if not found or not (v_dono = v_uid or public.has_role(v_uid, 'admin'::user_role)) then return null; end if;
    if v_codigo is null then
      v_codigo := public.gerar_codigo_convite();
      update public.perfis_rede set convite_codigo = v_codigo where id = p_perfil_id and convite_codigo is null;
      select convite_codigo into v_codigo from public.perfis_rede where id = p_perfil_id;
    end if;
    return v_codigo;
  elsif p_tipo = 'atleta' then
    select user_id, convite_codigo into v_dono, v_codigo from public.perfil_atleta where id = p_perfil_id;
    if not found or not (v_dono = v_uid or public.has_role(v_uid, 'admin'::user_role)) then return null; end if;
    if v_codigo is null then
      v_codigo := public.gerar_codigo_convite();
      update public.perfil_atleta set convite_codigo = v_codigo where id = p_perfil_id and convite_codigo is null;
      select convite_codigo into v_codigo from public.perfil_atleta where id = p_perfil_id;
    end if;
    return v_codigo;
  end if;
  return null;
end $fn$;

-- Código de convite da CONTA (o link "convide amigos"): o do perfil de rede mais recente, senão o de algum atleta;
-- se nenhum tem, gera para o perfil de rede ou, na falta dele, para o primeiro atleta. Próprio usuário ou admin.
create or replace function public.codigo_convite_da_conta(p_user_id uuid default null) returns text
language plpgsql security definer set search_path to 'public' as $fn$
declare v_uid uuid := auth.uid(); v_alvo uuid; v_rede uuid; v_atleta uuid; v_codigo text;
begin
  if v_uid is null then return null; end if;
  v_alvo := coalesce(p_user_id, v_uid);
  if v_alvo <> v_uid and not public.has_role(v_uid, 'admin'::user_role) then return null; end if;

  select id, convite_codigo into v_rede, v_codigo from public.perfis_rede where user_id = v_alvo order by created_at desc limit 1;
  if v_codigo is not null then return v_codigo; end if;
  select convite_codigo into v_codigo from public.perfil_atleta where user_id = v_alvo and convite_codigo is not null limit 1;
  if v_codigo is not null then return v_codigo; end if;

  if v_rede is not null then
    return public.codigo_convite_do_perfil('rede', v_rede);
  end if;
  select id into v_atleta from public.perfil_atleta where user_id = v_alvo order by created_at limit 1;
  if v_atleta is not null then
    return public.codigo_convite_do_perfil('atleta', v_atleta);
  end if;
  return null;
end $fn$;

-- Quem convidou: a partir do código (que a pessoa recebeu por link), devolve o perfil de rede dono dele. Só logado.
create or replace function public.resolver_convite(p_codigo text)
returns table (id uuid, user_id uuid, tipo text, nome text)
language sql stable security definer set search_path to 'public' as $fn$
  select r.id, r.user_id, r.tipo, r.nome from public.perfis_rede r
   where auth.uid() is not null and p_codigo is not null and r.convite_codigo = p_codigo limit 1;
$fn$;

revoke all on function public.codigo_convite_do_perfil(text, uuid) from public, anon;
revoke all on function public.codigo_convite_da_conta(uuid) from public, anon;
revoke all on function public.resolver_convite(text) from public, anon;
grant execute on function public.codigo_convite_do_perfil(text, uuid) to authenticated;
grant execute on function public.codigo_convite_da_conta(uuid) to authenticated;
grant execute on function public.resolver_convite(text) to authenticated;
