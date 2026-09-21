-- Biblioteca de escudos de times salvos por usuario, pra reaproveitar ao
-- registrar jogos (meu time / adversario) sem precisar subir a imagem de
-- novo toda vez que joga contra o mesmo time.
CREATE TABLE public.carreira_times_logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_time text NOT NULL,
  logo_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome_time)
);

ALTER TABLE public.carreira_times_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve seus proprios times salvos"
  ON public.carreira_times_logos FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Usuario salva seus proprios times"
  ON public.carreira_times_logos FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuario atualiza seus proprios times"
  ON public.carreira_times_logos FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuario remove seus proprios times"
  ON public.carreira_times_logos FOR DELETE
  USING (user_id = auth.uid());

-- Escudo do time do proprio atleta e do adversario em cada jogo (opcional).
ALTER TABLE public.carreira_jogos
  ADD COLUMN IF NOT EXISTS logo_time_atleta_url text,
  ADD COLUMN IF NOT EXISTS logo_time_adversario_url text;
