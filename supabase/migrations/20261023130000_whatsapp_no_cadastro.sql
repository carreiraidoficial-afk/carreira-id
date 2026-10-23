-- O WhatsApp pedido na criação da conta (formulário de cadastro) vai nos dados da conta e é copiado para o perfil de contato
-- (profiles.telefone) na hora em que a conta nasce, mesmo antes de a pessoa confirmar o e-mail. Só aceita número e símbolos
-- de telefone, no máximo 20 caracteres. Quem entra pelo Google não informa número aqui: a tela seguinte pede (opcional).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (user_id, nome, email, provider, telefone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'full_name', 'Usuario'),
    new.email,
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
    nullif(btrim(left(regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefone', ''), '[^0-9()+ -]', '', 'g'), 20)), '')
  );
  return new;
end;
$function$;
