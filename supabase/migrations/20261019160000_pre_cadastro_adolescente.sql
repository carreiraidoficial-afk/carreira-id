-- Cadastro iniciado pelo adolescente (12 a 17 anos) com anuência do responsável.
-- O adolescente NÃO cria perfil: os dados ficam aqui, fechados, até o responsável confirmar pelo link.
-- Na confirmação, o perfil nasce no nome do RESPONSÁVEL (mesmo modelo de sempre) e o adolescente vira colaborador
-- ativo com permissão de editar o perfil. Nenhuma tabela existente muda.

create table if not exists public.pre_cadastro_adolescente (
  id uuid primary key default gen_random_uuid(),
  adolescente_user_id uuid not null,
  nome text not null,
  data_nascimento date not null,
  modalidade text not null default 'Futebol',
  categoria text,
  cidade text,
  estado text,
  pais text not null default 'Brasil',
  responsavel_nome text not null,
  responsavel_whatsapp text not null,
  responsavel_email text,
  token_hash text not null,
  status text not null default 'pendente' check (status in ('pendente','aprovado','recusado','expirado')),
  expira_em timestamptz not null,
  reenvios int not null default 0,
  -- prova da anuência
  responsavel_user_id uuid,
  anuencia_em timestamptz,
  anuencia_termo_versao text,
  anuencia_ip text,
  anuencia_user_agent text,
  crianca_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pre_cadastro_adolescente_ativo_uq
  on public.pre_cadastro_adolescente (adolescente_user_id) where status in ('pendente','expirado');
create unique index if not exists pre_cadastro_adolescente_token_uq on public.pre_cadastro_adolescente (token_hash);

alter table public.pre_cadastro_adolescente enable row level security;
revoke all on public.pre_cadastro_adolescente from public, anon, authenticated;
-- sem política: ninguém lê ou grava direto; só as funções abaixo.

-- ---------- auxiliares ----------
create or replace function public._pre_cadastro_hash(p_token text) returns text
language sql immutable set search_path to 'public' as $$
  select encode(sha256(convert_to(coalesce(p_token,''), 'utf8')), 'hex')
$$;

create or replace function public._pre_cadastro_token() returns text
language sql volatile set search_path to 'public' as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
$$;

create or replace function public._cpf_valido(p text) returns boolean
language plpgsql immutable set search_path to 'public' as $fn$
declare c text := regexp_replace(coalesce(p,''), '\D', '', 'g'); s int; d1 int; d2 int; i int;
begin
  if length(c) <> 11 or c ~ '^(\d)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(c,i,1)::int * (11 - i); end loop;
  d1 := (s * 10) % 11; if d1 = 10 then d1 := 0; end if;
  s := 0; for i in 1..10 loop s := s + substr(c,i,1)::int * (12 - i); end loop;
  d2 := (s * 10) % 11; if d2 = 10 then d2 := 0; end if;
  return d1 = substr(c,10,1)::int and d2 = substr(c,11,1)::int;
end $fn$;

revoke all on function public._pre_cadastro_hash(text), public._pre_cadastro_token(), public._cpf_valido(text) from public, anon, authenticated;

-- ---------- adolescente ----------
create or replace function public.adolescente_criar_pre_cadastro(
  p_nome text, p_data_nascimento date, p_modalidade text, p_categoria text,
  p_cidade text, p_estado text, p_pais text,
  p_resp_nome text, p_resp_whatsapp text, p_resp_email text
) returns jsonb
language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_uid uuid := auth.uid();
  v_idade int;
  v_tel text := regexp_replace(coalesce(p_resp_whatsapp,''), '\D', '', 'g');
  v_email text := nullif(lower(btrim(coalesce(p_resp_email,''))), '');
  v_token text := public._pre_cadastro_token();
  v_exp timestamptz := now() + interval '7 days';
  v_id uuid;
begin
  if v_uid is null then raise exception 'Faça login para continuar.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_nome,''))) < 2 or length(p_nome) > 120 then raise exception 'Informe o nome do atleta.'; end if;
  if p_data_nascimento is null then raise exception 'Informe a data de nascimento.'; end if;
  v_idade := extract(year from age(current_date, p_data_nascimento));
  if v_idade < 12 then raise exception 'O cadastro próprio é a partir de 12 anos. Peça para seu responsável criar o perfil.'; end if;
  if v_idade >= 18 then raise exception 'Maiores de 18 anos fazem o cadastro comum.'; end if;
  if length(btrim(coalesce(p_resp_nome,''))) < 2 or length(p_resp_nome) > 120 then raise exception 'Informe o nome do responsável.'; end if;
  if length(v_tel) < 10 or length(v_tel) > 15 then raise exception 'Confira o WhatsApp do responsável.'; end if;
  if v_email is not null and (length(v_email) > 255 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$') then raise exception 'Confira o e-mail do responsável.'; end if;
  if exists (select 1 from public.perfil_atleta where user_id = v_uid) or exists (select 1 from public.perfis_rede where user_id = v_uid) then
    raise exception 'Esta conta já tem um perfil.';
  end if;
  if exists (select 1 from public.pre_cadastro_adolescente where adolescente_user_id = v_uid and status = 'aprovado') then
    raise exception 'Seu cadastro já foi aprovado pelo responsável.';
  end if;

  insert into public.pre_cadastro_adolescente as t (
    adolescente_user_id, nome, data_nascimento, modalidade, categoria, cidade, estado, pais,
    responsavel_nome, responsavel_whatsapp, responsavel_email, token_hash, status, expira_em)
  values (v_uid, btrim(p_nome), p_data_nascimento, coalesce(nullif(btrim(p_modalidade),''),'Futebol'), nullif(btrim(coalesce(p_categoria,'')),''),
          nullif(btrim(coalesce(p_cidade,'')),''), nullif(btrim(coalesce(p_estado,'')),''), coalesce(nullif(btrim(coalesce(p_pais,'')),''),'Brasil'),
          btrim(p_resp_nome), v_tel, v_email, public._pre_cadastro_hash(v_token), 'pendente', v_exp)
  on conflict (adolescente_user_id) where status in ('pendente','expirado') do update set
    nome = excluded.nome, data_nascimento = excluded.data_nascimento, modalidade = excluded.modalidade, categoria = excluded.categoria,
    cidade = excluded.cidade, estado = excluded.estado, pais = excluded.pais, responsavel_nome = excluded.responsavel_nome,
    responsavel_whatsapp = excluded.responsavel_whatsapp, responsavel_email = excluded.responsavel_email,
    token_hash = excluded.token_hash, status = 'pendente', expira_em = excluded.expira_em, updated_at = now()
  returning t.id into v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'expira_em', v_exp);
end $fn$;

create or replace function public.adolescente_meu_pre_cadastro() returns jsonb
language plpgsql security definer set search_path to 'public' as $fn$
declare r public.pre_cadastro_adolescente;
begin
  if auth.uid() is null then return null; end if;
  select * into r from public.pre_cadastro_adolescente where adolescente_user_id = auth.uid() order by created_at desc limit 1;
  if not found then return null; end if;
  if r.status = 'pendente' and r.expira_em < now() then
    update public.pre_cadastro_adolescente set status = 'expirado', updated_at = now() where id = r.id;
    r.status := 'expirado';
  end if;
  return jsonb_build_object('id', r.id, 'status', r.status, 'nome', r.nome, 'modalidade', r.modalidade,
    'responsavel_nome', r.responsavel_nome, 'responsavel_whatsapp', r.responsavel_whatsapp, 'responsavel_email', r.responsavel_email,
    'expira_em', r.expira_em, 'reenvios', r.reenvios);
end $fn$;

-- Gera um link novo (o anterior deixa de valer) e estende o prazo.
create or replace function public.adolescente_reenviar_link() returns jsonb
language plpgsql security definer set search_path to 'public' as $fn$
declare r public.pre_cadastro_adolescente; v_token text := public._pre_cadastro_token(); v_exp timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null then raise exception 'Faça login para continuar.' using errcode = '42501'; end if;
  select * into r from public.pre_cadastro_adolescente
   where adolescente_user_id = auth.uid() and status in ('pendente','expirado') for update;
  if not found then raise exception 'Nenhum cadastro aguardando o responsável.'; end if;
  if r.reenvios >= 20 then raise exception 'Limite de reenvios atingido. Fale com o suporte.'; end if;
  update public.pre_cadastro_adolescente
     set token_hash = public._pre_cadastro_hash(v_token), status = 'pendente', expira_em = v_exp, reenvios = reenvios + 1, updated_at = now()
   where id = r.id;
  return jsonb_build_object('token', v_token, 'expira_em', v_exp);
end $fn$;

-- ---------- responsável ----------
-- Página do link: mostra só o necessário para o responsável entender o pedido (nunca contato nem data de nascimento).
create or replace function public.responsavel_ver_pre_cadastro(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $fn$
declare r public.pre_cadastro_adolescente;
begin
  select * into r from public.pre_cadastro_adolescente where token_hash = public._pre_cadastro_hash(p_token);
  if not found then return jsonb_build_object('status', 'invalido'); end if;
  if r.status = 'pendente' and r.expira_em < now() then return jsonb_build_object('status', 'expirado'); end if;
  if r.status <> 'pendente' then return jsonb_build_object('status', r.status); end if;
  return jsonb_build_object('status', 'pendente', 'primeiro_nome', split_part(r.nome, ' ', 1),
    'modalidade', r.modalidade, 'responsavel_nome', r.responsavel_nome, 'expira_em', r.expira_em);
end $fn$;

create or replace function public.responsavel_recusar_pre_cadastro(p_token text) returns boolean
language plpgsql security definer set search_path to 'public' as $fn$
declare v_n int;
begin
  update public.pre_cadastro_adolescente set status = 'recusado', updated_at = now(),
         responsavel_whatsapp = '', responsavel_email = null
   where token_hash = public._pre_cadastro_hash(p_token) and status = 'pendente' and expira_em >= now();
  get diagnostics v_n = row_count;
  return v_n > 0;
end $fn$;

-- Confirma: cria o perfil no nome do responsável e libera o adolescente como colaborador com edição.
create or replace function public.responsavel_aprovar_pre_cadastro(p_token text, p_cpf text, p_termo_versao text) returns jsonb
language plpgsql security definer set search_path to 'public' as $fn$
declare
  r public.pre_cadastro_adolescente;
  v_uid uuid := auth.uid();
  v_crianca uuid := gen_random_uuid();
  v_slug text;
  v_cpf text := regexp_replace(coalesce(p_cpf,''), '\D', '', 'g');
  v_headers jsonb;
  v_fam record;
begin
  if v_uid is null then raise exception 'Faça login para continuar.' using errcode = '42501'; end if;
  select * into r from public.pre_cadastro_adolescente
   where token_hash = public._pre_cadastro_hash(p_token) for update;
  if not found or r.status <> 'pendente' or r.expira_em < now() then raise exception 'Este link não é mais válido. Peça ao atleta para enviar um novo.'; end if;
  if r.adolescente_user_id = v_uid then raise exception 'A confirmação precisa ser feita pelo responsável, com a conta dele.' using errcode = '42501'; end if;
  if not public._cpf_valido(v_cpf) then raise exception 'CPF inválido. Confira os números.'; end if;
  if length(btrim(coalesce(p_termo_versao,''))) = 0 then raise exception 'Termo de anuência não informado.'; end if;

  v_slug := lower(regexp_replace(translate(r.nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'), '[^a-zA-Z0-9 -]', '', 'g'));
  v_slug := regexp_replace(btrim(v_slug), '\s+', '-', 'g');
  v_slug := regexp_replace(v_slug, '-+', '-', 'g') || '-' || substr(md5(random()::text), 1, 4);

  insert into public.criancas (id, nome, data_nascimento, ativo) values (v_crianca, r.nome, r.data_nascimento, true);
  insert into public.perfil_atleta (user_id, nome, slug, modalidade, categoria, cidade, estado, pais, crianca_id, is_public,
                                    cpf_cnpj, tipo_documento, telefone_whatsapp, origem)
  values (v_uid, r.nome, v_slug, r.modalidade, r.categoria, r.cidade, r.estado, r.pais, v_crianca, true,
          v_cpf, 'cpf',
          -- o app guarda número brasileiro sem o 55 e internacional com "+"
          case when r.responsavel_whatsapp ~ '^55\d{10,11}$' then substr(r.responsavel_whatsapp, 3) else '+' || r.responsavel_whatsapp end,
          'carreira');

  -- Mesma regra do cadastro comum: entra no plano Família ativo do responsável, se houver; senão, 7 dias de teste do Elite.
  if not exists (select 1 from public.carreira_assinaturas where user_id = v_uid and crianca_id = v_crianca) then
    select id, metodo_pagamento, inicio_em, expira_em into v_fam from public.carreira_assinaturas_familia
     where user_id = v_uid and status = 'ativa' limit 1;
    if found then
      insert into public.carreira_assinaturas (user_id, crianca_id, plano, status, familia_id, metodo_pagamento, inicio_em, expira_em)
      values (v_uid, v_crianca, 'premium', 'ativa', v_fam.id, v_fam.metodo_pagamento, v_fam.inicio_em, v_fam.expira_em);
    else
      insert into public.carreira_assinaturas (user_id, crianca_id, plano, status, valor, expira_em, metodo_pagamento, inicio_em)
      values (v_uid, v_crianca, 'premium', 'trial', 12.00, current_date + 15, null, now());
    end if;
  end if;

  insert into public.perfil_atleta_colaboradores (crianca_id, nome, codigo_convite, convidado_por, user_id, status, ativado_em, pode_editar_perfil)
  values (v_crianca, r.nome, upper(substr(md5(random()::text), 1, 6)), v_uid, r.adolescente_user_id, 'ativo', now(), true);

  begin v_headers := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then v_headers := null; end;

  update public.pre_cadastro_adolescente set
    status = 'aprovado', responsavel_user_id = v_uid, anuencia_em = now(), anuencia_termo_versao = btrim(p_termo_versao),
    anuencia_ip = split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1),
    anuencia_user_agent = left(coalesce(v_headers->>'user-agent', ''), 300),
    crianca_id = v_crianca, responsavel_whatsapp = '', responsavel_email = null, updated_at = now()
   where id = r.id;

  return jsonb_build_object('slug', v_slug, 'crianca_id', v_crianca);
end $fn$;

-- ---------- limpeza ----------
-- Pendentes vencidos viram "expirado"; expirados/recusados há mais de 14 dias são apagados (sem dado pessoal do menor).
create or replace function public.pre_cadastro_adolescente_limpar() returns void
language plpgsql security definer set search_path to 'public' as $fn$
begin
  update public.pre_cadastro_adolescente set status = 'expirado', updated_at = now() where status = 'pendente' and expira_em < now();
  delete from public.pre_cadastro_adolescente where status in ('expirado','recusado') and updated_at < now() - interval '14 days';
end $fn$;

-- ---------- permissões ----------
revoke all on function public.adolescente_criar_pre_cadastro(text,date,text,text,text,text,text,text,text,text) from public, anon;
revoke all on function public.adolescente_meu_pre_cadastro() from public, anon;
revoke all on function public.adolescente_reenviar_link() from public, anon;
revoke all on function public.responsavel_ver_pre_cadastro(text) from public;
revoke all on function public.responsavel_recusar_pre_cadastro(text) from public;
revoke all on function public.responsavel_aprovar_pre_cadastro(text,text,text) from public, anon;
revoke all on function public.pre_cadastro_adolescente_limpar() from public, anon, authenticated;
grant execute on function public.adolescente_criar_pre_cadastro(text,date,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.adolescente_meu_pre_cadastro() to authenticated;
grant execute on function public.adolescente_reenviar_link() to authenticated;
grant execute on function public.responsavel_ver_pre_cadastro(text) to anon, authenticated;
grant execute on function public.responsavel_recusar_pre_cadastro(text) to anon, authenticated;
grant execute on function public.responsavel_aprovar_pre_cadastro(text,text,text) to authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('pre-cadastro-adolescente-limpar', '17 3 * * *', 'select public.pre_cadastro_adolescente_limpar()');
  end if;
exception when others then null;
end $$;
