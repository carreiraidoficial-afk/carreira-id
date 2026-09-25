-- Modo Suporte: admin edita perfis_rede e rede_trofeus pontualmente, sem
-- poder apagar (mesma regra ja usada em perfil_atleta e carreira_jogos/
-- carreira_jogo_midias, que ja tinham bypass de admin antes desta migration).

CREATE POLICY "Admins podem atualizar qualquer perfil rede"
ON public.perfis_rede
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins podem inserir trofeus"
ON public.rede_trofeus
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins podem atualizar trofeus"
ON public.rede_trofeus
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::user_role));
