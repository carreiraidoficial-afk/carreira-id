-- ============================================================================
-- Carreira ID — Subconta Asaas dedicada (mesmo CNPJ, autorizado pelo Asaas)
-- Rodar no Supabase (SQL Editor ou `supabase db push` local) do projeto
-- fppsotlycinwqsjpoybg.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.carreira_cadastro_bancario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_pessoa TEXT NOT NULL CHECK (tipo_pessoa IN ('cpf','cnpj')),
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  email TEXT NOT NULL,
  telefone TEXT,
  data_nascimento DATE,
  income_value NUMERIC,
  cep TEXT,
  rua TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  banco TEXT NOT NULL,
  agencia TEXT NOT NULL,
  conta TEXT NOT NULL,
  tipo_conta TEXT NOT NULL CHECK (tipo_conta IN ('corrente','poupanca')),
  asaas_account_id TEXT,
  asaas_wallet_id TEXT,
  asaas_api_key TEXT,
  asaas_status TEXT,
  asaas_status_detail JSONB,
  asaas_enviado_em TIMESTAMPTZ,
  asaas_atualizado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carreira_cadastro_bancario TO authenticated;
GRANT ALL ON public.carreira_cadastro_bancario TO service_role;

ALTER TABLE public.carreira_cadastro_bancario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carreira_cadastro_bancario_admin_all" ON public.carreira_cadastro_bancario;
CREATE POLICY "carreira_cadastro_bancario_admin_all"
  ON public.carreira_cadastro_bancario
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_carreira_cadastro_bancario_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_carreira_cadastro_bancario_touch ON public.carreira_cadastro_bancario;
CREATE TRIGGER trg_carreira_cadastro_bancario_touch
  BEFORE UPDATE ON public.carreira_cadastro_bancario
  FOR EACH ROW EXECUTE FUNCTION public.tg_carreira_cadastro_bancario_touch();

-- Documentos ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.carreira_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  mime_type TEXT,
  asaas_document_id TEXT,
  asaas_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carreira_documentos TO authenticated;
GRANT ALL ON public.carreira_documentos TO service_role;

ALTER TABLE public.carreira_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carreira_documentos_admin_all" ON public.carreira_documentos;
CREATE POLICY "carreira_documentos_admin_all"
  ON public.carreira_documentos
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auditoria de jobs ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.carreira_asaas_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB,
  resultado JSONB,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carreira_asaas_jobs TO authenticated;
GRANT ALL ON public.carreira_asaas_jobs TO service_role;

ALTER TABLE public.carreira_asaas_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carreira_asaas_jobs_admin_all" ON public.carreira_asaas_jobs;
CREATE POLICY "carreira_asaas_jobs_admin_all"
  ON public.carreira_asaas_jobs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket privado ----------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('carreira-asaas-documentos', 'carreira-asaas-documentos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "carreira_asaas_docs_admin_select" ON storage.objects;
CREATE POLICY "carreira_asaas_docs_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'carreira-asaas-documentos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "carreira_asaas_docs_admin_insert" ON storage.objects;
CREATE POLICY "carreira_asaas_docs_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'carreira-asaas-documentos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "carreira_asaas_docs_admin_update" ON storage.objects;
CREATE POLICY "carreira_asaas_docs_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'carreira-asaas-documentos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "carreira_asaas_docs_admin_delete" ON storage.objects;
CREATE POLICY "carreira_asaas_docs_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'carreira-asaas-documentos' AND public.has_role(auth.uid(), 'admin'));