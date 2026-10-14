-- Plano anual do Premium (pagamento único de 365 dias, sem renovação automática).
-- Mudanças só de adição: as linhas atuais continuam mensais (ciclo 'mensal', 30 dias).

alter table public.carreira_assinaturas
  add column if not exists ciclo text not null default 'mensal',
  add column if not exists duracao_dias integer not null default 30,
  -- Id da última cobrança já contabilizada: impede somar o mesmo pagamento duas vezes (webhook + checagem do app,
  -- eventos CONFIRMED e RECEIVED da mesma cobrança, parcelas do cartão).
  add column if not exists ultimo_pagamento_id text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'carreira_assinaturas_ciclo_chk') then
    alter table public.carreira_assinaturas
      add constraint carreira_assinaturas_ciclo_chk check (ciclo in ('mensal', 'anual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'carreira_assinaturas_duracao_chk') then
    alter table public.carreira_assinaturas
      add constraint carreira_assinaturas_duracao_chk check (duracao_dias between 1 and 400);
  end if;
end $$;

-- Preço do anual fica em configuração (as funções leem daqui; o valor nunca vem do app).
insert into public.saas_config (chave, valor)
select 'carreira_valor_premium_anual', '120.00'
where not exists (select 1 from public.saas_config where chave = 'carreira_valor_premium_anual');

-- A trava das assinaturas passa a proteger também os campos novos contra edição pelo próprio usuário.
create or replace function public.assinaturas_protege() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_dias int;
  v_fam public.carreira_assinaturas_familia%rowtype;
begin
  if auth.uid() is null or public.eh_admin_atual() then return new; end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'Operação não permitida.' using errcode = '42501';
    end if;
    new.ciclo := 'mensal'; new.duracao_dias := 30; new.ultimo_pagamento_id := null;

    if new.status = 'trial' then
      if exists (select 1 from public.carreira_assinaturas a where a.user_id = new.user_id and a.crianca_id is not distinct from new.crianca_id) then
        raise exception 'Este atleta já teve um período de teste.' using errcode = '42501';
      end if;
      select c.dias_trial into v_dias from public.carreira_cupons c
       where c.id = new.cupom_id and c.ativo and (c.validade is null or c.validade > now());
      v_dias := coalesce(v_dias, 7);
      if new.expira_em is null or new.expira_em > now() + make_interval(days => v_dias + 1) then
        raise exception 'Duração do período de teste inválida.' using errcode = '42501';
      end if;
      new.plano := 'premium';
      new.cancelada_em := null; new.familia_id := null;
      new.gateway := null; new.gateway_subscription_id := null; new.gateway_card_token := null;
      new.card_last4 := null; new.card_brand := null;
    elsif new.status = 'ativa' and new.familia_id is not null then
      select * into v_fam from public.carreira_assinaturas_familia f
       where f.id = new.familia_id and f.user_id = auth.uid() and f.status = 'ativa';
      if not found then
        raise exception 'Plano Família não encontrado ou inativo.' using errcode = '42501';
      end if;
      if new.expira_em is not null and v_fam.expira_em is not null and new.expira_em > v_fam.expira_em then
        raise exception 'Validade acima da do plano Família.' using errcode = '42501';
      end if;
      new.plano := 'premium'; new.valor := 0;
      new.gateway := null; new.gateway_subscription_id := null; new.gateway_card_token := null;
      new.card_last4 := null; new.card_brand := null; new.cancelada_em := null;
    else
      raise exception 'Assinatura paga só é criada pelo pagamento.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: os campos sensíveis voltam ao que eram
  new.user_id := old.user_id; new.crianca_id := old.crianca_id; new.plano := old.plano; new.valor := old.valor;
  new.gateway := old.gateway; new.gateway_subscription_id := old.gateway_subscription_id; new.gateway_card_token := old.gateway_card_token;
  new.card_last4 := old.card_last4; new.card_brand := old.card_brand; new.metodo_pagamento := old.metodo_pagamento;
  new.inicio_em := old.inicio_em; new.trial_termina_em := old.trial_termina_em; new.familia_id := old.familia_id; new.cupom_id := old.cupom_id;
  new.lembrete_trial_2d_em := old.lembrete_trial_2d_em; new.lembrete_trial_expirado_em := old.lembrete_trial_expirado_em;
  new.observacoes := old.observacoes;
  new.ciclo := old.ciclo; new.duracao_dias := old.duracao_dias; new.ultimo_pagamento_id := old.ultimo_pagamento_id;
  new.renovacao_pix_para := old.renovacao_pix_para;

  if new.status is distinct from old.status and not (new.status = 'cancelada' and old.status in ('trial', 'ativa')) then
    new.status := old.status;
  end if;
  if new.status is distinct from 'cancelada' then new.cancelada_em := old.cancelada_em; end if;
  -- a validade só pode ser encurtada
  if new.expira_em is distinct from old.expira_em and (old.expira_em is null or new.expira_em is null or new.expira_em > old.expira_em) then
    new.expira_em := old.expira_em;
  end if;
  return new;
end $$;
