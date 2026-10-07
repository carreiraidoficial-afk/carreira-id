-- Modo Suporte com acesso total: o admin precisa ler, aprovar, recusar e criar conexões
-- em nome de qualquer perfil (testar o fluxo de vínculo aluno-escola, resolver pedidos
-- parados). Antes só existiam políticas de "dono da linha" (solicitante/destinatário), então
-- o admin não enxergava nem aprovava pedidos endereçados a outra conta.
CREATE POLICY "Admins gerenciam todas as conexoes" ON public.rede_conexoes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));
