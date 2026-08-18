-- Permite que qualquer usuário logado no Carreira ID veja perfis de atleta
-- mesmo quando is_public = false. Anônimos continuam restritos à policy
-- existente ("Perfis publicos podem ser visualizados por todos" = true).
-- Ou seja: is_public agora controla "visível na internet toda" vs
-- "visível só pra quem tem conta no Carreira ID" -- não mais "visível só
-- pro dono".
CREATE POLICY "Usuarios logados podem ver perfis de atletas nao publicos"
ON public.perfil_atleta
FOR SELECT
TO authenticated
USING (true);
