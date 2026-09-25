-- Templates editáveis dos 3 lembretes por email pra quem tem conta mas
-- não completou nenhum perfil (ver aba "Perfil Incompleto" do admin).
CREATE TABLE public.carreira_lembretes_perfil_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_lembrete INTEGER NOT NULL UNIQUE CHECK (numero_lembrete IN (1, 2, 3)),
  dias_apos_cadastro INTEGER NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  assunto TEXT NOT NULL,
  titulo TEXT NOT NULL,
  corpo TEXT NOT NULL,
  cta_texto TEXT NOT NULL DEFAULT 'Completar meu perfil',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.carreira_lembretes_perfil_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver templates de lembrete" ON public.carreira_lembretes_perfil_templates
  FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Admins podem editar templates de lembrete" ON public.carreira_lembretes_perfil_templates
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::user_role));

INSERT INTO public.carreira_lembretes_perfil_templates (numero_lembrete, dias_apos_cadastro, assunto, titulo, corpo, cta_texto) VALUES
(
  1, 1,
  'Falta só 2 minutos pra terminar seu cadastro ⚽',
  'Você começou — falta pouquíssimo',
  'Sua conta no Carreira ID já está criada. Só falta escolher o tipo de perfil e preencher alguns dados básicos — leva menos de 2 minutos. Depois disso, seu perfil já fica pronto pra registrar toda a trajetória esportiva.',
  'Completar meu cadastro'
),
(
  2, 4,
  'Não deixe a trajetória dele se perder',
  'Cada jogo, cada gol, cada conquista',
  'Sabe aquelas fotos soltas no celular, aquele campeonato que ninguém anotou direito? Com o tempo, os detalhes se perdem. Quanto antes você começar a registrar no Carreira ID, mais completa fica a história do seu atleta daqui a alguns anos — um currículo esportivo de verdade, documentado desde cedo.',
  'Começar a registrar agora'
),
(
  3, 10,
  'Última vez que vamos lembrar (prometido)',
  'Seu perfil ainda está esperando por você',
  'Esse é o último email que mandamos sobre isso — não queremos encher sua caixa de entrada. O cadastro é gratuito, não pede cartão de crédito, e leva menos tempo que esse email que você está lendo agora. Se ainda fizer sentido pra você, é só continuar de onde parou.',
  'Finalizar meu perfil'
);

-- Controle de envio: uma linha por (user_id, numero_lembrete) já enviado,
-- pra nunca mandar o mesmo lembrete duas vezes. Só a edge function
-- (service role) le/escreve aqui.
CREATE TABLE public.carreira_lembretes_perfil_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_lembrete INTEGER NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, numero_lembrete)
);

ALTER TABLE public.carreira_lembretes_perfil_enviados ENABLE ROW LEVEL SECURITY;

-- Roda diariamente as 8h30 UTC (5h30 BRT), logo depois do cron das dicas
-- de uso, pra não competir por processamento no mesmo minuto.
SELECT cron.schedule(
  'carreira-lembrete-perfil-incompleto-daily',
  '30 8 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://fppsotlycinwqsjpoybg.supabase.co/functions/v1/carreira-lembrete-perfil-incompleto',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcHNvdGx5Y2lud3FzanBveWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDU1OTAsImV4cCI6MjA4ODIyMTU5MH0.LxdDToQ_PGkJg6JzX43iZWzKs6FHwZGq7sE5jo0KPzY"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);
