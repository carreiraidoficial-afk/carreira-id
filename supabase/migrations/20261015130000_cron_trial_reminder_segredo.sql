-- O aviso diário de fim de teste deixa de ir com uma chave embutida no comando e passa a mandar o segredo interno
-- (guardado em public.segredos_internos, fora do código). A função agora só aceita esse segredo.
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'carreira-trial-reminder-daily'),
  command := $cmd$
    select net.http_post(
      url := 'https://fppsotlycinwqsjpoybg.supabase.co/functions/v1/carreira-trial-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', (select valor from public.segredos_internos where chave = 'push_interno')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $cmd$
);
