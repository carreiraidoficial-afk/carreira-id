-- Sem essa policy, o admin (logado com conta própria, não a do responsável
-- do atleta) via RLS não enxergava nenhuma linha de
-- perfil_atleta_colaboradores -- fazia a aba "Cadastro Incompleto" tratar
-- colaboradores ativos (ex: o próprio atleta ou a mãe, convidados via
-- /colaborar) como se nunca tivessem completado nada.
CREATE POLICY "Admins podem ver todos os colaboradores" ON public.perfil_atleta_colaboradores
  FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));
