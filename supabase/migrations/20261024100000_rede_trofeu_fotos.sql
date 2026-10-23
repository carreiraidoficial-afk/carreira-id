-- Fotos das conquistas da Sala de Troféus da escola: até 6 por conquista, só foto (sem vídeo).
-- O arquivo (já comprimido pelo app) fica no bucket público "jornada-midias", na pasta de quem enviou; aqui ficam os endereços
-- e o caminho dos dois arquivos (foto e miniatura) para que o app apague os arquivos junto com a foto.
create table if not exists public.rede_trofeu_fotos (
  id uuid primary key default gen_random_uuid(),
  trofeu_id uuid not null references public.rede_trofeus(id) on delete cascade,
  url text not null check (char_length(url) <= 600),
  thumb_url text not null check (char_length(thumb_url) <= 600),
  caminho text not null check (char_length(caminho) <= 300),
  caminho_thumb text not null check (char_length(caminho_thumb) <= 300),
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_rede_trofeu_fotos_trofeu on public.rede_trofeu_fotos (trofeu_id, ordem);

alter table public.rede_trofeu_fotos enable row level security;

-- Qualquer pessoa vê (a Sala de Troféus é pública, como os troféus).
create policy "Fotos de trofeus visiveis a todos" on public.rede_trofeu_fotos
  for select using (true);

-- O dono da escola adiciona, reordena e apaga. O admin (Modo Suporte) adiciona e reordena, mas não apaga: mesma regra dos troféus.
create policy "Dono da escola adiciona fotos de trofeus" on public.rede_trofeu_fotos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.rede_trofeus t join public.perfis_rede p on p.id = t.perfil_rede_id
      where t.id = rede_trofeu_fotos.trofeu_id and p.user_id = auth.uid()
    )
    or public.has_role(auth.uid(), 'admin'::user_role)
  );

create policy "Dono da escola atualiza fotos de trofeus" on public.rede_trofeu_fotos
  for update to authenticated
  using (
    exists (
      select 1 from public.rede_trofeus t join public.perfis_rede p on p.id = t.perfil_rede_id
      where t.id = rede_trofeu_fotos.trofeu_id and p.user_id = auth.uid()
    )
    or public.has_role(auth.uid(), 'admin'::user_role)
  );

create policy "Dono da escola apaga fotos de trofeus" on public.rede_trofeu_fotos
  for delete to authenticated
  using (
    exists (
      select 1 from public.rede_trofeus t join public.perfis_rede p on p.id = t.perfil_rede_id
      where t.id = rede_trofeu_fotos.trofeu_id and p.user_id = auth.uid()
    )
  );

-- No máximo 6 fotos por conquista (garantido no banco, não só na tela).
create or replace function public.rede_trofeu_fotos_limite()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (select count(*) from public.rede_trofeu_fotos where trofeu_id = new.trofeu_id) >= 6 then
    raise exception 'Cada conquista aceita no máximo 6 fotos.' using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_rede_trofeu_fotos_limite on public.rede_trofeu_fotos;
create trigger trg_rede_trofeu_fotos_limite
  before insert on public.rede_trofeu_fotos
  for each row execute function public.rede_trofeu_fotos_limite();
