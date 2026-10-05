-- Substitui a completude "tudo ou nada" por 3 percentuais separados:
-- dados básicos do perfil, Experiência (registro mais recente) e Jornada
-- Esportiva (jogo mais recente) -- cada seção avalia o quão preenchidos
-- estão os campos relevantes, não só se existe pelo menos 1 registro.
DROP VIEW IF EXISTS public.carreira_perfil_completude;

CREATE VIEW public.carreira_perfil_completude
WITH (security_invoker = true) AS
WITH experiencia_recente AS (
  SELECT DISTINCT ON (crianca_id) crianca_id, nome_escola, tipo_instituicao, categoria_instituicao, posicao_jogada
  FROM public.carreira_experiencias
  ORDER BY crianca_id, data_inicio DESC
),
jogo_recente AS (
  SELECT DISTINCT ON (crianca_id) crianca_id, data_jogo, time_adversario, placar_time_atleta, placar_adversario
  FROM public.carreira_jogos
  ORDER BY crianca_id, data_jogo DESC
)
SELECT
  pa.id AS perfil_atleta_id,
  pa.crianca_id,
  pa.user_id,

  (pa.foto_url IS NOT NULL) AS basico_tem_foto,
  (pa.bio IS NOT NULL AND length(trim(pa.bio)) > 0) AS basico_tem_bio,
  (pa.posicao_principal IS NOT NULL) AS basico_tem_posicao,
  (pa.pe_dominante IS NOT NULL) AS basico_tem_pe_dominante,
  (pa.cidade IS NOT NULL) AS basico_tem_cidade,
  round(
    (
      (CASE WHEN pa.foto_url IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN pa.bio IS NOT NULL AND length(trim(pa.bio)) > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN pa.posicao_principal IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN pa.pe_dominante IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN pa.cidade IS NOT NULL THEN 1 ELSE 0 END)
    )::numeric / 5 * 100
  ) AS basico_percentual,

  (er.nome_escola IS NOT NULL) AS exp_tem_nome_escola,
  (er.tipo_instituicao IS NOT NULL) AS exp_tem_tipo_instituicao,
  (er.categoria_instituicao IS NOT NULL) AS exp_tem_categoria,
  (er.posicao_jogada IS NOT NULL) AS exp_tem_posicao_jogada,
  round(
    (
      (CASE WHEN er.nome_escola IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN er.tipo_instituicao IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN er.categoria_instituicao IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN er.posicao_jogada IS NOT NULL THEN 1 ELSE 0 END)
    )::numeric / 4 * 100
  ) AS experiencia_percentual,

  (jr.data_jogo IS NOT NULL) AS jornada_tem_data,
  (jr.time_adversario IS NOT NULL) AS jornada_tem_adversario,
  (jr.placar_time_atleta IS NOT NULL) AS jornada_tem_placar_atleta,
  (jr.placar_adversario IS NOT NULL) AS jornada_tem_placar_adversario,
  round(
    (
      (CASE WHEN jr.data_jogo IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN jr.time_adversario IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN jr.placar_time_atleta IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN jr.placar_adversario IS NOT NULL THEN 1 ELSE 0 END)
    )::numeric / 4 * 100
  ) AS jornada_percentual

FROM public.perfil_atleta pa
LEFT JOIN experiencia_recente er ON er.crianca_id = pa.crianca_id
LEFT JOIN jogo_recente jr ON jr.crianca_id = pa.crianca_id
WHERE pa.is_teste = false;
