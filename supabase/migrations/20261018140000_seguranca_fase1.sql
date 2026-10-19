-- Segurança, fase 1 (auditoria de 18/10/2026).

-- 1) Funções que mexem em pontos/selos e consultas de papel não podem ser chamadas pela API por qualquer pessoa.
--    Os gatilhos do banco continuam funcionando (rodam como dono da função). O admin usa o invólucro abaixo.
revoke all on function public.adicionar_pontos(uuid, text, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.dar_badge(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.verificar_badges_convites(uuid) from public, anon, authenticated;
revoke all on function public.get_user_role(uuid) from public, anon, authenticated;
revoke all on function public.expirar_trials_carreira() from public, anon, authenticated;
-- Estas só fazem sentido para quem está logado.
revoke all on function public.check_carreira_atividade_limit(uuid, uuid) from public, anon;
revoke all on function public.carreira_cupom_validar(text) from public, anon;

create or replace function public.admin_adicionar_pontos(p_user_id uuid, p_acao_tipo text, p_pontos integer, p_descricao text)
returns void language plpgsql security definer set search_path to 'public' as $fn$
begin
  if not public.has_role(auth.uid(), 'admin'::user_role) then
    raise exception 'apenas admin' using errcode = '42501';
  end if;
  perform public.adicionar_pontos(p_user_id, p_acao_tipo, p_pontos, p_descricao, null);
end $fn$;
revoke all on function public.admin_adicionar_pontos(uuid, text, integer, text) from public, anon;
grant execute on function public.admin_adicionar_pontos(uuid, text, integer, text) to authenticated;

-- 2) Bucket carreira-assets: antes qualquer usuário logado podia gravar/substituir qualquer arquivo.
--    Agora: admin em qualquer caminho; organizador só na própria pasta de peneiras.
drop policy if exists "Authenticated upload carreira-assets" on storage.objects;
drop policy if exists "Authenticated update carreira-assets" on storage.objects;

create policy "carreira-assets: admin ou pasta propria (insert)" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'carreira-assets' and (
      public.has_role(auth.uid(), 'admin'::user_role)
      or ((storage.foldername(name))[1] = 'peneiras' and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );

create policy "carreira-assets: admin ou pasta propria (update)" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'carreira-assets' and (
      public.has_role(auth.uid(), 'admin'::user_role)
      or ((storage.foldername(name))[1] = 'peneiras' and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );

-- 3) Erros do navegador: continua aceitando visitante (o erro pode ocorrer antes do login), mas com tamanho limitado
--    e sem se passar por outro usuário.
drop policy if exists "Anyone can report client errors" on public.carreira_client_errors;
create policy "Qualquer pessoa registra erro com tamanho limitado" on public.carreira_client_errors
  for insert to anon, authenticated
  with check (
    length(coalesce(message, '')) <= 2000
    and length(coalesce(stack, '')) <= 5000
    and length(coalesce(component_stack, '')) <= 5000
    and length(coalesce(url, '')) <= 2000
    and length(coalesce(user_agent, '')) <= 1000
    and (user_id is null or user_id = auth.uid())
  );
