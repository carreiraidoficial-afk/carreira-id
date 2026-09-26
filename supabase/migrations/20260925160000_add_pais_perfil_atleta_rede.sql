-- Viabilizar brasileiros no exterior (intercambio): coluna pais, aditiva,
-- default 'Brasil' preserva 100% do comportamento atual pra quem ja
-- existe. Nao mexe em CPF/telefone -- publico e brasileiro morando fora,
-- nao estrangeiro se cadastrando do zero.

ALTER TABLE public.perfil_atleta ADD COLUMN IF NOT EXISTS pais TEXT NOT NULL DEFAULT 'Brasil';
ALTER TABLE public.perfis_rede ADD COLUMN IF NOT EXISTS pais TEXT NOT NULL DEFAULT 'Brasil';
