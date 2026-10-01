-- Dispara um push pro admin (carreiraidoficial@gmail.com) toda vez que um
-- cadastro novo é concluído (linha nova em perfil_atleta ou perfis_rede),
-- reaproveitando a edge function send-carreira-push já existente.
CREATE OR REPLACE FUNCTION public.notify_admin_novo_cadastro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user_id uuid;
  nome_pessoa text;
  tipo_label text;
BEGIN
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'carreiraidoficial@gmail.com' LIMIT 1;
  IF admin_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'perfil_atleta' THEN
    nome_pessoa := NEW.nome;
    tipo_label := 'Atleta';
  ELSE
    nome_pessoa := NEW.nome;
    tipo_label := NEW.tipo;
  END IF;

  PERFORM net.http_post(
    url := 'https://fppsotlycinwqsjpoybg.supabase.co/functions/v1/send-carreira-push',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcHNvdGx5Y2lud3FzanBveWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDU1OTAsImV4cCI6MjA4ODIyMTU5MH0.LxdDToQ_PGkJg6JzX43iZWzKs6FHwZGq7sE5jo0KPzY"}'::jsonb,
    body := jsonb_build_object(
      'user_ids', jsonb_build_array(admin_user_id),
      'title', 'Novo cadastro no Carreira ID',
      'body', coalesce(nome_pessoa, 'Alguém') || ' acabou de se cadastrar (' || coalesce(tipo_label, 'perfil') || ')',
      'url', '/carreira/admin/perfis'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_novo_perfil_atleta ON public.perfil_atleta;
CREATE TRIGGER trg_notify_admin_novo_perfil_atleta
AFTER INSERT ON public.perfil_atleta
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_novo_cadastro();

DROP TRIGGER IF EXISTS trg_notify_admin_novo_perfil_rede ON public.perfis_rede;
CREATE TRIGGER trg_notify_admin_novo_perfil_rede
AFTER INSERT ON public.perfis_rede
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_novo_cadastro();
