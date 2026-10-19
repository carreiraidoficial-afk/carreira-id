-- Desfaz o fechamento dos convites (volta a leitura aberta do código). A data de nascimento removida não é restaurada.
grant select (convite_codigo) on public.perfil_atleta to anon, authenticated;
grant select (convite_codigo) on public.perfis_rede to anon, authenticated;
