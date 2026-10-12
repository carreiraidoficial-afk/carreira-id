-- Contato do responsável de cada time (quem cadastrou o time na plataforma do campeonato), para o Carreira ID oferecer o app às equipes.
-- Mesmo regime do restante do backup: schema fechado para a API; leitura/atualização só por funções restritas a admin.
-- São dados de adultos responsáveis por times, usados apenas para contato comercial do Carreira ID; nunca exibidos publicamente.

create table if not exists campeonatos_backup.contato_time (
  id uuid primary key default gen_random_uuid(),
  fonte text not null,
  fonte_time_id text not null,
  nome_time text not null,
  responsavel_nome text,
  email text,
  telefone text,
  cidade text,
  estado text,
  origem text,
  coletado_em timestamptz not null default now(),
  -- acompanhamento da abordagem
  status_contato text not null default 'nao_contatado'
    check (status_contato in ('nao_contatado', 'contatado', 'respondeu', 'interessado', 'sem_interesse', 'parceiro')),
  contatado_em timestamptz,
  observacao text,
  unique (fonte, fonte_time_id)
);
alter table campeonatos_backup.contato_time enable row level security;
revoke all on campeonatos_backup.contato_time from public, anon, authenticated;

-- Lista de contatos + categorias em que o time jogou e quantos atletas tem guardados
create or replace function public.backup_contatos() returns jsonb
language plpgsql stable security definer set search_path = public, campeonatos_backup as $$
begin
  perform public.backup_checar_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.nome_time) from (
      select ct.id, ct.nome_time, ct.responsavel_nome, ct.email, ct.telefone, ct.cidade, ct.estado,
        ct.status_contato, ct.contatado_em, ct.observacao, ct.origem,
        (select string_agg(distinct c.categoria, ', ' order by c.categoria)
           from campeonatos_backup.time t join campeonatos_backup.campeonato c on c.id = t.campeonato_id
          where t.fonte_time_id = ct.fonte_time_id) as categorias,
        (select count(*) from campeonatos_backup.jogador j join campeonatos_backup.time t on t.id = j.time_id
          where t.fonte_time_id = ct.fonte_time_id and j.papel = 'jogador') as atletas,
        (select count(*) from campeonatos_backup.jogador j join campeonatos_backup.time t on t.id = j.time_id
          where t.fonte_time_id = ct.fonte_time_id and j.papel = 'comissao') as comissao
      from campeonatos_backup.contato_time ct
    ) x
  ), '[]'::jsonb);
end $$;

-- Atualiza o acompanhamento da abordagem (status e observação)
create or replace function public.backup_contato_atualizar(p_id uuid, p_status text, p_observacao text default null) returns void
language plpgsql security definer set search_path = public, campeonatos_backup as $$
begin
  perform public.backup_checar_admin();
  update campeonatos_backup.contato_time
     set status_contato = p_status,
         observacao = p_observacao,
         contatado_em = case when p_status = 'nao_contatado' then null else coalesce(contatado_em, now()) end
   where id = p_id;
end $$;

revoke all on function public.backup_contatos(), public.backup_contato_atualizar(uuid, text, text) from public, anon;
grant execute on function public.backup_contatos(), public.backup_contato_atualizar(uuid, text, text) to authenticated;
