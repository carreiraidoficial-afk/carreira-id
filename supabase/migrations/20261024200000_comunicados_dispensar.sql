-- Cada pessoa pode tirar um comunicado da própria lista do sino (o comunicado em si continua existindo para os outros).
alter table public.carreira_comunicados_leituras add column if not exists dispensado_em timestamptz;

drop policy if exists "Users can dismiss own comunicados" on public.carreira_comunicados_leituras;
create policy "Users can dismiss own comunicados" on public.carreira_comunicados_leituras
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
