-- Segurança, fase 2, etapa 1 (ADITIVA): funções de leitura segura de CPF/CNPJ e telefone.
-- Nada é fechado aqui. Na etapa 3 a leitura direta dessas colunas será retirada de anon/authenticated e o app
-- passará a ler por estas funções.

-- Dados privados de um atleta: dono, colaborador do atleta ou admin.
create or replace function public.perfil_atleta_privado(p_perfil_id uuid)
returns table (cpf_cnpj text, tipo_documento text, telefone_whatsapp text)
language plpgsql stable security definer set search_path to 'public' as $fn$
declare v_uid uuid := auth.uid(); v_user uuid; v_crianca uuid;
begin
  if v_uid is null then return; end if;
  select p.user_id, p.crianca_id into v_user, v_crianca from public.perfil_atleta p where p.id = p_perfil_id;
  if not found then return; end if;
  if v_user = v_uid
     or public.has_role(v_uid, 'admin'::user_role)
     or (v_crianca is not null and public.is_perfil_atleta_owner_or_colaborador(v_uid, v_crianca)) then
    return query select p.cpf_cnpj, p.tipo_documento, p.telefone_whatsapp from public.perfil_atleta p where p.id = p_perfil_id;
  end if;
end $fn$;

-- Dados privados de um perfil profissional/escola: o próprio dono ou admin.
create or replace function public.perfil_rede_privado(p_perfil_id uuid)
returns table (cpf_cnpj text, tipo_documento text, telefone_whatsapp text)
language plpgsql stable security definer set search_path to 'public' as $fn$
declare v_uid uuid := auth.uid(); v_user uuid;
begin
  if v_uid is null then return; end if;
  select r.user_id into v_user from public.perfis_rede r where r.id = p_perfil_id;
  if not found then return; end if;
  if v_user = v_uid or public.has_role(v_uid, 'admin'::user_role) then
    return query select r.cpf_cnpj, r.tipo_documento, r.telefone_whatsapp from public.perfis_rede r where r.id = p_perfil_id;
  end if;
end $fn$;

-- Contato público: só devolve o telefone de quem marcou "WhatsApp público".
create or replace function public.rede_contato_publico(p_user_ids uuid[])
returns table (user_id uuid, telefone_whatsapp text)
language sql stable security definer set search_path to 'public' as $fn$
  select r.user_id, r.telefone_whatsapp
    from public.perfis_rede r
   where r.user_id = any(p_user_ids)
     and coalesce(r.whatsapp_publico, false)
     and nullif(trim(coalesce(r.telefone_whatsapp, '')), '') is not null;
$fn$;

-- Telas de admin que listam contatos (perfis, assinaturas).
create or replace function public.admin_contatos_perfis(
  p_atleta_ids uuid[] default null, p_rede_ids uuid[] default null, p_crianca_ids uuid[] default null)
returns table (origem text, id uuid, crianca_id uuid, user_id uuid, telefone_whatsapp text, cpf_cnpj text, tipo_documento text)
language plpgsql stable security definer set search_path to 'public' as $fn$
begin
  if not public.has_role(auth.uid(), 'admin'::user_role) then
    raise exception 'apenas admin' using errcode = '42501';
  end if;
  return query
    select 'atleta'::text, p.id, p.crianca_id, p.user_id, p.telefone_whatsapp, p.cpf_cnpj, p.tipo_documento
      from public.perfil_atleta p
     where (p_atleta_ids is not null and p.id = any(p_atleta_ids))
        or (p_crianca_ids is not null and p.crianca_id = any(p_crianca_ids))
    union all
    select 'rede'::text, r.id, null::uuid, r.user_id, r.telefone_whatsapp, r.cpf_cnpj, r.tipo_documento
      from public.perfis_rede r
     where p_rede_ids is not null and r.id = any(p_rede_ids);
end $fn$;

revoke all on function public.perfil_atleta_privado(uuid) from public, anon;
revoke all on function public.perfil_rede_privado(uuid) from public, anon;
revoke all on function public.admin_contatos_perfis(uuid[], uuid[], uuid[]) from public, anon;
grant execute on function public.perfil_atleta_privado(uuid) to authenticated;
grant execute on function public.perfil_rede_privado(uuid) to authenticated;
grant execute on function public.admin_contatos_perfis(uuid[], uuid[], uuid[]) to authenticated;
grant execute on function public.rede_contato_publico(uuid[]) to anon, authenticated;
