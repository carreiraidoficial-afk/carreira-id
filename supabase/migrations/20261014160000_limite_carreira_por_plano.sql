-- Limite mensal de registros de Carreira (atividades externas) passa a seguir o plano de verdade.
-- Antes: qualquer plano pago (inclusive 'premium') caía num limite fixo de 3 por mês, e quem estava em teste de
-- 7 dias era tratado como Base. Agora:
--   * assinatura ativa (e dentro da validade) ou teste dentro do prazo = plano Premium;
--   * o limite do Premium vem de carreira_planos_config.carreira_mes (9999 ou mais = ilimitado);
--   * o limite do Base continua vindo de saas_config.carreira_limite_free (2 hoje), para não tirar nada de quem é grátis.
--     (A tela de planos promete 1 por mês: decisão pendente, ver docs/REGRAS-DE-PLANOS.md.)
-- O plano é da criança (como no app): vale a assinatura/teste do atleta, não só de quem está vendo.

create or replace function public.check_carreira_atividade_limit(p_user_id uuid, p_crianca_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_plano text := 'base';
  v_limite integer;
  v_count integer;
  v_has_whitelist boolean;
  v_sub record;
begin
  -- Acesso antigo liberado manualmente (lista de exceções): sem limite.
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
    and s.status in ('ativa', 'trial')
    and (s.expira_em is null or s.expira_em > now())
  order by s.created_at desc
  limit 1;

  if found and (v_sub.status = 'trial' or v_sub.plano in ('premium', 'competidor', 'elite', 'mensal', 'pro_mensal')) then
    v_plano := 'premium';
    select c.carreira_mes into v_limite from carreira_planos_config c where c.plano = 'premium';

    -- Sem configuração, ou 9999 e acima: ilimitado.
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

  -- Base (grátis)
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
