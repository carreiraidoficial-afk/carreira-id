-- "Visitas" (quem viu o perfil) vira recurso do Premium, imposto no servidor.
--  * Premium (e teste de 7 dias): vê quem visitou (flag carreira_planos_config.ver_views do plano premium).
--  * Base: vê só QUANTAS pessoas visitaram nos últimos 30 dias (sem identidade), como convite ao Premium.
-- Quem visitou continua podendo ler os próprios registros; o admin lê tudo (Modo Suporte).

create or replace function public.carreira_pode_ver_visitas(p_perfil_atleta_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_dono uuid;
  v_crianca uuid;
  v_flag boolean;
begin
  if public.eh_admin_atual() then return true; end if;
  select user_id, crianca_id into v_dono, v_crianca from perfil_atleta where id = p_perfil_atleta_id;
  if v_dono is null or v_dono is distinct from auth.uid() then return false; end if;
  if not public.carreira_atleta_e_premium(v_crianca, auth.uid()) then return false; end if;
  select c.ver_views into v_flag from carreira_planos_config c where c.plano = 'premium';
  return coalesce(v_flag, true);
end;
$function$;

-- Resumo para o dono do perfil: total de visitantes distintos em 30 dias e se pode ver a lista.
create or replace function public.perfil_visualizacoes_resumo(p_perfil_atleta_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_dono uuid;
  v_total integer;
begin
  select user_id into v_dono from perfil_atleta where id = p_perfil_atleta_id;
  if v_dono is null or (v_dono is distinct from auth.uid() and not public.eh_admin_atual()) then
    return jsonb_build_object('total', 0, 'pode_ver', false);
  end if;
  select count(distinct viewer_user_id)::integer into v_total
  from perfil_visualizacoes
  where perfil_atleta_id = p_perfil_atleta_id
    and viewer_user_id is distinct from v_dono
    and created_at >= now() - interval '30 days';
  return jsonb_build_object('total', v_total, 'pode_ver', public.carreira_pode_ver_visitas(p_perfil_atleta_id));
end;
$function$;

revoke execute on function public.carreira_pode_ver_visitas(uuid) from public, anon;
grant execute on function public.carreira_pode_ver_visitas(uuid) to authenticated;
revoke execute on function public.perfil_visualizacoes_resumo(uuid) from public, anon;
grant execute on function public.perfil_visualizacoes_resumo(uuid) to authenticated;

drop policy if exists "Owner or viewer can read profile views" on public.perfil_visualizacoes;
create policy "Viewer or premium owner can read profile views" on public.perfil_visualizacoes
  for select to authenticated
  using (viewer_user_id = auth.uid() or public.carreira_pode_ver_visitas(perfil_atleta_id));
