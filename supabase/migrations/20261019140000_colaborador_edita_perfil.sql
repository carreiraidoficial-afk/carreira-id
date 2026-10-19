-- Autonomia do atleta/colaborador: o RESPONSÁVEL pode autorizar um colaborador (ex.: o próprio adolescente, com login próprio)
-- a editar os dados "leves" do perfil: foto, banner, cor, bio, Instagram, pé dominante e posições.
-- Nome, categoria, modalidades, localização, privacidade, CPF/telefone, convites e plano continuam só com o responsável.

alter table public.perfil_atleta_colaboradores add column if not exists pode_editar_perfil boolean not null default false;

-- Só o responsável (dono do atleta) ou o admin liga/desliga a permissão. O colaborador não consegue se autopromover,
-- nem na hora de aceitar o convite.
create or replace function public.colaborador_protege_permissao() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
begin
  if auth.uid() is null or public.has_role(auth.uid(), 'admin'::user_role) then return new; end if;
  if exists (select 1 from public.perfil_atleta p where p.crianca_id = new.crianca_id and p.user_id = auth.uid()) then return new; end if;
  if tg_op = 'UPDATE' then new.pode_editar_perfil := old.pode_editar_perfil; else new.pode_editar_perfil := false; end if;
  return new;
end $fn$;
revoke all on function public.colaborador_protege_permissao() from public, anon, authenticated;
drop trigger if exists colaborador_protege_permissao on public.perfil_atleta_colaboradores;
create trigger colaborador_protege_permissao before insert or update on public.perfil_atleta_colaboradores
  for each row execute function public.colaborador_protege_permissao();

-- O colaborador autorizado pode atualizar o perfil do atleta (a trava de campos está no gatilho abaixo).
drop policy if exists "Colaborador autorizado edita dados basicos do atleta" on public.perfil_atleta;
create policy "Colaborador autorizado edita dados basicos do atleta" on public.perfil_atleta
  for update to authenticated
  using (exists (
    select 1 from public.perfil_atleta_colaboradores c
     where c.crianca_id = perfil_atleta.crianca_id and c.user_id = auth.uid() and c.status = 'ativo' and c.pode_editar_perfil))
  with check (exists (
    select 1 from public.perfil_atleta_colaboradores c
     where c.crianca_id = perfil_atleta.crianca_id and c.user_id = auth.uid() and c.status = 'ativo' and c.pode_editar_perfil));

-- Quem não é dono nem admin só consegue mudar os campos liberados; qualquer outra mudança é recusada.
-- Gatilhos de contagem (seguidores, conexões) rodam em profundidade > 1 e passam livres.
create or replace function public.perfil_atleta_limita_colaborador() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
declare v_livres text[] := array['foto_url','banner_url','cor_destaque','bio','instagram_url','pe_dominante','posicao_principal','posicao_secundaria','updated_at'];
begin
  if auth.uid() is null or pg_trigger_depth() > 1 then return new; end if;
  if old.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::user_role) then return new; end if;
  if (to_jsonb(new) - v_livres) is distinct from (to_jsonb(old) - v_livres) then
    raise exception 'Colaborador só pode alterar foto, banner, cor, bio, Instagram, pé dominante e posições do atleta.' using errcode = '42501';
  end if;
  return new;
end $fn$;
revoke all on function public.perfil_atleta_limita_colaborador() from public, anon, authenticated;
drop trigger if exists perfil_atleta_limita_colaborador on public.perfil_atleta;
create trigger perfil_atleta_limita_colaborador before update on public.perfil_atleta
  for each row execute function public.perfil_atleta_limita_colaborador();
