-- Lista de atletas com acesso antecipado a um recurso em teste (ex.: currículo em PDF), independente do plano.
-- Os atletas liberados entram por SQL/admin (nenhum atleta fica gravado no código ou na migration, porque o repositório é público).
-- Quando o recurso for liberado para todos, ele passa a seguir a chave do plano em Admin → Planos e esta lista deixa de ser necessária.

create table if not exists public.carreira_recursos_liberados (
  recurso text not null,
  crianca_id uuid not null,
  observacao text,
  created_at timestamptz not null default now(),
  primary key (recurso, crianca_id)
);

alter table public.carreira_recursos_liberados enable row level security;

-- O dono (ou colaborador) do atleta enxerga só os recursos liberados para o próprio atleta.
create policy "Dono ou colaborador ve os recursos liberados do atleta" on public.carreira_recursos_liberados
  for select to authenticated
  using (public.is_perfil_atleta_owner_or_colaborador(auth.uid(), crianca_id));

-- Só o admin libera ou retira.
create policy "Admin gerencia os recursos liberados" on public.carreira_recursos_liberados
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::user_role))
  with check (public.has_role(auth.uid(), 'admin'::user_role));
