-- Vincula um cupom a uma escola (perfis_rede) real, pro programa "Escolas
-- Parceiras": a propria escola parceira eh definida como "tem um cupom
-- ativo vinculado a ela" -- sem tabela paralela, o cupom EH o registro
-- da parceria (mesmo codigo que ela distribui aos atletas).
ALTER TABLE public.carreira_cupons
  ADD COLUMN perfil_rede_id uuid REFERENCES public.perfis_rede(id) ON DELETE SET NULL;

CREATE INDEX idx_carreira_cupons_perfil_rede_id ON public.carreira_cupons (perfil_rede_id) WHERE perfil_rede_id IS NOT NULL;
