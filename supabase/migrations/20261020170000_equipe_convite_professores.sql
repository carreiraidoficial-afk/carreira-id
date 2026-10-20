-- Convite de professores: o dono da escola manda um link; o profissional cria (ou usa) o perfil de professor/técnico/preparador
-- e fica PENDENTE na equipe técnica da escola até o dono confirmar. Quem pede nunca entra direto: só o dono confirma.

create or replace function public.equipe_solicitar_entrada(p_escola_slug text) returns jsonb
language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_uid uuid := auth.uid();
  v_esc record;
  v_me record;
  v_ex record;
  v_funcao text;
begin
  if v_uid is null then raise exception 'Faça login para continuar.' using errcode = '42501'; end if;

  select id, user_id, nome into v_esc from public.perfis_rede where slug = p_escola_slug and tipo = 'dono_escola' limit 1;
  if not found then raise exception 'Escola não encontrada.'; end if;
  if v_esc.user_id = v_uid then raise exception 'Você é o dono desta escola.'; end if;

  select id, tipo, nome into v_me from public.perfis_rede
   where user_id = v_uid and tipo in ('professor', 'tecnico', 'preparador_fisico') order by created_at desc limit 1;
  if not found then raise exception 'Crie primeiro um perfil de professor, técnico ou preparador físico.'; end if;

  select id, status into v_ex from public.escola_equipe where escola_perfil_id = v_esc.id and membro_perfil_id = v_me.id limit 1;
  if found then
    return jsonb_build_object('status', v_ex.status, 'escola', v_esc.nome, 'ja_existia', true);
  end if;

  v_funcao := case v_me.tipo when 'professor' then 'Professor(a)' when 'tecnico' then 'Técnico(a)' else 'Preparador(a) físico(a)' end;
  insert into public.escola_equipe (escola_perfil_id, membro_perfil_id, funcao, status, origem)
  values (v_esc.id, v_me.id, v_funcao, 'pendente', 'convite');
  return jsonb_build_object('status', 'pendente', 'escola', v_esc.nome, 'ja_existia', false);
end $fn$;
revoke all on function public.equipe_solicitar_entrada(text) from public, anon;
grant execute on function public.equipe_solicitar_entrada(text) to authenticated;

-- Aviso ao dono da escola quando chega um pedido (não bloqueia nada se falhar).
create or replace function public.notify_equipe_pedido() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
declare v_dono uuid; v_nome text;
begin
  if new.status <> 'pendente' or new.membro_perfil_id is null then return new; end if;
  begin
    select user_id into v_dono from public.perfis_rede where id = new.escola_perfil_id;
    select nome into v_nome from public.perfis_rede where id = new.membro_perfil_id;
    if v_dono is not null then
      perform public.push_interno(array[v_dono], 'Novo pedido para a equipe técnica',
        coalesce(v_nome, 'Um profissional') || ' pediu para entrar na equipe da sua escola. Confirme no perfil da escola.',
        '/carreira/minha', 'equipe-pedido', null);
    end if;
  exception when others then raise warning 'aviso pedido equipe: %', sqlerrm; end;
  return new;
end $fn$;
revoke all on function public.notify_equipe_pedido() from public, anon, authenticated;
drop trigger if exists trg_notify_equipe_pedido on public.escola_equipe;
create trigger trg_notify_equipe_pedido after insert on public.escola_equipe
  for each row execute function public.notify_equipe_pedido();
