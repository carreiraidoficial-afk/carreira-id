// Public webhook endpoint — verify_jwt=false (see supabase/config.toml)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ASAAS_WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN');

    // Optional shared-secret validation. Configure the same token in the Asaas webhook UI.
    if (ASAAS_WEBHOOK_TOKEN) {
      const tokenHeader = req.headers.get('asaas-access-token');
      if (tokenHeader !== ASAAS_WEBHOOK_TOKEN) {
        console.warn('Invalid asaas-access-token header');
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const event = body?.event as string | undefined;
    const payment = body?.payment;
    console.log('Asaas webhook event:', event, 'payment:', payment?.id, 'subscription:', payment?.subscription);

    if (!event) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const asaasSubId: string | null = payment?.subscription || null;
    const asaasPaymentId: string | null = payment?.id || null;

    const matchIds = [asaasSubId, asaasPaymentId].filter(Boolean) as string[];

    const findSub = async () => {
      if (matchIds.length === 0) return null;
      const { data } = await supabase
        .from('carreira_assinaturas')
        .select('id, expira_em, status')
        .in('gateway_subscription_id', matchIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    };

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      const sub = await findSub();
      if (sub) {
        // Extend expiry by 30 days from current expira_em (or today if past/absent)
        const base = sub.expira_em && new Date(sub.expira_em) > new Date()
          ? new Date(sub.expira_em)
          : new Date();
        base.setDate(base.getDate() + 30);
        await supabase
          .from('carreira_assinaturas')
          .update({
            status: 'ativa',
            metodo_pagamento: payment?.billingType === 'PIX' ? 'pix' : 'cartao_credito',
            expira_em: base.toISOString().split('T')[0],
          })
          .eq('id', sub.id);
        console.log('Sub activated/renewed:', sub.id, 'new expira_em:', base.toISOString().split('T')[0]);
      } else {
        console.warn('No matching sub for payment', asaasPaymentId, 'sub', asaasSubId);
      }
    } else if (
      event === 'PAYMENT_OVERDUE' ||
      event === 'PAYMENT_REFUSED_BY_ACQUIRER' ||
      event === 'PAYMENT_REFUSED'
    ) {
      const sub = await findSub();
      if (sub) {
        const refusal = payment?.refusalReason || payment?.description || event;
        const upd: any = { status: 'inadimplente' };
        const withObs = await supabase
          .from('carreira_assinaturas')
          .update({ ...upd, observacoes: `[${new Date().toISOString()}] ${event}: ${refusal}` })
          .eq('id', sub.id);
        if (withObs.error) {
          // Column observacoes may not exist yet — fallback to status only
          await supabase.from('carreira_assinaturas').update(upd).eq('id', sub.id);
        }
        console.log('Sub marked inadimplente:', sub.id, 'reason:', refusal);
      }
    } else if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_DELETED') {
      const sub = await findSub();
      if (sub) {
        await supabase
          .from('carreira_assinaturas')
          .update({ status: 'cancelada' })
          .eq('id', sub.id);
      }
    } else if (event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED') {
      const subId = body?.subscription?.id;
      if (subId) {
        await supabase
          .from('carreira_assinaturas')
          .update({ status: 'cancelada' })
          .eq('gateway_subscription_id', subId);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});