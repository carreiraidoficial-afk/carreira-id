-- Titular da Base pode apontar para um perfil publico (a foto vira link na landing).
ALTER TABLE public.carreira_titulares_base ADD COLUMN IF NOT EXISTS perfil_slug TEXT;

UPDATE public.carreira_titulares_base
SET perfil_slug = 'marco-antonio-stanzani'
WHERE nome ILIKE '%Stanzani%' AND perfil_slug IS NULL
  AND EXISTS (SELECT 1 FROM public.perfis_rede WHERE slug = 'marco-antonio-stanzani');
