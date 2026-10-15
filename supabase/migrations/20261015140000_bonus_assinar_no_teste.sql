-- Quem assina durante o teste grátis ganha, no mínimo, 7 dias grátis a mais (e nunca menos do que ainda sobrava do teste).
-- Assim ninguém precisa esperar o teste acabar para assinar: a assinatura vale na hora, a cobrança é feita já, e os dias grátis não se perdem.
--  * teste com 5 dias sobrando  -> assinatura + 7 dias;
--  * teste de cupom com 25 dias sobrando -> assinatura + 25 dias (o que sobrava, que era maior que 7);
--  * teste que já acabou -> sem bônus (o teste já foi usado).
-- Continua valendo: isenção do admin e linhas satélite do plano Família ficam de fora (só encerram o teste).

create or replace function public.carreira_assinatura_converte_trial() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_resta interval;
  v_dias_bonus int;
begin
  if new.status <> 'ativa' or new.crianca_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'ativa' then return new; end if;
  if new.metodo_pagamento = 'isento' then return new; end if;

  select greatest(max(t.expira_em) - now(), interval '0') into v_resta
  from public.carreira_assinaturas t
  where t.crianca_id = new.crianca_id and t.status = 'trial' and t.id is distinct from new.id;

  if v_resta is not null then
    update public.carreira_assinaturas
       set status = 'cancelada', cancelada_em = now()
     where crianca_id = new.crianca_id and status = 'trial' and id is distinct from new.id;

    if new.familia_id is null and v_resta > interval '0' and new.expira_em is not null then
      -- mínimo de 7 dias grátis a mais; se sobravam mais que 7 (cupom), mantém o que sobrava
      v_dias_bonus := greatest(7, floor(extract(epoch from v_resta) / 86400)::int);
      new.expira_em := new.expira_em + make_interval(days => v_dias_bonus);
    end if;
  end if;
  return new;
end $$;

-- O nome do plano pago passa a ser Elite (só o rótulo; o identificador interno continua 'premium').
update public.carreira_planos_config set nome = 'Elite' where plano = 'premium';
