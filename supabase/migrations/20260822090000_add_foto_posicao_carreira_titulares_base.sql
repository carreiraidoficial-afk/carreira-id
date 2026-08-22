-- Permite ajustar o enquadramento vertical da foto do titular
-- (topo/centro/base), ja que o card corta a imagem em formato quadrado.
ALTER TABLE public.carreira_titulares_base
  ADD COLUMN foto_posicao text NOT NULL DEFAULT 'center';
