-- Log central de TODO e-mail "lifecycle" (não-crítico) enviado a qualquer
-- pessoa, independente do tipo (boas-vindas, lembrete, digest, novidade).
-- Tabelas específicas de cada fluxo (ex: carreira_lembretes_perfil_enviados)
-- continuam existindo pra dedupe própria e tracking de abertura/clique --
-- esta tabela serve só pra decidir "essa pessoa já recebeu algo não-crítico
-- recentemente?" antes de mandar mais um email, pra não empilhar vários no
-- mesmo período.
CREATE TABLE public.carreira_emails_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_email TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'lifecycle' CHECK (categoria IN ('critico', 'lifecycle')),
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_carreira_emails_enviados_user_enviado
  ON public.carreira_emails_enviados (user_id, enviado_em DESC);

ALTER TABLE public.carreira_emails_enviados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver historico de emails" ON public.carreira_emails_enviados
  FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));

-- Catálogo dos tipos de e-mail "lifecycle" que o orquestrador diário pode
-- disparar. Prioridade decide qual vence quando mais de um tipo venceria
-- no mesmo dia pra mesma pessoa. requer_aprovacao manda pra fila de revisão
-- em vez de enviar direto.
CREATE TABLE public.carreira_email_catalogo (
  tipo_email TEXT PRIMARY KEY,
  categoria TEXT NOT NULL DEFAULT 'lifecycle' CHECK (categoria IN ('critico', 'lifecycle')),
  prioridade INTEGER NOT NULL DEFAULT 100,
  requer_aprovacao BOOLEAN NOT NULL DEFAULT false,
  cooldown_dias INTEGER NOT NULL DEFAULT 3,
  ativo BOOLEAN NOT NULL DEFAULT true,
  descricao TEXT
);

ALTER TABLE public.carreira_email_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar catalogo de emails" ON public.carreira_email_catalogo
  FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

INSERT INTO public.carreira_email_catalogo (tipo_email, categoria, prioridade, requer_aprovacao, cooldown_dias, descricao) VALUES
  ('lembrete_perfil_1', 'lifecycle', 10, false, 3, 'Lembrete 1 -- perfil incompleto'),
  ('lembrete_perfil_2', 'lifecycle', 20, false, 3, 'Lembrete 2 -- perfil incompleto'),
  ('lembrete_perfil_3', 'lifecycle', 30, false, 3, 'Lembrete 3 -- perfil incompleto'),
  ('digest_responsavel', 'lifecycle', 50, true, 7, 'Resumo periódico agregador pro responsável (requer aprovação antes de enviar)'),
  ('novo_artigo_blog', 'lifecycle', 90, true, 3, 'Aviso de novo artigo do blog (requer aprovação antes de enviar)');

-- Fila de e-mails que precisam da sua aprovação manual antes de sair (ex:
-- digest do responsável, aviso de artigo novo). Nada é enviado
-- automaticamente pra quem está nessa fila -- só depois de "aprovado".
CREATE TABLE public.carreira_emails_pendentes_aprovacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_email TEXT NOT NULL,
  assunto TEXT NOT NULL,
  titulo TEXT NOT NULL,
  corpo TEXT NOT NULL,
  cta_texto TEXT,
  profile_url TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'enviado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revisado_em TIMESTAMPTZ,
  revisado_por UUID REFERENCES auth.users(id)
);

ALTER TABLE public.carreira_emails_pendentes_aprovacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar fila de aprovacao" ON public.carreira_emails_pendentes_aprovacao
  FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

-- Avisa o admin por push toda vez que algo cai na fila de aprovação --
-- reaproveita o mesmo padrão/função de notify_admin_novo_cadastro.
CREATE OR REPLACE FUNCTION public.notify_admin_email_pendente_aprovacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'carreiraidoficial@gmail.com' LIMIT 1;
  IF admin_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://fppsotlycinwqsjpoybg.supabase.co/functions/v1/send-carreira-push',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcHNvdGx5Y2lud3FzanBveWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDU1OTAsImV4cCI6MjA4ODIyMTU5MH0.LxdDToQ_PGkJg6JzX43iZWzKs6FHwZGq7sE5jo0KPzY"}'::jsonb,
    body := jsonb_build_object(
      'user_ids', jsonb_build_array(admin_user_id),
      'title', 'E-mail aguardando sua aprovação',
      'body', 'Um e-mail do tipo "' || NEW.tipo_email || '" está esperando revisão antes de ser enviado.',
      'url', '/carreira/admin'
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admin_email_pendente
AFTER INSERT ON public.carreira_emails_pendentes_aprovacao
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_email_pendente_aprovacao();
