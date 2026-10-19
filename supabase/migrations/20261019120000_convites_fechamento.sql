-- Segurança, fase 2, etapa 2b (fechamento): o código de convite não é mais legível por anon/authenticated.
-- O app já lê, gera e resolve por funções (codigo_convite_do_perfil, codigo_convite_da_conta, resolver_convite).
-- Para reverter: docs/rollback-seguranca-convites.sql
revoke select (convite_codigo) on public.perfil_atleta from anon, authenticated;
revoke select (convite_codigo) on public.perfis_rede from anon, authenticated;

-- Data de nascimento guardada dentro do perfil profissional: legível por qualquer pessoa e sem nenhuma tela que a use.
update public.perfis_rede set dados_perfil = dados_perfil - 'data_nascimento' where dados_perfil ? 'data_nascimento';
