-- Capa (banner) do perfil de rede -- usada primeiro pelo perfil de escolinha
-- (dono_escola). perfil_atleta já tem banner_url; perfis_rede não tinha.
ALTER TABLE public.perfis_rede ADD COLUMN IF NOT EXISTS banner_url text;
