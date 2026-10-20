-- Atleta que se declara maior de idade: guardamos quando declarou e damos ao admin uma lista de conferência
-- (18 e 19 anos, faixa em que mais se erra/mente na data de nascimento).

alter table public.perfil_atleta add column if not exists maioridade_declarada_em timestamptz;
-- sem grant de leitura: só o admin enxerga, pela função abaixo.

create or replace function public.admin_adultos_para_conferir() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $fn$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::user_role) then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(l order by (l->>'criado_em') desc) from (
      select jsonb_build_object(
        'id', p.id, 'slug', p.slug, 'nome', p.nome,
        'idade', extract(year from age(current_date, c.data_nascimento))::int,
        'nascimento', to_char(c.data_nascimento, 'MM/YYYY'),
        'criado_em', p.created_at,
        'cadastro_proprio', p.cadastro_proprio,
        'declarou_maioridade', p.maioridade_declarada_em is not null,
        'conta_igual_atleta', lower(btrim(p.nome)) = lower(btrim(coalesce(pr.nome, ''))),
        'modalidade', p.modalidade,
        'local', nullif(btrim(coalesce(p.cidade, '') || case when p.estado is not null then '/' || p.estado else '' end), '')
      ) as l
      from public.perfil_atleta p
      join public.criancas c on c.id = p.crianca_id
      left join public.profiles pr on pr.user_id = p.user_id
      where p.is_teste is not true and p.created_at > now() - interval '90 days'
        and extract(year from age(current_date, c.data_nascimento)) between 18 and 19
        and (p.cadastro_proprio or lower(btrim(p.nome)) = lower(btrim(coalesce(pr.nome, ''))))
    ) x
  ), '[]'::jsonb);
end $fn$;
revoke all on function public.admin_adultos_para_conferir() from public, anon;
grant execute on function public.admin_adultos_para_conferir() to authenticated;
