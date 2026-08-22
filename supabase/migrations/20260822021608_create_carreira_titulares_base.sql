-- "Titulares da Base": apoiadores fundadores (técnicos/influenciadores)
-- exibidos na landing page, gerenciados pelo admin.
CREATE TABLE public.carreira_titulares_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  papel text NOT NULL,
  foto_url text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.carreira_titulares_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage carreira_titulares_base" ON public.carreira_titulares_base
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Anyone can read active carreira_titulares_base" ON public.carreira_titulares_base
  FOR SELECT TO anon, authenticated
  USING (ativo = true);

CREATE TRIGGER update_carreira_titulares_base_updated_at
  BEFORE UPDATE ON public.carreira_titulares_base
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
