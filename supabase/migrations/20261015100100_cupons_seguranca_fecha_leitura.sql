-- Cupons, etapa B: remove a leitura aberta da tabela (o app novo já valida pelo servidor).
-- O admin continua com acesso total pela política "Admins can manage carreira_cupons".
drop policy if exists "Anyone can read active carreira_cupons" on public.carreira_cupons;
