-- O toque no push de comunicado abre o aviso direto (o app lê ?aviso=<id> e abre a janela do aviso).
create or replace function public.carreira_comunicado_push() returns trigger
language plpgsql security definer set search_path to 'public' as $fn$
begin
  if new.enviar_push and new.ativo then
    perform public.push_interno_destinatarios(
      new.destinatario_tipo, new.destinatario_filtro,
      '📢 ' || new.titulo, left(new.mensagem, 200), '/feed?aviso=' || new.id::text, 'carreira-comunicado', 'comunicado_push');
  end if;
  return new;
end $fn$;
revoke all on function public.carreira_comunicado_push() from public, anon, authenticated;
