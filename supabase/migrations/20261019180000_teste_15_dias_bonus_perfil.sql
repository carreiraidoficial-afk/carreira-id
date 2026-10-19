-- Teste do Elite: 15 dias ao criar o perfil + 15 dias quando o perfil fica completo (total 30).
-- Quem assina durante o teste ganha pelo menos 15 dias a mais. Quem já estava no teste (ou com teste vencido) ganha +15 dias.
-- O plano Base continua gratuito para sempre; o Elite é o plano experimental/pago.

-- 1) Regra do servidor: duração padrão do teste = 15 dias (cupom com mais dias continua valendo; com menos, vale o padrão).
create or replace function public.assinaturas_protege() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_dias int;
  v_fam public.carreira_assinaturas_familia%rowtype;
begin
  -- pg_trigger_depth() > 1: alteração feita por outro gatilho do servidor (ex.: bônus de perfil completo), nunca direto pelo usuário.
  if auth.uid() is null or public.eh_admin_atual() or pg_trigger_depth() > 1 then return new; end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'Operação não permitida.' using errcode = '42501';
    end if;
    new.ciclo := 'mensal'; new.duracao_dias := 30; new.ultimo_pagamento_id := null;

    if new.status = 'trial' then
      if exists (select 1 from public.carreira_assinaturas a where a.user_id = new.user_id and a.crianca_id is not distinct from new.crianca_id) then
        raise exception 'Este atleta já teve um período de teste.' using errcode = '42501';
      end if;

      if new.cupom_id is not null then
        -- Trava: duas famílias não ficam com a última vaga do cupom ao mesmo tempo.
        perform pg_advisory_xact_lock(hashtext(new.cupom_id::text));
        select c.dias_trial into v_dias from public.carreira_cupons c
         where c.id = new.cupom_id and c.ativo and (c.validade is null or c.validade > now())
           and (c.max_usos is null or (select count(*) from public.carreira_assinaturas a where a.cupom_id = c.id) < c.max_usos);
        if v_dias is null then
          -- Cupom esgotado, vencido ou desativado: segue com o teste padrão e sem vincular o cupom.
          new.cupom_id := null;
          new.expira_em := least(coalesce(new.expira_em, now() + interval '15 days'), now() + interval '15 days');
        end if;
      end if;

      v_dias := greatest(coalesce(v_dias, 15), 15);
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

-- 2) Quem assina durante o teste: bônus mínimo de 15 dias.
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
      -- mínimo de 15 dias grátis a mais; se sobravam mais que 7 (cupom), mantém o que sobrava
      v_dias_bonus := greatest(15, floor(extract(epoch from v_resta) / 86400)::int);
      new.expira_em := new.expira_em + make_interval(days => v_dias_bonus);
    end if;
  end if;
  return new;
end $$;

-- 3) Perfil completo: bônus único de +15 dias por atleta.
create table if not exists public.carreira_bonus_perfil_completo (
  crianca_id uuid primary key,
  dias int not null,
  concedido_em timestamptz not null default now()
);
alter table public.carreira_bonus_perfil_completo enable row level security;
revoke all on public.carreira_bonus_perfil_completo from public, anon, authenticated;

-- Itens do "perfil completo" (também usados pela barra de progresso do app).
create or replace function public._perfil_completo_itens(p_crianca uuid) returns jsonb
language sql stable security definer set search_path to 'public' as $fn$
  select jsonb_build_array(
    jsonb_build_object('chave','foto','rotulo','Foto do atleta','ok', coalesce(btrim(p.foto_url),'') <> ''),
    jsonb_build_object('chave','bio','rotulo','Bio','ok', coalesce(btrim(p.bio),'') <> ''),
    jsonb_build_object('chave','categoria','rotulo','Categoria','ok', coalesce(btrim(p.categoria),'') <> ''),
    jsonb_build_object('chave','local','rotulo','Cidade e estado','ok', coalesce(btrim(p.cidade),'') <> '' and coalesce(btrim(p.estado),'') <> ''),
    jsonb_build_object('chave','posicao','rotulo','Posição','ok', coalesce(btrim(p.posicao_principal),'') <> ''),
    jsonb_build_object('chave','nascimento','rotulo','Data de nascimento','ok', c.data_nascimento is not null),
    jsonb_build_object('chave','jogo','rotulo','Pelo menos 1 jogo registrado','ok', exists (select 1 from public.carreira_jogos j where j.crianca_id = p_crianca))
  )
  from public.perfil_atleta p left join public.criancas c on c.id = p.crianca_id
  where p.crianca_id = p_crianca
  order by p.created_at limit 1
$fn$;
revoke all on function public._perfil_completo_itens(uuid) from public, anon, authenticated;

create or replace function public._conceder_bonus_perfil_completo(p_crianca uuid) returns void
language plpgsql security definer set search_path to 'public' as $fn$
declare v_itens jsonb; v_sub public.carreira_assinaturas; v_dias constant int := 15;
begin
  if p_crianca is null then return; end if;
  if exists (select 1 from public.carreira_bonus_perfil_completo where crianca_id = p_crianca) then return; end if;
  v_itens := public._perfil_completo_itens(p_crianca);
  if v_itens is null or exists (select 1 from jsonb_array_elements(v_itens) i where not (i->>'ok')::boolean) then return; end if;

  -- só quem está no teste ganha (pagantes e quem nunca teve teste não são afetados)
  select * into v_sub from public.carreira_assinaturas where crianca_id = p_crianca and status = 'trial' order by created_at desc limit 1 for update;
  if not found then return; end if;

  insert into public.carreira_bonus_perfil_completo (crianca_id, dias) values (p_crianca, v_dias) on conflict do nothing;
  update public.carreira_assinaturas
     set expira_em = greatest(coalesce(expira_em, now()), now()) + make_interval(days => v_dias),
         lembrete_trial_2d_em = null, lembrete_trial_expirado_em = null, updated_at = now()
   where id = v_sub.id;
  perform public.push_interno(array[v_sub.user_id], 'Perfil completo! +15 dias de Elite',
    'Você completou o perfil e ganhou mais 15 dias do Elite.', '/carreira/minha', 'bonus-perfil-completo', null);
end $fn$;
revoke all on function public._conceder_bonus_perfil_completo(uuid) from public, anon, authenticated;

create or replace function public._trg_bonus_perfil_atleta() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
begin perform public._conceder_bonus_perfil_completo(new.crianca_id); return new; end $fn$;
create or replace function public._trg_bonus_jogo() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
begin perform public._conceder_bonus_perfil_completo(new.crianca_id); return new; end $fn$;
create or replace function public._trg_bonus_crianca() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
begin perform public._conceder_bonus_perfil_completo(new.id); return new; end $fn$;
revoke all on function public._trg_bonus_perfil_atleta(), public._trg_bonus_jogo(), public._trg_bonus_crianca() from public, anon, authenticated;

drop trigger if exists trg_bonus_perfil_atleta on public.perfil_atleta;
create trigger trg_bonus_perfil_atleta after update of foto_url, bio, categoria, cidade, estado, posicao_principal on public.perfil_atleta
  for each row execute function public._trg_bonus_perfil_atleta();
drop trigger if exists trg_bonus_jogo on public.carreira_jogos;
create trigger trg_bonus_jogo after insert on public.carreira_jogos
  for each row execute function public._trg_bonus_jogo();
drop trigger if exists trg_bonus_crianca on public.criancas;
create trigger trg_bonus_crianca after update of data_nascimento on public.criancas
  for each row execute function public._trg_bonus_crianca();

-- Progresso do perfil para a tela: só o dono ou colaborador ativo do atleta.
create or replace function public.carreira_perfil_completo_status(p_crianca uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $fn$
declare v_itens jsonb; v_ok boolean; v_bonus public.carreira_bonus_perfil_completo; v_trial boolean;
begin
  if auth.uid() is null or not public.is_perfil_atleta_owner_or_colaborador(auth.uid(), p_crianca) then return null; end if;
  v_itens := public._perfil_completo_itens(p_crianca);
  if v_itens is null then return null; end if;
  v_ok := not exists (select 1 from jsonb_array_elements(v_itens) i where not (i->>'ok')::boolean);
  select * into v_bonus from public.carreira_bonus_perfil_completo where crianca_id = p_crianca;
  select exists (select 1 from public.carreira_assinaturas where crianca_id = p_crianca and status = 'trial') into v_trial;
  return jsonb_build_object('itens', v_itens, 'completo', v_ok, 'bonus_concedido', v_bonus.crianca_id is not null,
    'dias_bonus', 15, 'elegivel', v_trial);
end $fn$;
revoke all on function public.carreira_perfil_completo_status(uuid) from public, anon;
grant execute on function public.carreira_perfil_completo_status(uuid) to authenticated;

-- 4) Quem já estava no teste (ativo ou vencido) ganha +15 dias, uma vez. Os lembretes de fim de teste recomeçam.
do $$
declare r record;
begin
  for r in select id, user_id, crianca_id from public.carreira_assinaturas where status = 'trial' loop
    update public.carreira_assinaturas
       set expira_em = greatest(coalesce(expira_em, now()), now()) + interval '15 days',
           lembrete_trial_2d_em = null, lembrete_trial_expirado_em = null, updated_at = now()
     where id = r.id;
    perform public.push_interno(array[r.user_id], 'Mais 15 dias de Elite para você',
      'Estendemos o seu Elite por 15 dias. Complete o perfil e ganhe mais 15.', '/carreira/minha', 'extensao-15-dias', null);
  end loop;
  -- quem já tem o perfil completo e está no teste ganha o bônus agora
  for r in select distinct crianca_id from public.carreira_assinaturas where status = 'trial' and crianca_id is not null loop
    perform public._conceder_bonus_perfil_completo(r.crianca_id);
  end loop;
end $$;
