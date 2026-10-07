-- Equipe técnica da escola (professores, técnicos, preparadores...).
-- Dois tipos de membro na mesma tabela:
--   * manual: a escola cadastra nome + foto + função (a pessoa não precisa ter conta);
--   * vinculado: aponta para um perfis_rede (professor/técnico/preparador) -- etapa seguinte.
-- Não usa rede_conexoes de propósito: conexão é rede de contatos e não diz se a pessoa trabalha na escola.
CREATE TABLE IF NOT EXISTS public.escola_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_perfil_id uuid NOT NULL REFERENCES public.perfis_rede(id) ON DELETE CASCADE,
  membro_perfil_id uuid REFERENCES public.perfis_rede(id) ON DELETE SET NULL,
  nome text,
  foto_url text,
  funcao text NOT NULL CHECK (char_length(btrim(funcao)) BETWEEN 2 AND 60),
  status text NOT NULL DEFAULT 'aceita' CHECK (status IN ('pendente', 'aceita')),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'pedido', 'convite')),
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Vinculado OU manual completo (nome e foto são obrigatórios no manual).
  CONSTRAINT escola_equipe_manual_ou_vinculado CHECK (
    membro_perfil_id IS NOT NULL
    OR (nome IS NOT NULL AND char_length(btrim(nome)) >= 2 AND foto_url IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS escola_equipe_escola_idx ON public.escola_equipe (escola_perfil_id, status);

ALTER TABLE public.escola_equipe ENABLE ROW LEVEL SECURITY;

-- Qualquer visitante vê a equipe já aceita (é a vitrine pública da escola).
CREATE POLICY "Equipe aceita e publica" ON public.escola_equipe
  FOR SELECT USING (status = 'aceita');

-- O dono da escola enxerga e gerencia tudo da própria escola (inclusive pedidos pendentes).
CREATE POLICY "Dono da escola gerencia a equipe" ON public.escola_equipe
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.perfis_rede p
    WHERE p.id = escola_equipe.escola_perfil_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.perfis_rede p
    WHERE p.id = escola_equipe.escola_perfil_id AND p.user_id = auth.uid()
  ));

-- Modo Suporte: admin gerencia qualquer equipe.
CREATE POLICY "Admins gerenciam todas as equipes" ON public.escola_equipe
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));
