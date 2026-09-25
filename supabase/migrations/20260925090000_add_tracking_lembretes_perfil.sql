ALTER TABLE public.carreira_lembretes_perfil_enviados
  ADD COLUMN resend_email_id TEXT,
  ADD COLUMN aberto_em TIMESTAMPTZ,
  ADD COLUMN clicado_em TIMESTAMPTZ;

CREATE INDEX idx_carreira_lembretes_enviados_resend_email_id
  ON public.carreira_lembretes_perfil_enviados (resend_email_id);
