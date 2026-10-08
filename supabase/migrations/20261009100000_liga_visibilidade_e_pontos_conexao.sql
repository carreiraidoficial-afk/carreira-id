-- 1) Configuracao geral do app (chave/valor). Primeira chave: liga_visivel, que o admin liga quando quiser lancar a Liga.
--    Enquanto estiver false a Liga some do menu, das telas e do perfil dos atletas (os pontos continuam sendo
--    acumulados em silencio e o admin continua vendo tudo).
CREATE TABLE IF NOT EXISTS public.carreira_config (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL DEFAULT 'null'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.carreira_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Qualquer pessoa le carreira_config" ON public.carreira_config;
CREATE POLICY "Qualquer pessoa le carreira_config" ON public.carreira_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gerencia carreira_config" ON public.carreira_config;
CREATE POLICY "Admin gerencia carreira_config" ON public.carreira_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

INSERT INTO public.carreira_config (chave, valor) VALUES ('liga_visivel', 'false'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- 2) Pontos de conexao (acao conexao_feita da aba Acoes do admin) nunca eram dados: o gatilho conferia status 'aceito'
--    (o app grava 'aceita') e so rodava em UPDATE (muita conexao ja nasce aceita, via convite e link de escola).
--    Agora dispara em INSERT e UPDATE, uma vez por conexao e por lado. So o lado que e perfil de ATLETA ganha
--    (profissional, escola e torcedor nao pontuam na Liga). Sem retroativo.
CREATE OR REPLACE FUNCTION public.handle_conexao_aceita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pontos INTEGER;
BEGIN
  IF NEW.status IS DISTINCT FROM 'aceita' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'aceita' THEN
    RETURN NEW;
  END IF;
  -- Conexao do atleta com ele mesmo (dado inconsistente): nao pontua
  IF NEW.solicitante_perfil_atleta_id IS NOT NULL
     AND NEW.solicitante_perfil_atleta_id IS NOT DISTINCT FROM NEW.destinatario_perfil_atleta_id THEN
    RETURN NEW;
  END IF;

  v_pontos := public.get_acao_pontos('conexao_feita');
  IF v_pontos <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.solicitante_perfil_atleta_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.pontos_historico
       WHERE user_id = NEW.solicitante_id AND acao_tipo = 'conexao_feita' AND referencia_id = NEW.id
     ) THEN
    PERFORM public.adicionar_pontos(NEW.solicitante_id, 'conexao_feita', v_pontos, 'Nova conexão estabelecida', NEW.id);
  END IF;

  IF NEW.destinatario_perfil_atleta_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.pontos_historico
       WHERE user_id = NEW.destinatario_id AND acao_tipo = 'conexao_feita' AND referencia_id = NEW.id
     ) THEN
    PERFORM public.adicionar_pontos(NEW.destinatario_id, 'conexao_feita', v_pontos, 'Nova conexão estabelecida', NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_conexao_aceita ON public.rede_conexoes;
CREATE TRIGGER on_conexao_aceita
  AFTER INSERT OR UPDATE ON public.rede_conexoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_conexao_aceita();
