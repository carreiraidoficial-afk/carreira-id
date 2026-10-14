-- Proteção das assinaturas contra edição pelo próprio usuário.
-- Antes: a política "Users can update own subscriptions" não limitava campos, e "Users can create own subscriptions"
-- aceitava qualquer status. Um usuário logado podia, pela API, virar Premium de graça (status 'ativa', validade longínqua).
-- Agora (quem não é admin nem o servidor):
--   INSERT: só (a) trial dentro do prazo (7 dias ou os dias de um cupom válido), uma vez por atleta, ou
--           (b) vaga de família do plano Família ativo do próprio responsável. Nada de 'ativa' sem pagamento.
--   UPDATE: só cancelar (trial/ativa -> cancelada) e/ou ENCURTAR a validade. Plano, valor, gateway, cupom etc. ficam como estavam.
-- O servidor (edge functions com chave de serviço, auth.uid() nulo) e o admin continuam livres: é por onde entram os pagamentos.

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

drop trigger if exists assinaturas_protege on public.carreira_assinaturas;
create trigger assinaturas_protege before insert or update on public.carreira_assinaturas
  for each row execute function public.assinaturas_protege();

-- A edição da própria linha não pode trocar de dono
drop policy if exists "Users can update own subscriptions" on public.carreira_assinaturas;
create policy "Users can update own subscriptions" on public.carreira_assinaturas
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Plano Família: o app só lê; quem grava é o servidor (pagamento). Some a escrita direta do usuário.
drop policy if exists "Responsavel cria a propria assinatura familia" on public.carreira_assinaturas_familia;
drop policy if exists "Responsavel atualiza a propria assinatura familia" on public.carreira_assinaturas_familia;
