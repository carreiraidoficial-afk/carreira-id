-- Regras de plano (decididas em 14/10/2026):
--  * Base: 1 registro de Carreira por mês (antes o banco aplicava 2; a tela já dizia 1).
--  * Base: 1 registro da Jornada por mês (campeonato novo). Premium e teste de 7 dias: ilimitado.
-- O limite da Jornada vem de carreira_planos_config.jornada_mes (9999 ou mais = ilimitado) e é imposto no servidor.

update public.saas_config set valor = '1' where chave = 'carreira_limite_free';

-- O atleta tem Premium? (assinatura ativa dentro da validade, teste dentro do prazo, ou lista de exceções do usuário)
create or replace function public.carreira_atleta_e_premium(p_crianca_id uuid, p_user_id uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if p_user_id is not null and exists (
    select 1 from atividades_externas_whitelist w
    where (w.user_id = p_user_id or w.user_email = (select email from auth.users where id = p_user_id))
      and w.ativo = true and (w.expires_at is null or w.expires_at > now())
  ) then
    return true;
  end if;

  return exists (
    select 1 from carreira_assinaturas s
    where s.crianca_id = p_crianca_id
      and s.status in ('ativa', 'trial')
      and (s.expira_em is null or s.expira_em > now())
      and (s.status = 'trial' or s.plano in ('premium', 'competidor', 'elite', 'mensal', 'pro_mensal'))
  );
end;
$function$;

-- Limite mensal de campeonatos da Jornada do atleta. Mesmo formato de resposta de check_carreira_atividade_limit.
create or replace function public.check_carreira_jornada_limit(p_crianca_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_premium boolean;
  v_limite integer;
  v_count integer;
begin
  v_premium := public.carreira_atleta_e_premium(p_crianca_id, auth.uid());
  select c.jornada_mes into v_limite from carreira_planos_config c where c.plano = case when v_premium then 'premium' else 'base' end;

  if v_limite is null then v_limite := case when v_premium then 9999 else 1 end; end if;

  if v_limite >= 9999 then
    return jsonb_build_object('status', 'subscribed', 'source', case when v_premium then 'carreira_subscription' else 'freemium' end,
                              'plano', case when v_premium then 'premium' else 'base' end, 'count', 0, 'limit', 0);
  end if;

  select count(*)::integer into v_count
  from carreira_campeonatos
  where crianca_id = p_crianca_id and created_at >= date_trunc('month', now());

  return jsonb_build_object(
    'status', case when v_count >= v_limite then 'limit_reached' else 'allowed' end,
    'source', case when v_premium then 'carreira_subscription' else 'freemium' end,
    'plano', case when v_premium then 'premium' else 'base' end,
    'count', v_count, 'limit', v_limite);
end;
$function$;

revoke execute on function public.check_carreira_jornada_limit(uuid) from public, anon;
grant execute on function public.check_carreira_jornada_limit(uuid) to authenticated;
revoke execute on function public.carreira_atleta_e_premium(uuid, uuid) from public, anon, authenticated;

-- Trava no servidor: quem chama a API direto também respeita o limite. Admin e servidor passam.
create or replace function public.carreira_campeonatos_limite() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or public.eh_admin_atual() then return new; end if;
  if (public.check_carreira_jornada_limit(new.crianca_id) ->> 'status') = 'limit_reached' then
    raise exception 'LIMITE_JORNADA: o plano Base permite registrar poucos campeonatos por mês. Assine o Premium para registrar sem limite.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists carreira_campeonatos_limite on public.carreira_campeonatos;
create trigger carreira_campeonatos_limite before insert on public.carreira_campeonatos
  for each row execute function public.carreira_campeonatos_limite();
