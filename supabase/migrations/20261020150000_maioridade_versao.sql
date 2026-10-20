-- Guarda também QUAL texto de declaração de maioridade a pessoa aceitou (o texto pode mudar com o tempo).
alter table public.perfil_atleta add column if not exists maioridade_declaracao_versao text;
