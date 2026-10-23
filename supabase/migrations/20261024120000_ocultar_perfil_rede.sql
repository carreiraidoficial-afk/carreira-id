-- Admin oculta um perfil profissional (ex.: cadastro falso): status_conta = 'inativo' passa a esconder o perfil de verdade.
-- Antes esse campo só aparecia no admin e não mudava nada para o público. Quem continua enxergando o perfil oculto: o próprio dono
-- (para não perder o acesso à conta) e o admin. Todos os outros (visitantes, buscas, equipe da escola) deixam de ver.
-- Só o admin altera esse campo (o gatilho perfis_rede_protege_campos devolve o valor antigo para o dono).
drop policy if exists "Anyone can view perfis_rede" on public.perfis_rede;

create policy "Perfis de rede visiveis, menos os ocultos pelo admin" on public.perfis_rede
  for select
  using (
    status_conta is distinct from 'inativo'
    or user_id = auth.uid()
    or public.has_role(auth.uid(), 'admin'::user_role)
  );
