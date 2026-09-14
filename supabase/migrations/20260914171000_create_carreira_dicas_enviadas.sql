-- Controle de dicas de uso enviadas por push (onboarding/engajamento).
-- Uma linha por (user_id, dica) já enviada, pra nunca repetir a mesma dica
-- pro mesmo responsável. Só a edge function carreira-dicas-uso (service
-- role) le/escreve aqui -- não é lido pelo client.
CREATE TABLE public.carreira_dicas_enviadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dica_key text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  clicado_em timestamptz,
  UNIQUE (user_id, dica_key)
);

ALTER TABLE public.carreira_dicas_enviadas ENABLE ROW LEVEL SECURITY;
-- Leitura/escrita geral só pela service role (edge function). Única
-- exceção: o próprio usuário pode marcar SUA linha como clicada, quando
-- abre o app a partir da notificação (ver useTrackDicaClick).
CREATE POLICY "Usuario marca propria dica como clicada"
  ON public.carreira_dicas_enviadas
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Roda diariamente as 8h UTC (5h BRT), junto com o restante dos lembretes
-- automaticos do Carreira ID.
SELECT cron.schedule(
  'carreira-dicas-uso-daily',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://fppsotlycinwqsjpoybg.supabase.co/functions/v1/carreira-dicas-uso',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcHNvdGx5Y2lud3FzanBveWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDU1OTAsImV4cCI6MjA4ODIyMTU5MH0.LxdDToQ_PGkJg6JzX43iZWzKs6FHwZGq7sE5jo0KPzY"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);
