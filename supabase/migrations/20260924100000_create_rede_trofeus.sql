-- Sala de Troféus do perfil dono_escola: histórico institucional
-- autodeclarado pela escola, independente de qualquer atleta.
CREATE TABLE public.rede_trofeus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_rede_id UUID NOT NULL REFERENCES public.perfis_rede(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  organizador TEXT,
  colocacao TEXT NOT NULL,
  categoria TEXT,
  ano INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rede_trofeus_perfil_rede_id ON public.rede_trofeus(perfil_rede_id);

ALTER TABLE public.rede_trofeus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rede_trofeus" ON public.rede_trofeus
  FOR SELECT USING (true);

CREATE POLICY "Owner can insert trofeus" ON public.rede_trofeus
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfis_rede WHERE id = perfil_rede_id AND user_id = auth.uid())
  );

CREATE POLICY "Owner can update trofeus" ON public.rede_trofeus
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.perfis_rede WHERE id = perfil_rede_id AND user_id = auth.uid())
  );

CREATE POLICY "Owner can delete trofeus" ON public.rede_trofeus
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.perfis_rede WHERE id = perfil_rede_id AND user_id = auth.uid())
  );
