-- O responsável escolhe, ao autorizar, se o perfil do adolescente fica público (qualquer pessoa com o link)
-- ou visível só para quem tem conta no Carreira ID.

drop function if exists public.responsavel_aprovar_pre_cadastro(text, text, text);

create or replace function public.responsavel_aprovar_pre_cadastro(p_token text, p_cpf text, p_termo_versao text, p_perfil_publico boolean default true) returns jsonb
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
  v_esc record;
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
  values (v_uid, r.nome, v_slug, r.modalidade, r.categoria, r.cidade, r.estado, r.pais, v_crianca, coalesce(p_perfil_publico, true),
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

  -- Link da escola (?escola=slug): pedido de vínculo PENDENTE com a escola (a escola confirma que é aluno), como no cadastro comum.
  if r.escola_slug is not null then
    begin
      select rr.id, rr.user_id, rr.dados_perfil into v_esc from public.perfis_rede rr where rr.slug = r.escola_slug and rr.tipo = 'dono_escola' limit 1;
      if found and v_esc.user_id <> v_uid and not exists (
        select 1 from public.rede_conexoes x where x.solicitante_id = v_uid and x.destinatario_id = v_esc.user_id and x.solicitante_perfil_atleta_id = v_perfil) then
        insert into public.rede_conexoes (solicitante_id, destinatario_id, status, origem, solicitante_perfil_atleta_id, unidade_nome)
        values (v_uid, v_esc.user_id, 'pendente', 'convite', v_perfil,
          case when r.unidade is not null and exists (select 1 from jsonb_array_elements(coalesce(v_esc.dados_perfil->'unidades', '[]'::jsonb)) u where u->>'nome' = r.unidade) then r.unidade else null end);
      end if;
    exception when others then raise warning 'vinculo da escola (adolescente): %', sqlerrm; end;
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

revoke all on function public.responsavel_aprovar_pre_cadastro(text, text, text, boolean) from public, anon;
grant execute on function public.responsavel_aprovar_pre_cadastro(text, text, text, boolean) to authenticated;
