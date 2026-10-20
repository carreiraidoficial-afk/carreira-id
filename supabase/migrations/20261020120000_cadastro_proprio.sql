-- Atleta com 18 anos ou mais se cadastra com os dados dele (sem responsável).
-- A coluna só serve para as telas e os e-mails falarem "você" em vez de "responsável"/"seu atleta".

alter table public.perfil_atleta add column if not exists cadastro_proprio boolean not null default false;
grant select (cadastro_proprio) on public.perfil_atleta to anon, authenticated;

-- Versão dos e-mails de lembrete para quem é o próprio atleta (a função usa estes textos quando cadastro_proprio = true).
alter table public.carreira_lembretes_perfil_atleta_templates
  add column if not exists assunto_proprio text,
  add column if not exists titulo_proprio text,
  add column if not exists corpo_proprio text,
  add column if not exists cta_texto_proprio text;

update public.carreira_lembretes_perfil_atleta_templates set
  assunto_proprio = 'Onde você já jogou ou treinou? ⚽',
  titulo_proprio = 'Registre a sua trajetória esportiva',
  corpo_proprio = 'Seu perfil no Carreira ID já está criado, mas ainda falta contar onde a sua jornada começou. Cadastre as escolinhas ou clubes por onde você já passou -- isso ajuda a montar um histórico completo, visível pra quem acompanha a sua carreira. E tem um bônus: quem completa o perfil (foto, bio, categoria, cidade, posição e 1 jogo registrado) durante o Elite experimental ganha mais 15 dias de Elite. O plano Base continua gratuito.',
  cta_texto_proprio = 'Cadastrar experiência'
where tipo = 'sem_experiencia';

update public.carreira_lembretes_perfil_atleta_templates set
  assunto_proprio = 'Registre 1 jogo e ganhe +15 dias de Elite 🎁',
  titulo_proprio = 'Falta pouco para completar o seu perfil',
  corpo_proprio = 'Se você já disputou algum amistoso ou campeonato, registre o resultado no Carreira ID -- cada jogo vira parte da sua jornada esportiva, com estatísticas e tudo. O primeiro jogo também é o último passo do perfil completo: com foto, bio, categoria, cidade, posição e 1 jogo registrado, você ganha mais 15 dias do Elite (válido durante o Elite experimental). O plano Base continua gratuito, sem prazo.',
  cta_texto_proprio = 'Registrar meu primeiro jogo'
where tipo = 'sem_jornada';
