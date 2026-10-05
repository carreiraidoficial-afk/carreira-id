-- Faltava política de admin pra UPDATE em profiles -- só existia pra
-- SELECT, então o botão de "excluir dos lembretes" na tela de Perfil
-- Incompleto silenciosamente não gravava nada (RLS filtrava a linha sem
-- retornar erro, já que o update mirava o user_id de outra pessoa).
CREATE POLICY "Admins podem editar qualquer perfil" ON public.profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));
