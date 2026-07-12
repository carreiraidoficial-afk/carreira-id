-- ============================================================
-- Fase 3 — Remove tabelas legadas do Atleta ID
-- Executar manualmente no SQL Editor do Supabase Carreira ID
-- (projeto fppsotlycinwqsjpoybg)
-- ============================================================
-- IMPORTANTE: faça um snapshot/backup antes de rodar.
-- Use `IF EXISTS` para ser idempotente — tabelas que já não existem são ignoradas.
-- Rode como transação única.

BEGIN;

-- ============================================================
-- Bloco A: tabelas Atleta ID puras (nenhum código Carreira usa)
-- ============================================================
DROP TABLE IF EXISTS public.access_logs CASCADE;
DROP TABLE IF EXISTS public.pwa_installs CASCADE;
DROP TABLE IF EXISTS public.push_notifications_log CASCADE;

DROP TABLE IF EXISTS public.mensalidades CASCADE;
DROP TABLE IF EXISTS public.presencas CASCADE;
DROP TABLE IF EXISTS public.aulas_extras CASCADE;
DROP TABLE IF EXISTS public.aulas CASCADE;
DROP TABLE IF EXISTS public.crianca_turma CASCADE;
DROP TABLE IF EXISTS public.turmas CASCADE;
DROP TABLE IF EXISTS public.professores CASCADE;
DROP TABLE IF EXISTS public.crianca_responsavel CASCADE;
DROP TABLE IF EXISTS public.responsaveis CASCADE;

DROP TABLE IF EXISTS public.escolinha_financeiro CASCADE;
DROP TABLE IF EXISTS public.escolinha_cadastro_bancario CASCADE;

DROP TABLE IF EXISTS public.comunicado_leituras CASCADE;
DROP TABLE IF EXISTS public.comunicados_escola CASCADE;
DROP TABLE IF EXISTS public.comunicados CASCADE;
DROP TABLE IF EXISTS public.escola_push_config CASCADE;

DROP TABLE IF EXISTS public.historico_cobrancas CASCADE;
DROP TABLE IF EXISTS public.cobrancas_entrada CASCADE;
DROP TABLE IF EXISTS public.pedidos CASCADE;

DROP TABLE IF EXISTS public.loja_pedidos CASCADE;
DROP TABLE IF EXISTS public.loja_estoque CASCADE;
DROP TABLE IF EXISTS public.loja_relatorio CASCADE;

DROP TABLE IF EXISTS public.enrollment_payments CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;

DROP TABLE IF EXISTS public.amistoso_convocacoes CASCADE;
DROP TABLE IF EXISTS public.amistosos CASCADE;

DROP TABLE IF EXISTS public.campeonato_convocacoes CASCADE;
DROP TABLE IF EXISTS public.campeonato_jogos CASCADE;
DROP TABLE IF EXISTS public.campeonatos CASCADE;

DROP TABLE IF EXISTS public.evento_conquistas CASCADE;
DROP TABLE IF EXISTS public.evento_times CASCADE;
DROP TABLE IF EXISTS public.evento_presencas CASCADE;
DROP TABLE IF EXISTS public.evento_premiacoes CASCADE;
DROP TABLE IF EXISTS public.evento_gols CASCADE;
DROP TABLE IF EXISTS public.eventos_esportivos CASCADE;
DROP TABLE IF EXISTS public.eventos CASCADE;

DROP TABLE IF EXISTS public.conquistas_coletivas CASCADE;
DROP TABLE IF EXISTS public.conquistas CASCADE;

DROP TABLE IF EXISTS public.indicacoes CASCADE;
DROP TABLE IF EXISTS public.motivos_cancelamento CASCADE;
DROP TABLE IF EXISTS public.motivos_aula_extra CASCADE;

-- ============================================================
-- Bloco B: ponte Atleta -> Carreira (tabelas *_sync)
-- A Jornada Esportiva do Carreira usa carreira_* (via useJornada);
-- as tabelas de sync ficaram órfãs após remover receive-atleta-data.
-- ============================================================
DROP TABLE IF EXISTS public.atividades_externas_sync CASCADE;
DROP TABLE IF EXISTS public.evento_gols_sync CASCADE;
DROP TABLE IF EXISTS public.evento_premiacoes_sync CASCADE;
DROP TABLE IF EXISTS public.amistoso_convocacoes_sync CASCADE;
DROP TABLE IF EXISTS public.campeonato_convocacoes_sync CASCADE;
DROP TABLE IF EXISTS public.conquistas_coletivas_sync CASCADE;

-- Colunas de rastreamento da ponte em perfil_atleta
ALTER TABLE public.perfil_atleta DROP COLUMN IF EXISTS atleta_id_vinculado;
ALTER TABLE public.perfil_atleta DROP COLUMN IF EXISTS atleta_id_sync_at;

COMMIT;

-- ============================================================
-- Pós-migration (opcional, manual):
-- 1. Deletar o secret CARREIRA_SYNC_SECRET no painel do Supabase
-- 2. Regenerar src/integrations/supabase/types.ts:
--    supabase gen types typescript --project-id fppsotlycinwqsjpoybg > src/integrations/supabase/types.ts
-- ============================================================