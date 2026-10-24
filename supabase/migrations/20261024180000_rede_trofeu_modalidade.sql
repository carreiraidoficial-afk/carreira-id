-- Sala de Troféus da escola passa a ser dividida por esporte (um banner por modalidade).
-- Os troféus que já existem ficam em futebol.
ALTER TABLE public.rede_trofeus ADD COLUMN IF NOT EXISTS modalidade TEXT NOT NULL DEFAULT 'futebol';
