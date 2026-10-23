-- Quem abre o link de um perfil que não é público (só quem tem conta, ou só conexões) via "Perfil não encontrado", como se o
-- perfil não existisse. Esta função diz só o nível de visibilidade (nenhum dado do perfil) para a tela explicar o que fazer.
create or replace function public.perfil_atleta_visibilidade_publica(p_slug text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case when p.restrito_conexoes then 'conexoes' else 'conta' end
  from public.perfil_atleta p
  where p.slug = p_slug and not p.is_public
  limit 1;
$function$;

revoke execute on function public.perfil_atleta_visibilidade_publica(text) from public;
grant execute on function public.perfil_atleta_visibilidade_publica(text) to anon, authenticated;
