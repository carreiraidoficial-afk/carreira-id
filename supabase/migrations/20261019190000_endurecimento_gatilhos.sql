-- Revisão geral de 19/10/2026.
-- 1) Gatilhos "de bônus" e de aviso nunca podem impedir o cadastro de dados: se algo falhar neles, o registro principal segue.
-- 2) A lista de ids dos administradores não pode ser consultada por visitante nem por usuário logado (só os gatilhos do servidor usam).

create or replace function public._trg_bonus_perfil_atleta() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
begin
  begin perform public._conceder_bonus_perfil_completo(new.crianca_id);
  exception when others then raise warning 'bonus perfil completo (perfil_atleta): %', sqlerrm; end;
  return new;
end $fn$;

create or replace function public._trg_bonus_jogo() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
begin
  begin perform public._conceder_bonus_perfil_completo(new.crianca_id);
  exception when others then raise warning 'bonus perfil completo (jogo): %', sqlerrm; end;
  return new;
end $fn$;

create or replace function public._trg_bonus_crianca() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
begin
  begin perform public._conceder_bonus_perfil_completo(new.id);
  exception when others then raise warning 'bonus perfil completo (crianca): %', sqlerrm; end;
  return new;
end $fn$;

create or replace function public.notify_admin_pre_cadastro_adolescente() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
declare v_destinos uuid[];
begin
  begin
    v_destinos := public.admin_destinatarios_ids();
    if v_destinos is not null then
      perform public.push_interno(
        v_destinos, 'Adolescente aguardando o responsável',
        split_part(new.nome, ' ', 1) || ' (' || new.modalidade || ') iniciou o cadastro e espera a autorização do responsável.',
        '/carreira/admin/perfis', 'pre-cadastro-adolescente', null
      );
    end if;
  exception when others then raise warning 'aviso admin pre-cadastro: %', sqlerrm; end;
  return new;
end $fn$;

revoke all on function public.admin_destinatarios_ids() from public, anon, authenticated;
