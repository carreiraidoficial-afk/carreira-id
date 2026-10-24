-- Cancelar a assinatura NÃO tira mais o Elite na hora: quem cancela já pagou o período e continua com o plano até a validade.
-- Novo status "cancelada_vigente" = cancelada pela pessoa, sem novas cobranças, com acesso até expira_em. Reembolso e chargeback
-- continuam usando "cancelada" com a validade encerrada (sem acesso). Quando a validade passa, o status volta a "cancelada".
alter table public.carreira_assinaturas drop constraint if exists carreira_assinaturas_status_check;
alter table public.carreira_assinaturas add constraint carreira_assinaturas_status_check
  check (status = any (array['ativa','trial','cancelada','expirada','pendente','recusada','inadimplente','cancelada_vigente']));

CREATE OR REPLACE FUNCTION public.carreira_atleta_e_premium(p_crianca_id uuid, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and s.status in ('ativa', 'trial', 'cancelada_vigente')
      and (s.expira_em is null or s.expira_em > now())
      and (s.status = 'trial' or s.plano in ('premium', 'competidor', 'elite', 'mensal', 'pro_mensal'))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_carreira_atividade_limit(p_user_id uuid, p_crianca_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_plano text := 'base';
  v_limite integer;
  v_count integer;
  v_has_whitelist boolean;
  v_sub record;
begin
  -- Acesso antigo liberado manualmente (lista de exceÃ§Ãµes): sem limite.
  select exists (
    select 1 from atividades_externas_whitelist
    where (user_id = p_user_id or user_email = (select email from auth.users where id = p_user_id))
      and ativo = true
      and (expires_at is null or expires_at > now())
  ) into v_has_whitelist;

  if v_has_whitelist then
    return jsonb_build_object('status', 'allowed', 'source', 'legacy_access', 'plano', 'elite', 'count', 0, 'limit', 0);
  end if;

  -- Assinatura paga ativa ou teste dentro do prazo, do atleta.
  select s.status, s.plano into v_sub
  from carreira_assinaturas s
  where s.crianca_id = p_crianca_id
    and s.status in ('ativa', 'trial', 'cancelada_vigente')
    and (s.expira_em is null or s.expira_em > now())
  order by s.created_at desc
  limit 1;

  if found and (v_sub.status = 'trial' or v_sub.plano in ('premium', 'competidor', 'elite', 'mensal', 'pro_mensal')) then
    v_plano := 'premium';
    select c.carreira_mes into v_limite from carreira_planos_config c where c.plano = 'premium';

    -- Sem configuraÃ§Ã£o, ou 9999 e acima: ilimitado.
    if v_limite is null or v_limite >= 9999 then
      return jsonb_build_object('status', 'subscribed', 'source', 'carreira_subscription', 'plano', 'premium', 'count', 0, 'limit', 0);
    end if;

    select count(*)::integer into v_count
    from atividades_externas
    where crianca_id = p_crianca_id and criado_por = p_user_id and created_at >= date_trunc('month', now());

    if v_count >= v_limite then
      return jsonb_build_object('status', 'limit_reached', 'source', 'carreira_subscription', 'plano', 'premium', 'count', v_count, 'limit', v_limite);
    end if;
    return jsonb_build_object('status', 'allowed', 'source', 'carreira_subscription', 'plano', 'premium', 'count', v_count, 'limit', v_limite);
  end if;

  -- Base (grÃ¡tis)
  select coalesce((select valor::integer from saas_config where chave = 'carreira_limite_free'), 1) into v_limite;

  select count(*)::integer into v_count
  from atividades_externas
  where crianca_id = p_crianca_id and criado_por = p_user_id and created_at >= date_trunc('month', now());

  if v_count >= v_limite then
    return jsonb_build_object('status', 'limit_reached', 'source', 'freemium', 'plano', 'base', 'count', v_count, 'limit', v_limite);
  end if;
  return jsonb_build_object('status', 'allowed', 'source', 'freemium', 'plano', 'base', 'count', v_count, 'limit', v_limite);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_premium_crianca_ids(p_crianca_ids uuid[])
 RETURNS TABLE(crianca_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ca.crianca_id
  FROM carreira_assinaturas ca
  WHERE ca.crianca_id = ANY(p_crianca_ids)
    AND ca.status in ('ativa', 'trial', 'cancelada_vigente')
    AND (ca.expira_em IS NULL OR ca.expira_em > now());
$function$;

CREATE OR REPLACE FUNCTION public.has_atividades_externas_access(check_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_modo text;
  v_user_email text;
  v_atleta_isento boolean := false;
BEGIN
  SELECT valor INTO v_modo FROM saas_config WHERE chave = 'atividades_externas_modo';
  IF v_modo = 'desativado' OR v_modo IS NULL THEN RETURN false; END IF;
  IF v_modo = 'beta' THEN RETURN true; END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = check_user_id;

  SELECT EXISTS (
    SELECT 1 FROM atividades_externas_whitelist
    WHERE (user_id = check_user_id OR user_email = v_user_email)
    AND ativo = true
    AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_atleta_isento;

  IF v_atleta_isento THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM carreira_assinaturas
    WHERE user_id = check_user_id AND status in ('ativa', 'cancelada_vigente')
    AND (expira_em IS NULL OR expira_em > now())
  ) THEN
    RETURN true;
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_atividades_externas_access_for_child(check_user_id uuid, check_crianca_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_modo text;
  v_user_email text;
  v_atleta_isento boolean := false;
BEGIN
  SELECT valor INTO v_modo FROM saas_config WHERE chave = 'atividades_externas_modo';
  IF v_modo = 'desativado' OR v_modo IS NULL THEN RETURN false; END IF;
  IF v_modo = 'beta' THEN RETURN true; END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = check_user_id;

  SELECT EXISTS (
    SELECT 1 FROM atividades_externas_whitelist
    WHERE (user_id = check_user_id OR user_email = v_user_email)
    AND ativo = true
    AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_atleta_isento;

  IF v_atleta_isento THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM carreira_assinaturas
    WHERE user_id = check_user_id
    AND crianca_id = check_crianca_id
    AND status in ('ativa', 'cancelada_vigente')
    AND (expira_em IS NULL OR expira_em > now())
  ) THEN
    RETURN true;
  END IF;

  RETURN true;
END;
$function$;


-- Depois da validade, o cancelado vigente vira cancelado de vez (o acesso já acaba sozinho pela data; isto só mantém o status verdadeiro).
create or replace function public.expirar_trials_carreira()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
  v_cancel integer;
begin
  update public.carreira_assinaturas
  set status = 'expirada'
  where status = 'trial'
    and trial_termina_em is not null
    and trial_termina_em < now();
  get diagnostics v_count = row_count;

  update public.carreira_assinaturas
  set status = 'cancelada'
  where status = 'cancelada_vigente'
    and expira_em is not null
    and expira_em < now();
  get diagnostics v_cancel = row_count;

  return v_count + v_cancel;
end;
$function$;
