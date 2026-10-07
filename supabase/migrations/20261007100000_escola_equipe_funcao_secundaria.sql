-- Membro da equipe pode ter até dois títulos (ex.: "Diretor(a)" e "Professor(a) de Quadra").
-- O principal continua em funcao (obrigatório); o segundo é opcional.
ALTER TABLE public.escola_equipe
  ADD COLUMN IF NOT EXISTS funcao_secundaria text
  CHECK (funcao_secundaria IS NULL OR char_length(btrim(funcao_secundaria)) BETWEEN 2 AND 60);
