-- Rastreamento do funil de cadastro (entre autenticação bem-sucedida e
-- perfil realmente criado), pra medir onde as pessoas abandonam. Ver
-- discussão: 22 de 37 contas nunca completaram nenhum perfil.
CREATE TABLE public.carreira_onboarding_funil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  etapa TEXT NOT NULL CHECK (etapa IN ('tipo_perfil_exibido', 'tipo_selecionado', 'formulario_enviado')),
  tipo_perfil TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_carreira_onboarding_funil_user_id ON public.carreira_onboarding_funil(user_id);
CREATE INDEX idx_carreira_onboarding_funil_etapa ON public.carreira_onboarding_funil(etapa);

ALTER TABLE public.carreira_onboarding_funil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own funnel events" ON public.carreira_onboarding_funil
  FOR INSERT WITH CHECK (auth.uid() = user_id);
