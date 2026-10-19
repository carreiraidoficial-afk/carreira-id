-- Etapa 4 do cadastro de adolescente: aviso de admin e funil.

-- 1) Aviso para os administradores quando um adolescente inicia o cadastro (só o primeiro nome).
create or replace function public.notify_admin_pre_cadastro_adolescente() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
declare v_destinos uuid[] := public.admin_destinatarios_ids();
begin
  if v_destinos is null then return new; end if;
  perform public.push_interno(
    v_destinos, 'Adolescente aguardando o responsável',
    split_part(new.nome, ' ', 1) || ' (' || new.modalidade || ') iniciou o cadastro e espera a autorização do responsável.',
    '/carreira/admin/perfis', 'pre-cadastro-adolescente', null
  );
  return new;
end $fn$;
revoke all on function public.notify_admin_pre_cadastro_adolescente() from public, anon, authenticated;

drop trigger if exists trg_notify_admin_pre_cadastro_adolescente on public.pre_cadastro_adolescente;
create trigger trg_notify_admin_pre_cadastro_adolescente after insert on public.pre_cadastro_adolescente
  for each row execute function public.notify_admin_pre_cadastro_adolescente();

-- 2) Funil: o adolescente que escolhe esse caminho não é abandono. Etapa própria para não distorcer a conta.
alter table public.carreira_onboarding_funil drop constraint if exists carreira_onboarding_funil_etapa_check;
alter table public.carreira_onboarding_funil add constraint carreira_onboarding_funil_etapa_check
  check (etapa in ('tipo_perfil_exibido', 'tipo_selecionado', 'formulario_enviado', 'adolescente_pre_cadastro'));
