-- Registro de que a pessoa leu e aceitou as Condições da assinatura (Termos de Uso, seção 9) antes de pagar.
-- Só se grava (não se edita nem se apaga). A pessoa vê o próprio registro; o admin vê todos.
create table if not exists public.carreira_aceites_assinatura (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  crianca_id uuid,
  versao text not null check (char_length(versao) <= 40),
  ciclo text check (ciclo in ('mensal', 'anual')),
  metodo text check (metodo in ('cartao', 'pix')),
  created_at timestamptz not null default now()
);

create index if not exists idx_aceites_assinatura_user on public.carreira_aceites_assinatura (user_id, created_at desc);

alter table public.carreira_aceites_assinatura enable row level security;

create policy "Pessoa registra o proprio aceite" on public.carreira_aceites_assinatura
  for insert to authenticated with check (auth.uid() = user_id);

create policy "Pessoa ve o proprio aceite e admin ve todos" on public.carreira_aceites_assinatura
  for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::user_role));
