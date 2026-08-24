-- Cupons personalizados: um admin gera um codigo (ex: IGOR30) com um numero
-- de dias de trial estendido, pra dar a profissionais que trazem atletas.
CREATE TABLE public.carreira_cupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nome_titular text NOT NULL,
  dias_trial integer NOT NULL CHECK (dias_trial > 0),
  ativo boolean NOT NULL DEFAULT true,
  validade timestamptz,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unicidade case-insensitive (IGOR30 e igor30 sao o mesmo codigo)
CREATE UNIQUE INDEX idx_carreira_cupons_codigo_upper ON public.carreira_cupons (upper(codigo));

ALTER TABLE public.carreira_cupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage carreira_cupons" ON public.carreira_cupons
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Leitura publica de cupons ativos: precisa ser validavel durante o cadastro,
-- antes de existir qualquer vinculo do novo usuario com o cupom.
CREATE POLICY "Anyone can read active carreira_cupons" ON public.carreira_cupons
  FOR SELECT TO anon, authenticated
  USING (ativo = true);

CREATE TRIGGER update_carreira_cupons_updated_at
  BEFORE UPDATE ON public.carreira_cupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rastreia qual cupom (se algum) gerou o trial de cada assinatura, pra medir
-- quantos atletas cada cupom trouxe.
ALTER TABLE public.carreira_assinaturas
  ADD COLUMN cupom_id uuid REFERENCES public.carreira_cupons(id) ON DELETE SET NULL;
