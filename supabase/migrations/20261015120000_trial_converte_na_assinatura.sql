-- O teste grátis só termina quando o pagamento é CONFIRMADO, e os dias que sobravam do teste não se perdem.
-- Antes: gerar o PIX ou enviar o cartão cancelava o teste na hora, antes de qualquer pagamento (quem desistia ficava sem o teste),
-- e quem assinava no 2o dia perdia os 5 dias restantes.
-- Agora, quando uma assinatura vira 'ativa' (webhook, checagem do app ou cartão aprovado na hora):
--   * os testes do mesmo atleta passam a 'cancelada' (já cumpriram o papel);
--   * os dias que ainda sobravam do teste são somados à validade da nova assinatura.
-- Fica de fora: isenção dada pelo admin (metodo 'isento') e linhas satélite do plano Família (só cancela o teste, sem somar dias).

create or replace function public.carreira_assinatura_converte_trial() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_resta interval;
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
      -- só soma dias inteiros que sobravam do teste
      new.expira_em := new.expira_em + make_interval(days => floor(extract(epoch from v_resta) / 86400)::int);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists carreira_assinatura_converte_trial on public.carreira_assinaturas;
create trigger carreira_assinatura_converte_trial
  before insert or update of status on public.carreira_assinaturas
  for each row execute function public.carreira_assinatura_converte_trial();
