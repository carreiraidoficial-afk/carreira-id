-- Adolescente que chega pelo link da escola: o código do convite acompanha o pré-cadastro e, quando o responsável autoriza,
-- o vínculo (pendente de confirmação da escola) é criado como no cadastro comum.

alter table public.pre_cadastro_adolescente add column if not exists convite_codigo text;

drop function if exists public.adolescente_criar_pre_cadastro(text,date,text,text,text,text,text,text,text,text);

create or replace function public.adolescente_criar_pre_cadastro(
  p_nome text, p_data_nascimento date, p_modalidade text, p_categoria text,
  p_cidade text, p_estado text, p_pais text,
  p_resp_nome text, p_resp_whatsapp text, p_resp_email text,
  p_convite_codigo text default null
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
    responsavel_nome, responsavel_whatsapp, responsavel_email, token_hash, status, expira_em, convite_codigo)
  values (v_uid, btrim(p_nome), p_data_nascimento, coalesce(nullif(btrim(p_modalidade),''),'Futebol'), nullif(btrim(coalesce(p_categoria,'')),''),
          nullif(btrim(coalesce(p_cidade,'')),''), nullif(btrim(coalesce(p_estado,'')),''), coalesce(nullif(btrim(coalesce(p_pais,'')),''),'Brasil'),
          btrim(p_resp_nome), v_tel, v_email, public._pre_cadastro_hash(v_token), 'pendente', v_exp,
          left(nullif(btrim(coalesce(p_convite_codigo,'')),''), 40))
  on conflict (adolescente_user_id) where status in ('pendente','expirado') do update set
    nome = excluded.nome, data_nascimento = excluded.data_nascimento, modalidade = excluded.modalidade, categoria = excluded.categoria,
    cidade = excluded.cidade, estado = excluded.estado, pais = excluded.pais, responsavel_nome = excluded.responsavel_nome,
    responsavel_whatsapp = excluded.responsavel_whatsapp, responsavel_email = excluded.responsavel_email, convite_codigo = excluded.convite_codigo,
    token_hash = excluded.token_hash, status = 'pendente', expira_em = excluded.expira_em, updated_at = now()
  returning t.id into v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'expira_em', v_exp);
end $fn$;

create or replace function public.responsavel_ver_pre_cadastro(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $fn$
declare r public.pre_cadastro_adolescente;
begin
  select * into r from public.pre_cadastro_adolescente where token_hash = public._pre_cadastro_hash(p_token);
  if not found then return jsonb_build_object('status', 'invalido'); end if;
  if r.status = 'pendente' and r.expira_em < now() then return jsonb_build_object('status', 'expirado'); end if;
  if r.status <> 'pendente' then return jsonb_build_object('status', r.status); end if;
  return jsonb_build_object('status', 'pendente', 'primeiro_nome', split_part(r.nome, ' ', 1),
    'modalidade', r.modalidade, 'responsavel_nome', r.responsavel_nome, 'expira_em', r.expira_em,
    'escola_nome', case when r.convite_codigo is null then null else
      (select rr.nome from public.perfis_rede rr where rr.convite_codigo = r.convite_codigo and rr.tipo = 'dono_escola' limit 1) end);
end $fn$;

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
  v_perfil uuid;
  v_inv record;
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
          'carreira') returning id into v_perfil;

  -- Convite (ex.: link da escola): mesmo vínculo do cadastro comum. Escola precisa confirmar que é aluno (pendente).
  -- Qualquer falha aqui não impede a autorização.
  if r.convite_codigo is not null then
    begin
      select rr.id, rr.user_id, rr.tipo into v_inv from public.perfis_rede rr where rr.convite_codigo = r.convite_codigo limit 1;
      if found and v_inv.user_id <> v_uid then
        insert into public.rede_convites (convidante_perfil_id, convidado_user_id) values (v_inv.id, v_uid);
        insert into public.rede_conexoes (solicitante_id, destinatario_id, status, origem, solicitante_perfil_atleta_id)
        values (v_uid, v_inv.user_id, case when v_inv.tipo = 'dono_escola' then 'pendente' else 'aceita' end, 'convite', v_perfil);
      end if;
    exception when others then raise warning 'vinculo do convite (adolescente): %', sqlerrm; end;
  end if;

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

revoke all on function public.adolescente_criar_pre_cadastro(text,date,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.adolescente_criar_pre_cadastro(text,date,text,text,text,text,text,text,text,text,text) to authenticated;
revoke all on function public.responsavel_ver_pre_cadastro(text) from public;
grant execute on function public.responsavel_ver_pre_cadastro(text) to anon, authenticated;
revoke all on function public.responsavel_aprovar_pre_cadastro(text,text,text) from public, anon;
grant execute on function public.responsavel_aprovar_pre_cadastro(text,text,text) to authenticated;

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
    'expira_em', r.expira_em, 'reenvios', r.reenvios,
    'escola_nome', case when r.convite_codigo is null then null else
      (select rr.nome from public.perfis_rede rr where rr.convite_codigo = r.convite_codigo and rr.tipo = 'dono_escola' limit 1) end);
end $fn$;
revoke all on function public.adolescente_meu_pre_cadastro() from public, anon;
grant execute on function public.adolescente_meu_pre_cadastro() to authenticated;
