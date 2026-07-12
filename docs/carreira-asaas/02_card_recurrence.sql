-- Executar no SQL Editor do Supabase

-- 1) Preço oficial do Premium
INSERT INTO public.saas_config (chave, valor)
VALUES ('carreira_valor_premium', '12.00')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

-- 2) Colunas para armazenar metadados de cartão e motivo de recusa
ALTER TABLE public.carreira_assinaturas
  ADD COLUMN IF NOT EXISTS gateway_card_token TEXT,
  ADD COLUMN IF NOT EXISTS card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS card_brand TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;