-- Cupons: a tabela deixa de ser legível por qualquer visitante (antes, qualquer pessoa sem login listava todos os
-- códigos ativos e seus dias, e digitar "%" no campo acertava um cupom). O app passa a perguntar ao servidor.
-- ETAPA A (esta migration): cria as funções que o app vai usar. A leitura aberta só é removida na etapa B
-- (20261015100100), depois que o app novo estiver no ar, para não quebrar o cadastro no intervalo.

-- 1) Valida um código digitado no cadastro: igualdade exata (sem curingas), ativo e dentro da validade.
create or replace function public.carreira_cupom_validar(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object('id', c.id, 'dias_trial', c.dias_trial)
  from public.carreira_cupons c
  where upper(c.codigo) = upper(trim(coalesce(p_codigo, '')))
    and length(trim(coalesce(p_codigo, ''))) > 0
    and c.ativo
    and (c.validade is null or c.validade > now())
  limit 1;
$function$;

-- 2) Esta escola é parceira? (tem cupom ativo vinculado) — usado no selo do perfil.
create or replace function public.carreira_escola_e_parceira(p_perfil_rede_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (select 1 from public.carreira_cupons c where c.perfil_rede_id = p_perfil_rede_id and c.ativo);
$function$;

-- 3) Quais escolas são parceiras — usado na seção "Escolas Parceiras" da página inicial. Só devolve ids.
create or replace function public.carreira_escolas_parceiras_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.perfil_rede_id from public.carreira_cupons c
  where c.ativo and c.perfil_rede_id is not null
  order by c.created_at;
$function$;

revoke execute on function public.carreira_cupom_validar(text) from public;
revoke execute on function public.carreira_escola_e_parceira(uuid) from public;
revoke execute on function public.carreira_escolas_parceiras_ids() from public;
grant execute on function public.carreira_cupom_validar(text) to anon, authenticated;
grant execute on function public.carreira_escola_e_parceira(uuid) to anon, authenticated;
grant execute on function public.carreira_escolas_parceiras_ids() to anon, authenticated;
