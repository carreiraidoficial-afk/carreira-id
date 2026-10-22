-- Origem do cadastro: de onde a pessoa chegou (tipo de link, canal e quem convidou).
-- Registrada uma vez por conta, logo depois do cadastro. Só o admin lê. Não guarda dado pessoal além do vínculo com a conta.
create table if not exists public.carreira_origem_cadastro (
  user_id uuid primary key,
  tipo_link text not null default 'direto'
    check (tipo_link in ('direto','torcida','colega','escola','equipe','rede','convite')),
  canal text not null default 'direto' check (char_length(canal) <= 40),
  convidante_slug text check (char_length(convidante_slug) <= 120),
  escola_slug text check (char_length(escola_slug) <= 120),
  utm_source text check (char_length(utm_source) <= 80),
  utm_medium text check (char_length(utm_medium) <= 80),
  utm_campaign text check (char_length(utm_campaign) <= 120),
  referrer_host text check (char_length(referrer_host) <= 120),
  landing_path text check (char_length(landing_path) <= 200),
  created_at timestamptz not null default now()
);

alter table public.carreira_origem_cadastro enable row level security;

-- Cada pessoa só registra a própria origem, uma vez (a chave primária impede repetir).
create policy "origem_cadastro_insert_propria" on public.carreira_origem_cadastro
  for insert to authenticated with check (auth.uid() = user_id);

create policy "origem_cadastro_admin_le" on public.carreira_origem_cadastro
  for select to authenticated using (public.has_role(auth.uid(), 'admin'::user_role));

create index if not exists idx_origem_cadastro_tipo on public.carreira_origem_cadastro (tipo_link);
