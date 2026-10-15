import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const ASAAS_API_URL = 'https://api.asaas.com/v3';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function htmlRenovacao(primeiroNome: string, vencimento: string, link: string, brCode: string | null, valorTxt: string, anual: boolean) {
  const codigo = brCode
    ? `<p style="margin:18px 0 6px 0;font-size:12px;color:#737373;">PIX copia e cola:</p>
       <p style="margin:0;padding:12px;background:#171717;border:1px solid #262626;font-size:11px;line-height:1.5;color:#d4d4d4;word-break:break-all;font-family:monospace;">${esc(brCode)}</p>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="dark"><title>Renove seu plano Elite</title></head>
<body bgcolor="#000000" style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#0d0d0d" style="width:600px;max-width:100%;background:#0d0d0d;border:1px solid #262626;">
<tr><td style="padding:28px 40px;border-bottom:1px solid #262626;"><img src="https://carreiraid.com.br/logo-carreira-id-email.png" width="170" height="42" alt="Carreira ID" style="display:block;border:0;"></td></tr>
<tr><td style="padding:40px 40px 8px 40px;">
<p style="margin:0 0 10px 0;font-size:13px;font-weight:700;color:#22c55e;text-transform:uppercase;letter-spacing:1.5px;">Olá, ${primeiroNome}!</p>
<h1 style="margin:0 0 14px 0;font-size:28px;line-height:1.25;font-weight:800;color:#f5f5f5;">Seu plano Elite vence em ${esc(vencimento)}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#a3a3a3;">Geramos o PIX da renovação ${anual ? 'do plano anual ' : ''}(R$ ${valorTxt}). Pague até o vencimento para continuar com os recursos Elite, sem interrupção. O novo período soma ao que ainda resta.</p>
${codigo}
</td></tr>
<tr><td align="center" style="padding:28px 40px 36px 40px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#f97316" style="background:#f97316;"><a href="${esc(link)}" style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:700;color:#000000;text-decoration:none;">Pagar a renovação →</a></td></tr></table></td></tr>
<tr><td style="padding:20px 40px;background:#0a0a0a;border-top:1px solid #262626;"><p style="margin:0;font-size:11px;line-height:1.6;color:#525252;">Você recebeu este e-mail porque tem uma assinatura Elite por PIX no Carreira ID.</p></td></tr>
</table></td></tr></table></body></html>`;
}

// Roda todo dia pelo agendador do banco (cron). Só o servidor chama: exige o segredo interno.
// Para cada assinatura PIX que vence em até 2 dias, gera UMA cobrança por vencimento (marca em renovacao_pix_para),
// e AVISA o cliente por push e e-mail com o link de pagamento. A resposta traz só contagens, sem dados de ninguém.
Deno.serve(async (req) => {
  try {
    const internalSecret = Deno.env.get('PUSH_INTERNAL_SECRET') || '';
    if (!internalSecret || req.headers.get('x-internal-secret') !== internalSecret) {
      return json({ error: 'unauthorized' }, 401);
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!ASAAS_API_KEY) return json({ error: 'Configuração de pagamento não encontrada' }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resendKey = Deno.env.get('RESEND_API_KEY');

    const agora = new Date();
    // Mensal por PIX: avisa 2 dias antes. Anual (qualquer forma de pagamento, pois não renova sozinho): 7 dias antes.
    const seteDias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: expiringSubs, error: queryError } = await supabase
      .from('carreira_assinaturas')
      .select('id, user_id, crianca_id, valor, expira_em, renovacao_pix_para, ciclo')
      .eq('status', 'ativa')
      .or('metodo_pagamento.eq.pix,ciclo.eq.anual')
      .lte('expira_em', seteDias.toISOString())
      .gte('expira_em', agora.toISOString());

    if (queryError) {
      console.error('Error querying expiring subscriptions:', queryError);
      return json({ error: 'Erro ao consultar assinaturas' }, 500);
    }

    let gerados = 0;
    let jaGerados = 0;
    let falhas = 0;

    for (const sub of (expiringSubs || [])) {
      try {
        const anual = sub.ciclo === 'anual';
        const janelaDias = anual ? 7 : 2;
        if (new Date(sub.expira_em!).getTime() > agora.getTime() + janelaDias * 24 * 60 * 60 * 1000) continue;

        // Uma cobrança por vencimento: se já geramos para esta data de expiração, não repete.
        if (sub.renovacao_pix_para && new Date(sub.renovacao_pix_para).getTime() === new Date(sub.expira_em!).getTime()) {
          jaGerados++;
          continue;
        }

        const { data: perfil } = await supabase
          .from('perfil_atleta')
          .select('cpf_cnpj')
          .eq('user_id', sub.user_id)
          .limit(1)
          .maybeSingle();
        const cpf = perfil?.cpf_cnpj?.replace(/\D/g, '');
        if (!cpf) { falhas++; continue; }

        const searchResp = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cpf}`, {
          headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        });
        const searchResult = await searchResp.json();
        if (!searchResult.data?.length) { falhas++; continue; }
        const customerId = searchResult.data[0].id;

        // Preço sempre da configuração (nunca fixo no código)
        let valor = anual ? 120.0 : (Number(sub.valor) || 12.0);
        const { data: cfg } = await supabase.from('saas_config').select('valor').eq('chave', anual ? 'carreira_valor_premium_anual' : 'carreira_valor_premium').maybeSingle();
        if (cfg?.valor) valor = parseFloat(cfg.valor);

        const dueDateStr = new Date(sub.expira_em!).toISOString().split('T')[0];
        const paymentResp = await fetch(`${ASAAS_API_URL}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
          body: JSON.stringify({
            customer: customerId,
            billingType: 'PIX',
            value: valor,
            dueDate: dueDateStr,
            description: anual ? 'Carreira ID Elite - Renovação do plano anual' : 'Carreira ID Elite - Renovação mensal',
            externalReference: `carreira_renew_premium_${sub.user_id}_${sub.crianca_id}`,
            notificationDisabled: true,
          }),
        });
        const paymentResult = await paymentResp.json();
        if (paymentResult.errors) {
          console.error(`Erro ao criar a cobrança de renovação (assinatura ${sub.id}):`, paymentResult.errors);
          falhas++;
          continue;
        }

        const qrResp = await fetch(`${ASAAS_API_URL}/payments/${paymentResult.id}/pixQrCode`, {
          headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        });
        const qrResult = await qrResp.json();
        const brCode: string | null = qrResult.payload || null;
        const link: string = paymentResult.invoiceUrl || 'https://carreiraid.com.br/planos';

        // O webhook acha a assinatura pelo id da cobrança: guarda o novo id e marca este vencimento como tratado.
        await supabase
          .from('carreira_assinaturas')
          .update({ gateway_subscription_id: paymentResult.id, renovacao_pix_para: sub.expira_em })
          .eq('id', sub.id);

        // Aviso ao cliente (antes o PIX era gerado e ninguém recebia).
        const vencimento = new Date(sub.expira_em!).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-carreira-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-secret': internalSecret },
            body: JSON.stringify({
              user_ids: [sub.user_id],
              title: 'Renove seu plano Elite',
              body: `Seu plano Elite vence em ${vencimento}. O PIX da renovação já está pronto.`,
              url: '/minhas-assinaturas',
              tag: 'renovacao-pix',
            }),
          });
        } catch (e) { console.error('push de renovação falhou:', e); }

        if (resendKey) {
          try {
            const { data: u } = await supabase.auth.admin.getUserById(sub.user_id);
            const { data: prof } = await supabase.from('profiles').select('nome').eq('user_id', sub.user_id).maybeSingle();
            const email = u?.user?.email;
            if (email) {
              const primeiroNome = esc(String(prof?.nome || '').trim().split(' ')[0] || 'tudo bem');
              const resend = new Resend(resendKey);
              await resend.emails.send({
                from: 'Carreira ID <contato@carreiraid.com.br>',
                to: [email],
                subject: `Seu plano Elite vence em ${vencimento}: renove por PIX`,
                html: htmlRenovacao(primeiroNome, vencimento, link, brCode, valor.toFixed(2).replace('.', ','), anual),
              });
            }
          } catch (e) { console.error('e-mail de renovação falhou:', e); }
        }

        gerados++;
      } catch (err) {
        console.error(`Erro ao processar a assinatura ${sub.id}:`, err);
        falhas++;
      }
    }

    return json({ success: true, total: expiringSubs?.length || 0, gerados, jaGerados, falhas });
  } catch (error) {
    console.error('Unexpected error:', error);
    return json({ error: 'Erro interno' }, 500);
  }
});
