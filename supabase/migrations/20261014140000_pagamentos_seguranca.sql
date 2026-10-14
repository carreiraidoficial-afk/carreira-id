-- Segurança de pagamentos (etapa 1).
-- 1) Marca de "renovação PIX já gerada para este vencimento": evita gerar uma cobrança nova todo dia para o mesmo vencimento.
alter table public.carreira_assinaturas add column if not exists renovacao_pix_para timestamptz;

-- 2) A tarefa diária de renovação deixa de ir com uma chave embutida no comando e passa a mandar o segredo interno
--    (o mesmo usado pelo push e pelos e-mails de conexão), que fica em public.segredos_internos, fora do código.
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'renew-carreira-pix-daily'),
  command := $cmd$
    select net.http_post(
      url := 'https://fppsotlycinwqsjpoybg.supabase.co/functions/v1/renew-carreira-pix',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', (select valor from public.segredos_internos where chave = 'push_interno')
      ),
      body := '{"source": "cron"}'::jsonb
    ) as request_id;
  $cmd$
);
