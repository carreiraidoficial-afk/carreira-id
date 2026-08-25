-- Registra crashes de renderizacao no navegador do usuario (ex: erro de
-- hooks do React que derruba a tela inteira) -- o Diagnostico do admin ate
-- entao so via saude de banco/storage, nunca esse tipo de erro client-side,
-- que so aparece no navegador de quem esta usando o app.
CREATE TABLE public.carreira_client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  message text NOT NULL,
  stack text,
  component_stack text,
  url text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_agent text
);

CREATE INDEX idx_carreira_client_errors_created_at ON public.carreira_client_errors (created_at DESC);

ALTER TABLE public.carreira_client_errors ENABLE ROW LEVEL SECURITY;

-- Precisa aceitar de anon tambem -- um crash pode acontecer antes de
-- qualquer login (ex: visitante anonimo abrindo um perfil publico).
CREATE POLICY "Anyone can report client errors" ON public.carreira_client_errors
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view client errors" ON public.carreira_client_errors
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));
