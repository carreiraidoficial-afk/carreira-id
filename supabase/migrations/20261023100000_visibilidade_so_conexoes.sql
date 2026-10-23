-- Terceira camada de visibilidade do perfil de atleta: "só conexões aprovadas".
--   is_public = true                              -> público (qualquer pessoa com o link)
--   is_public = false, restrito_conexoes = false  -> só quem tem conta (como já era)
--   is_public = false, restrito_conexoes = true   -> só conexões aprovadas, o responsável/colaboradores e o admin
-- Os perfis que existem hoje continuam exatamente como estão (a coluna nova começa em false).

alter table public.perfil_atleta add column if not exists restrito_conexoes boolean not null default false;

-- Perfil público nunca fica "restrito": quem liga o público (em qualquer tela) desliga o restrito junto.
create or replace function public.perfil_atleta_coerencia_visibilidade()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.is_public then
    new.restrito_conexoes := false;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_perfil_atleta_coerencia_visibilidade on public.perfil_atleta;
create trigger trg_perfil_atleta_coerencia_visibilidade
  before insert or update of is_public, restrito_conexoes on public.perfil_atleta
  for each row execute function public.perfil_atleta_coerencia_visibilidade();

-- Quem pode ver um perfil restrito: o dono, colaborador ativo, conexão aceita, e quem recebeu um pedido que o próprio dono fez
-- (para a escola/pessoa conseguir ver quem está pedindo). Um pedido que OUTRA pessoa fez ao perfil não dá acesso até ser aprovado.
create or replace function public.atleta_acessivel_por_conexao(p_user_id uuid, p_crianca_id uuid, p_perfil_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null and (
    auth.uid() = p_user_id
    or public.is_perfil_atleta_owner_or_colaborador(auth.uid(), p_crianca_id)
    or exists (
      select 1 from public.rede_conexoes r
      where (
        r.status = 'aceita'
        and (
          (r.solicitante_id = auth.uid() and r.destinatario_id = p_user_id
            and (r.destinatario_perfil_atleta_id is null or r.destinatario_perfil_atleta_id = p_perfil_id))
          or (r.destinatario_id = auth.uid() and r.solicitante_id = p_user_id
            and (r.solicitante_perfil_atleta_id is null or r.solicitante_perfil_atleta_id = p_perfil_id))
        )
      ) or (
        r.status = 'pendente'
        and r.solicitante_id = p_user_id and r.destinatario_id = auth.uid()
        and (r.solicitante_perfil_atleta_id is null or r.solicitante_perfil_atleta_id = p_perfil_id)
      )
    )
  );
$function$;

revoke execute on function public.atleta_acessivel_por_conexao(uuid, uuid, uuid) from public;
grant execute on function public.atleta_acessivel_por_conexao(uuid, uuid, uuid) to anon, authenticated;

-- Quem tem conta continua vendo os perfis que não são públicos, menos os restritos às conexões.
drop policy if exists "Usuarios logados podem ver perfis de atletas nao publicos" on public.perfil_atleta;
create policy "Usuarios logados podem ver perfis de atletas nao publicos" on public.perfil_atleta
  for select to authenticated
  using (not restrito_conexoes or public.atleta_acessivel_por_conexao(user_id, crianca_id, id));

-- As experiências também eram abertas a qualquer conta: passam a respeitar o perfil restrito.
-- A checagem fica numa função do banco (e não numa subconsulta na regra): a subconsulta passaria pelas regras da própria
-- tabela de perfis, que escondem justamente o perfil restrito, e a experiência apareceria mesmo assim.
create or replace function public.crianca_perfil_restrito_inacessivel(p_crianca_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.perfil_atleta p
    where p.crianca_id = p_crianca_id
      and p.restrito_conexoes
      and not public.atleta_acessivel_por_conexao(p.user_id, p.crianca_id, p.id)
  );
$function$;

revoke execute on function public.crianca_perfil_restrito_inacessivel(uuid) from public;
grant execute on function public.crianca_perfil_restrito_inacessivel(uuid) to anon, authenticated;

drop policy if exists "Logado ve experiencias" on public.carreira_experiencias;
create policy "Logado ve experiencias" on public.carreira_experiencias
  for select to authenticated
  using (not public.crianca_perfil_restrito_inacessivel(crianca_id));

-- Fecha a brecha das conexões para o que a camada protege: ninguém cria uma conexão já ACEITA com o dono de um perfil
-- restrito. Vira pedido pendente e o responsável aprova (o aprovar é um UPDATE feito só pelo destinatário).
create or replace function public.rede_conexoes_respeita_perfil_restrito()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'aceita'
     and not public.has_role(auth.uid(), 'admin'::user_role)
     and exists (
       select 1 from public.perfil_atleta p
       where p.user_id = new.destinatario_id
         and p.restrito_conexoes
         and (new.destinatario_perfil_atleta_id is null or new.destinatario_perfil_atleta_id = p.id)
     )
     and new.solicitante_id is distinct from new.destinatario_id then
    new.status := 'pendente';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_rede_conexoes_respeita_perfil_restrito on public.rede_conexoes;
create trigger trg_rede_conexoes_respeita_perfil_restrito
  before insert on public.rede_conexoes
  for each row execute function public.rede_conexoes_respeita_perfil_restrito();

-- Para a tela: o perfil existe mas é restrito? (não devolve nenhum dado do perfil)
create or replace function public.perfil_atleta_e_restrito(p_slug text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.perfil_atleta p
    where p.slug = p_slug and p.restrito_conexoes and not p.is_public
      and not public.atleta_acessivel_por_conexao(p.user_id, p.crianca_id, p.id)
  );
$function$;

-- Pedir conexão com um perfil restrito, sem precisar ver o perfil. Sempre cria um pedido PENDENTE.
create or replace function public.solicitar_conexao_perfil_restrito(p_slug text, p_meu_perfil_atleta_id uuid default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_alvo record;
  v_meu uuid;
begin
  if v_uid is null then raise exception 'Faça login para pedir conexão'; end if;

  select p.id, p.user_id into v_alvo
  from public.perfil_atleta p
  where p.slug = p_slug and p.restrito_conexoes and not p.is_public
  limit 1;
  if v_alvo.id is null then raise exception 'Perfil não encontrado'; end if;
  if v_alvo.user_id = v_uid then raise exception 'Este perfil é seu'; end if;

  -- só vale um perfil de atleta que seja da própria pessoa
  if p_meu_perfil_atleta_id is not null then
    select p.id into v_meu from public.perfil_atleta p where p.id = p_meu_perfil_atleta_id and p.user_id = v_uid;
  end if;

  if exists (
    select 1 from public.rede_conexoes r
    where r.solicitante_id = v_uid and r.destinatario_id = v_alvo.user_id
      and r.destinatario_perfil_atleta_id = v_alvo.id and r.status in ('pendente', 'aceita')
  ) then
    return 'ja_existe';
  end if;

  insert into public.rede_conexoes (solicitante_id, destinatario_id, status, solicitante_perfil_atleta_id, destinatario_perfil_atleta_id)
  values (v_uid, v_alvo.user_id, 'pendente', v_meu, v_alvo.id);
  return 'pendente';
end;
$function$;

revoke execute on function public.perfil_atleta_e_restrito(text) from public;
revoke execute on function public.solicitar_conexao_perfil_restrito(text, uuid) from public;
grant execute on function public.perfil_atleta_e_restrito(text) to anon, authenticated;
grant execute on function public.solicitar_conexao_perfil_restrito(text, uuid) to authenticated;

-- A tabela de perfis só entrega colunas liberadas (telefone/CPF ficam de fora): libera a nova, que é só um sim/não.
grant select (restrito_conexoes) on public.perfil_atleta to anon, authenticated;
