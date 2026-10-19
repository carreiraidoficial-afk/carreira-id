-- Desfaz a etapa 3 da fase 2 (volta a leitura aberta). Use só se algo essencial quebrar; depois corrija o app e refaça.
grant select on public.perfil_atleta to anon, authenticated;
grant select on public.perfis_rede to anon, authenticated;

drop policy if exists "Visitante ve experiencias de atletas publicos" on public.carreira_experiencias;
drop policy if exists "Logado ve experiencias" on public.carreira_experiencias;
create policy "Users can view experiences of their children" on public.carreira_experiencias for select using (true);

drop policy if exists "Partes e admin veem os seguidores" on public.atleta_follows;
create policy "Anyone can see follows" on public.atleta_follows for select using (true);
-- (o e-mail removido de dados_perfil não é restaurado; ele continua na conta de cada usuário)
