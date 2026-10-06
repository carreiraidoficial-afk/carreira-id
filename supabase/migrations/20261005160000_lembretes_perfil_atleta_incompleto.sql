-- Templates editáveis dos lembretes pra quem JÁ tem perfil de atleta
-- criado, mas não preencheu Experiência (clube/escolinha) nem Jornada
-- Esportiva (nenhum jogo cadastrado) -- público diferente de
-- carreira_lembretes_perfil_templates (que é só pra quem nunca criou
-- perfil nenhum).
CREATE TABLE public.carreira_lembretes_perfil_atleta_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL UNIQUE CHECK (tipo IN ('sem_experiencia', 'sem_jornada')),
  dias_apos_criacao INTEGER NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  assunto TEXT NOT NULL,
  titulo TEXT NOT NULL,
  corpo TEXT NOT NULL,
  cta_texto TEXT NOT NULL DEFAULT 'Completar perfil',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.carreira_lembretes_perfil_atleta_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver templates de perfil atleta" ON public.carreira_lembretes_perfil_atleta_templates
  FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Admins podem editar templates de perfil atleta" ON public.carreira_lembretes_perfil_atleta_templates
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::user_role));

-- Prioridade: Experiência vem antes de Jornada (pede o contexto do
-- clube/escolinha antes de pedir pra registrar jogos). Criado desativado
-- de propósito -- ativa depois de revisar o texto, igual os outros.
INSERT INTO public.carreira_lembretes_perfil_atleta_templates (tipo, dias_apos_criacao, assunto, titulo, corpo, cta_texto) VALUES
(
  'sem_experiencia', 5,
  'Onde o seu atleta já jogou ou treinou? ⚽',
  'Registre a trajetória esportiva dele',
  'O perfil do seu atleta no Carreira ID já está criado, mas ainda falta contar onde a jornada dele começou. Cadastre as escolinhas ou clubes por onde ele já passou -- isso ajuda a montar um histórico completo, visível pra quem acompanha a carreira dele.',
  'Cadastrar experiência'
),
(
  'sem_jornada', 7,
  'Seu atleta já disputou algum amistoso ou campeonato?',
  'Registre os primeiros jogos',
  'Com a experiência já cadastrada, falta só uma coisa: os jogos. Se o seu atleta já disputou algum amistoso ou campeonato, registre o resultado no Carreira ID -- cada jogo registrado vira parte da jornada esportiva dele, com estatísticas e tudo.',
  'Registrar meu primeiro jogo'
);

-- Catálogo: entram como mais dois tipos de email "lifecycle" no motor que
-- já existe (prioridade mais baixa que os lembretes de cadastro, porque
-- esse público já é mais engajado -- já tem perfil criado).
INSERT INTO public.carreira_email_catalogo (tipo_email, categoria, prioridade, requer_aprovacao, cooldown_dias, descricao) VALUES
  ('perfil_sem_experiencia', 'lifecycle', 60, false, 7, 'Perfil de atleta sem nenhuma Experiência (clube/escolinha) cadastrada'),
  ('perfil_sem_jornada', 'lifecycle', 70, false, 7, 'Perfil de atleta com Experiência mas sem nenhum jogo cadastrado');

-- View de completude do perfil -- usada tanto pelo gatilho de email quanto
-- (no futuro) pra mostrar um "% do cadastro concluído" no app. Cada item
-- vale o mesmo peso; dá pra ajustar os itens depois sem mudar quem usa a
-- view.
CREATE OR REPLACE VIEW public.carreira_perfil_completude
WITH (security_invoker = true) AS
SELECT
  pa.id AS perfil_atleta_id,
  pa.crianca_id,
  pa.user_id,
  (pa.foto_url IS NOT NULL) AS tem_foto,
  (pa.bio IS NOT NULL AND length(trim(pa.bio)) > 0) AS tem_bio,
  (pa.posicao_principal IS NOT NULL) AS tem_posicao,
  EXISTS (SELECT 1 FROM public.carreira_experiencias ce WHERE ce.crianca_id = pa.crianca_id) AS tem_experiencia,
  EXISTS (SELECT 1 FROM public.carreira_jogos cj WHERE cj.crianca_id = pa.crianca_id) AS tem_jornada,
  round(
    (
      (CASE WHEN pa.foto_url IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN pa.bio IS NOT NULL AND length(trim(pa.bio)) > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN pa.posicao_principal IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN EXISTS (SELECT 1 FROM public.carreira_experiencias ce WHERE ce.crianca_id = pa.crianca_id) THEN 1 ELSE 0 END) +
      (CASE WHEN EXISTS (SELECT 1 FROM public.carreira_jogos cj WHERE cj.crianca_id = pa.crianca_id) THEN 1 ELSE 0 END)
    )::numeric / 5 * 100
  ) AS percentual_completo
FROM public.perfil_atleta pa
WHERE pa.is_teste = false;

-- Roda diariamente às 9h00 UTC (6h BRT), depois do lembrete de cadastro
-- (8h30), pra não competir no mesmo minuto.
SELECT cron.schedule(
  'carreira-lembrete-perfil-atleta-incompleto-daily',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://fppsotlycinwqsjpoybg.supabase.co/functions/v1/carreira-lembrete-perfil-atleta-incompleto',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcHNvdGx5Y2lud3FzanBveWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDU1OTAsImV4cCI6MjA4ODIyMTU5MH0.LxdDToQ_PGkJg6JzX43iZWzKs6FHwZGq7sE5jo0KPzY"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);
