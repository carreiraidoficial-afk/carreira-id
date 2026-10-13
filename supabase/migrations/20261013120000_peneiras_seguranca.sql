-- Peneiras: segurança do atleta (fase 1 e parte da fase 2).
-- Regras no SERVIDOR (não só na tela):
--  * só organizador de perfil profissional VERIFICADO pelo admin cria peneira; ela nasce "em análise" e só vale depois de aprovada;
--  * convite só para atleta cujo responsável ATIVOU o recebimento (padrão desligado), validado por função;
--  * limites (3 peneiras abertas, 50 convites por dia, criada com 7 dias de antecedência);
--  * sem cobrança, links ou telefones no texto;
--  * endereço e contatos só para o organizador, o admin e quem CONFIRMOU o convite.

-- ===== 1. Colunas novas =====
alter table public.perfis_rede
  add column if not exists verificado boolean not null default false,
  add column if not exists verificado_em timestamptz,
  add column if not exists verificado_por uuid;

alter table public.perfil_atleta
  add column if not exists aceita_convites_peneira boolean not null default false,
  add column if not exists aceita_convites_peneira_em timestamptz;

alter table public.peneiras
  add column if not exists aprovacao_status text not null default 'em_analise'
    check (aprovacao_status in ('em_analise', 'aprovada', 'recusada')),
  add column if not exists aprovacao_nota text,
  add column if not exists aprovada_em timestamptz,
  add column if not exists aprovada_por uuid;

-- peneiras que já existiam continuam valendo
update public.peneiras set aprovacao_status = 'aprovada', aprovada_em = now() where aprovacao_status = 'em_analise';

-- ===== 2. Funções de apoio (security definer, evitam recursão entre as políticas) =====
create or replace function public.eh_criador_peneira(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.peneiras where id = p_id and criador_id = auth.uid())
$$;

create or replace function public.eh_convidado_peneira(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.peneira_convites where peneira_id = p_id and atleta_user_id = auth.uid())
$$;

create or replace function public.eh_admin_atual() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.has_role(auth.uid(), 'admin'::user_role)
$$;

-- ===== 3. Ninguém se verifica sozinho =====
create or replace function public.perfis_rede_protege_verificacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.eh_admin_atual() then return new; end if;
  if tg_op = 'INSERT' then
    new.verificado := false; new.verificado_em := null; new.verificado_por := null;
  else
    new.verificado := old.verificado; new.verificado_em := old.verificado_em; new.verificado_por := old.verificado_por;
  end if;
  return new;
end $$;
drop trigger if exists perfis_rede_protege_verificacao on public.perfis_rede;
create trigger perfis_rede_protege_verificacao before insert or update on public.perfis_rede
  for each row execute function public.perfis_rede_protege_verificacao();

-- ===== 4. Regras da peneira (criar e editar) =====
create or replace function public.peneiras_regras() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean;
  v_texto text;
  v_abertas int;
begin
  if auth.uid() is null then return new; end if;   -- serviço / migrações
  v_admin := public.eh_admin_atual();

  -- texto: sem cobrança, links nem telefones (contato vai nos campos próprios, liberados só a quem confirmar)
  v_texto := coalesce(new.titulo, '') || ' ' || coalesce(new.descricao, '') || ' ' || coalesce(new.requisitos, '');
  if not v_admin then
    if v_texto ~* '(r\$|\mpix\M|\mtaxa\M|pagament|\mpagar\M|cobran|mensalidade|inscri[cç][aã]o paga|valor da)' then
      raise exception 'Peneiras no Carreira ID não podem ter cobrança. Tire do texto valores, taxas ou pagamentos.' using errcode = 'P0001';
    end if;
    if v_texto ~* '(https?://|www\.|@[a-z0-9_.]+\.[a-z]{2,}|\(?\d{2}\)?[ .-]?9?\d{4}[ .-]?\d{4})' then
      raise exception 'Não coloque links, e-mails ou telefones no texto. Use os campos de contato.' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if not v_admin then
      if not exists (
        select 1 from public.perfis_rede
         where user_id = new.criador_id and verificado
           and tipo in ('tecnico', 'scout', 'agente_clube', 'dono_escola')
      ) then
        raise exception 'Só organizadores com perfil verificado pelo Carreira ID podem criar peneiras.' using errcode = 'P0001';
      end if;
      select count(*) into v_abertas from public.peneiras
       where criador_id = new.criador_id and status = 'aberta' and data_evento >= now();
      if v_abertas >= 3 then
        raise exception 'Você já tem 3 peneiras abertas. Encerre uma para criar outra.' using errcode = 'P0001';
      end if;
      if new.data_evento < now() + interval '7 days' then
        raise exception 'Crie a peneira com pelo menos 7 dias de antecedência, para os responsáveis poderem analisar.' using errcode = 'P0001';
      end if;
      new.aprovacao_status := 'em_analise'; new.aprovacao_nota := null; new.aprovada_em := null; new.aprovada_por := null;
    end if;
  else
    if not v_admin then
      new.criador_id := old.criador_id;
      new.aprovacao_status := old.aprovacao_status; new.aprovacao_nota := old.aprovacao_nota;
      new.aprovada_em := old.aprovada_em; new.aprovada_por := old.aprovada_por;
      if new.data_evento is distinct from old.data_evento and new.data_evento < now() + interval '7 days' then
        raise exception 'A nova data precisa ter pelo menos 7 dias de antecedência.' using errcode = 'P0001';
      end if;
      -- mudou algo que os responsáveis veem: volta para análise
      if (new.titulo, new.descricao, new.data_evento, new.local_nome, new.local_endereco, new.cidade, new.estado, new.categorias, new.requisitos, new.vagas)
         is distinct from
         (old.titulo, old.descricao, old.data_evento, old.local_nome, old.local_endereco, old.cidade, old.estado, old.categorias, old.requisitos, old.vagas)
      then
        new.aprovacao_status := 'em_analise';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists peneiras_regras on public.peneiras;
create trigger peneiras_regras before insert or update on public.peneiras
  for each row execute function public.peneiras_regras();

-- atleta só responde o convite; não mexe no resto
create or replace function public.convite_peneira_so_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.eh_admin_atual() then return new; end if;
  if (new.peneira_id, new.atleta_perfil_id, new.atleta_user_id, new.created_at)
     is distinct from (old.peneira_id, old.atleta_perfil_id, old.atleta_user_id, old.created_at) then
    raise exception 'Só é possível responder o convite.' using errcode = 'P0001';
  end if;
  if new.status not in ('pendente', 'confirmado', 'recusado', 'descartado') then
    raise exception 'Resposta inválida.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists convite_peneira_so_status on public.peneira_convites;
create trigger convite_peneira_so_status before update on public.peneira_convites
  for each row execute function public.convite_peneira_so_status();

-- ===== 5. Políticas (RLS) =====
drop policy if exists "Creator can manage own peneiras" on public.peneiras;
drop policy if exists "Anyone can view open peneiras" on public.peneiras;

create policy "Publico ve peneiras aprovadas e abertas" on public.peneiras
  for select to anon, authenticated using (status = 'aberta' and aprovacao_status = 'aprovada');
create policy "Criador ve as proprias peneiras" on public.peneiras
  for select to authenticated using (criador_id = auth.uid());
create policy "Convidado ve a peneira do convite" on public.peneiras
  for select to authenticated using (public.eh_convidado_peneira(id));
create policy "Criador cria peneira" on public.peneiras
  for insert to authenticated with check (criador_id = auth.uid());
create policy "Criador edita as proprias peneiras" on public.peneiras
  for update to authenticated using (criador_id = auth.uid()) with check (criador_id = auth.uid());
create policy "Criador apaga as proprias peneiras" on public.peneiras
  for delete to authenticated using (criador_id = auth.uid());

-- convites: o organizador só vê; criar convite é só pela função peneira_convidar
drop policy if exists "Creator can manage convites" on public.peneira_convites;
create policy "Criador ve os convites da peneira" on public.peneira_convites
  for select to authenticated using (public.eh_criador_peneira(peneira_id));

-- ===== 6. Endereço e contatos não são mais legíveis pela API (só por função) =====
revoke select on public.peneiras from anon, authenticated;
grant select (id, criador_id, criador_perfil_rede_id, titulo, descricao, data_evento, data_fim, local_nome, cidade, estado,
              modalidade, categorias, posicoes, vagas, requisitos, banner_url, status, alcance, filtro_status_federado,
              created_at, updated_at, aprovacao_status, aprovacao_nota)
  on public.peneiras to anon, authenticated;
-- (colunas novas da tabela peneiras precisam ser liberadas aqui, uma a uma, se for para a API lê-las)

-- Detalhes sensíveis: organizador, admin e quem confirmou o convite
create or replace function public.peneira_privado(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  if auth.uid() is null then raise exception 'entre na sua conta' using errcode = '28000'; end if;
  select local_endereco, contato_whatsapp, contato_email, criador_id into r from public.peneiras where id = p_id;
  if not found then return null; end if;
  if r.criador_id = auth.uid() or public.eh_admin_atual()
     or exists (select 1 from public.peneira_convites c where c.peneira_id = p_id and c.atleta_user_id = auth.uid() and c.status = 'confirmado')
  then
    return jsonb_build_object('local_endereco', r.local_endereco, 'contato_whatsapp', r.contato_whatsapp, 'contato_email', r.contato_email);
  end if;
  return null;
end $$;

-- ===== 7. Convidar (única porta para criar convite) =====
create or replace function public.peneira_convidar(p_peneira uuid, p_perfis uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_p public.peneiras%rowtype;
  v_cats int[];
  v_num int;
  v_users uuid[] := '{}';
  v_hoje int;
  v_total int := coalesce(array_length(p_perfis, 1), 0);
  r record;
begin
  if v_uid is null then raise exception 'entre na sua conta' using errcode = '28000'; end if;
  select * into v_p from public.peneiras where id = p_peneira;
  if not found or v_p.criador_id <> v_uid then raise exception 'peneira não encontrada' using errcode = 'P0001'; end if;
  if v_p.aprovacao_status <> 'aprovada' then
    raise exception 'A peneira ainda não foi aprovada pelo Carreira ID.' using errcode = 'P0001';
  end if;
  if v_p.status <> 'aberta' or v_p.data_evento < now() then
    raise exception 'Esta peneira não está aberta.' using errcode = 'P0001';
  end if;
  if v_total = 0 then raise exception 'Escolha ao menos um atleta.' using errcode = 'P0001'; end if;
  if v_total > 50 then raise exception 'No máximo 50 atletas por envio.' using errcode = 'P0001'; end if;
  select count(*) into v_hoje from public.peneira_convites where peneira_id = p_peneira and created_at >= now() - interval '24 hours';
  if v_hoje + v_total > 50 then
    raise exception 'Limite de 50 convites por dia nesta peneira. Tente amanhã.' using errcode = 'P0001';
  end if;

  v_cats := array(select nullif(regexp_replace(c, '\D', '', 'g'), '')::int from unnest(coalesce(v_p.categorias, '{}')) c);

  for r in
    select id, user_id, categoria from public.perfil_atleta
     where id = any(p_perfis) and coalesce(is_public, false) and aceita_convites_peneira
  loop
    v_num := nullif(regexp_replace(coalesce(r.categoria, ''), '\D', '', 'g'), '')::int;
    if coalesce(array_length(v_cats, 1), 0) > 0 and (v_num is null or not (v_num = any(v_cats))) then
      continue;
    end if;
    insert into public.peneira_convites (peneira_id, atleta_perfil_id, atleta_user_id)
    values (p_peneira, r.id, r.user_id)
    on conflict (peneira_id, atleta_perfil_id) do nothing;
    if found then v_users := v_users || r.user_id; end if;
  end loop;

  return jsonb_build_object('convidados', coalesce(array_length(v_users, 1), 0), 'user_ids', to_jsonb(v_users),
                            'ignorados', v_total - coalesce(array_length(v_users, 1), 0));
end $$;

-- ===== 8. Admin: aprovar peneira, verificar organizador =====
create or replace function public.admin_listar_peneiras(p_status text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin_atual() then raise exception 'acesso restrito ao admin' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select p.id, p.titulo, p.descricao, p.data_evento, p.local_nome, p.local_endereco, p.cidade, p.estado, p.modalidade,
             p.categorias, p.vagas, p.requisitos, p.contato_whatsapp, p.contato_email, p.status, p.aprovacao_status, p.aprovacao_nota,
             p.created_at, p.criador_id,
             (select r.nome from public.perfis_rede r where r.id = p.criador_perfil_rede_id) as organizador,
             (select r.tipo from public.perfis_rede r where r.id = p.criador_perfil_rede_id) as organizador_tipo,
             (select coalesce(r.verificado, false) from public.perfis_rede r where r.id = p.criador_perfil_rede_id) as organizador_verificado,
             (select count(*) from public.peneira_convites c where c.peneira_id = p.id) as convites
        from public.peneiras p
       where p_status is null or p.aprovacao_status = p_status
       limit 300
    ) x
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_aprovar_peneira(p_id uuid, p_aprovar boolean, p_nota text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin_atual() then raise exception 'acesso restrito ao admin' using errcode = '42501'; end if;
  update public.peneiras
     set aprovacao_status = case when p_aprovar then 'aprovada' else 'recusada' end,
         aprovacao_nota = nullif(trim(p_nota), ''), aprovada_em = now(), aprovada_por = auth.uid()
   where id = p_id;
end $$;

create or replace function public.admin_listar_organizadores() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin_atual() then raise exception 'acesso restrito ao admin' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.verificado, x.nome) from (
      select r.id, r.user_id, r.nome, r.tipo, r.cidade, r.verificado, r.verificado_em, r.created_at,
             (select count(*) from public.peneiras p where p.criador_id = r.user_id) as peneiras
        from public.perfis_rede r
       where r.tipo in ('tecnico', 'scout', 'agente_clube', 'dono_escola')
       limit 500
    ) x
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_verificar_organizador(p_id uuid, p_verificado boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin_atual() then raise exception 'acesso restrito ao admin' using errcode = '42501'; end if;
  update public.perfis_rede
     set verificado = p_verificado, verificado_em = case when p_verificado then now() else null end,
         verificado_por = case when p_verificado then auth.uid() else null end
   where id = p_id;
end $$;

-- ===== 9. Permissões das funções =====
revoke all on function public.eh_criador_peneira(uuid), public.eh_convidado_peneira(uuid), public.eh_admin_atual(),
  public.peneira_privado(uuid), public.peneira_convidar(uuid, uuid[]), public.admin_listar_peneiras(text),
  public.admin_aprovar_peneira(uuid, boolean, text), public.admin_listar_organizadores(),
  public.admin_verificar_organizador(uuid, boolean) from public, anon;
grant execute on function public.eh_criador_peneira(uuid), public.eh_convidado_peneira(uuid), public.eh_admin_atual(),
  public.peneira_privado(uuid), public.peneira_convidar(uuid, uuid[]), public.admin_listar_peneiras(text),
  public.admin_aprovar_peneira(uuid, boolean, text), public.admin_listar_organizadores(),
  public.admin_verificar_organizador(uuid, boolean) to authenticated;
