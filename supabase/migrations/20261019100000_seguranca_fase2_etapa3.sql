-- Segurança, fase 2, etapa 3: fecha a leitura direta de CPF/CNPJ, tipo de documento e telefone.
-- O app já lê esses dados por funções (perfil_atleta_privado, perfil_rede_privado, rede_contato_publico, admin_contatos_perfis).
-- ATENÇÃO: coluna nova em perfil_atleta ou perfis_rede NÃO é legível por anon/authenticated até receber GRANT SELECT (coluna).
-- Para reverter: docs/rollback-seguranca-fase2-etapa3.sql

-- 1) Leitura por coluna: sai o privilégio da tabela inteira e entram só as colunas abertas.
revoke select on public.perfil_atleta from anon, authenticated;
grant select (
  id, user_id, slug, nome, foto_url, modalidade, categoria, cidade, estado, bio, is_public, created_at, updated_at, crianca_id,
  banner_url, modalidades, dados_publicos, instagram_url, cor_destaque, followers_count, conexoes_count, tema, status_conta, origem,
  atleta_app_id, pe_dominante, posicao_principal, posicao_secundaria, is_teste, convite_codigo, pais, aceita_convites_peneira,
  aceita_convites_peneira_em
) on public.perfil_atleta to anon, authenticated;

revoke select on public.perfis_rede from anon, authenticated;
grant select (
  id, user_id, tipo, nome, foto_url, bio, instagram, slug, dados_perfil, convite_codigo, created_at, updated_at, tema, status_conta,
  whatsapp_publico, site, cidade, estado, pais, banner_url, verificado, verificado_em, verificado_por
) on public.perfis_rede to anon, authenticated;

-- 2) O e-mail guardado dentro de dados_perfil era legível por qualquer pessoa e nenhuma tela o usa (o e-mail fica na conta).
update public.perfis_rede set dados_perfil = dados_perfil - 'email' where dados_perfil ? 'email';

-- 3) Experiências: visitante só vê as de atletas com perfil público; usuário logado continua vendo todas (avaliar depois).
drop policy if exists "Users can view experiences of their children" on public.carreira_experiencias;
create policy "Visitante ve experiencias de atletas publicos" on public.carreira_experiencias
  for select to anon
  using (exists (select 1 from public.perfil_atleta p where p.crianca_id = carreira_experiencias.crianca_id and p.is_public));
create policy "Logado ve experiencias" on public.carreira_experiencias
  for select to authenticated
  using (true);

-- 4) Seguidores: só quem segue, o dono/colaborador do atleta seguido e o admin enxergam a linha.
drop policy if exists "Anyone can see follows" on public.atleta_follows;
create policy "Partes e admin veem os seguidores" on public.atleta_follows
  for select to authenticated
  using (
    follower_id = auth.uid()
    or public.has_role(auth.uid(), 'admin'::user_role)
    or exists (
      select 1 from public.perfil_atleta p
       where p.id = atleta_follows.following_perfil_id
         and (p.user_id = auth.uid() or (p.crianca_id is not null and public.is_perfil_atleta_owner_or_colaborador(auth.uid(), p.crianca_id)))
    )
  );
