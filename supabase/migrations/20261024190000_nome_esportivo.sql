-- Nome esportivo: o nome completo continua em criancas.nome (privado, só responsável/colaborador/admin).
-- perfil_atleta.nome passa a ser o nome de exibição: o nome esportivo, se houver, ou o nome completo.
-- Este indicador diz qual dos dois está em perfil_atleta.nome (listas que abreviam nomes de menores usam isso).
alter table public.perfil_atleta add column if not exists usa_nome_esportivo boolean not null default false;
grant select (usa_nome_esportivo) on public.perfil_atleta to anon, authenticated;
