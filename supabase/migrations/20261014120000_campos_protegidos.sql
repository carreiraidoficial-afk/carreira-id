-- Campos que o próprio dono do perfil/post NÃO deve conseguir editar pela API:
--  * status_conta (perfil_atleta, perfis_rede): o admin suspende; o dono não pode se reativar sozinho.
--  * followers_count (perfil_atleta), likes_count e comments_count (posts_atleta): são mantidos pelos gatilhos do servidor;
--    o usuário não pode inflar seguidores, curtidas ou comentários.
-- Quem escreve nesses campos: admin e o servidor (auth.uid() nulo) continuam livres; os gatilhos de contagem rodam
-- em nível 2 (pg_trigger_depth() > 1) e também passam.

create or replace function public.perfil_protege_campos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.eh_admin_atual() then return new; end if;
  if tg_op = 'INSERT' then
    new.status_conta := 'ativo';
    if tg_table_name = 'perfil_atleta' then new.followers_count := 0; end if;
  else
    new.status_conta := old.status_conta;
    if tg_table_name = 'perfil_atleta' and pg_trigger_depth() = 1 then new.followers_count := old.followers_count; end if;
  end if;
  return new;
end $$;

drop trigger if exists perfil_atleta_protege_campos on public.perfil_atleta;
create trigger perfil_atleta_protege_campos before insert or update on public.perfil_atleta
  for each row execute function public.perfil_protege_campos();
drop trigger if exists perfis_rede_protege_campos on public.perfis_rede;
create trigger perfis_rede_protege_campos before insert or update on public.perfis_rede
  for each row execute function public.perfil_protege_campos();

create or replace function public.posts_protege_contadores() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.eh_admin_atual() then return new; end if;
  if tg_op = 'INSERT' then
    new.likes_count := 0; new.comments_count := 0;
  elsif pg_trigger_depth() = 1 then
    new.likes_count := old.likes_count; new.comments_count := old.comments_count;
  end if;
  return new;
end $$;

drop trigger if exists posts_atleta_protege_contadores on public.posts_atleta;
create trigger posts_atleta_protege_contadores before insert or update on public.posts_atleta
  for each row execute function public.posts_protege_contadores();
