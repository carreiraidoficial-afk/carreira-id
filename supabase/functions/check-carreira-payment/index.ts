import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ASAAS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Configuração de pagamento não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { payment_id, subscription_id } = await req.json();

    console.log('Checking Carreira payment:', payment_id, 'subscription:', subscription_id);

    // Try to detect whether payment_id is actually an Asaas subscription id (sub_...)
    // If so, resolve the latest payment of that subscription.
    let paymentData: any = null;
    let asaasSubscriptionId: string | null = null;

    if (typeof payment_id === 'string' && payment_id.startsWith('sub_')) {
      asaasSubscriptionId = payment_id;
      const listResp = await fetch(
        `${ASAAS_API_URL}/subscriptions/${payment_id}/payments?limit=1`,
        { headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY } }
      );
      const rawText = await listResp.text();
      console.log('Asaas subscriptions/payments raw response:', listResp.status, rawText);
      let listData: any;
      try {
        listData = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('Failed to parse Asaas response as JSON. HTTP status:', listResp.status, 'Body:', rawText);
        return new Response(
          JSON.stringify({ error: 'Resposta inválida da Asaas', asaasStatus: listResp.status, asaasBody: rawText.slice(0, 500) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      paymentData = listData.data?.[0] || {};
    } else {
      const response = await fetch(`${ASAAS_API_URL}/payments/${payment_id}`, {
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      });
      const rawText = await response.text();
      console.log('Asaas payments/:id raw response:', response.status, rawText);
      try {
        paymentData = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('Failed to parse Asaas response as JSON. HTTP status:', response.status, 'Body:', rawText);
        return new Response(
          JSON.stringify({ error: 'Resposta inválida da Asaas', asaasStatus: response.status, asaasBody: rawText.slice(0, 500) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (paymentData?.subscription) asaasSubscriptionId = paymentData.subscription;
    }
    console.log('Payment status:', JSON.stringify(paymentData));

    if (paymentData?.errors) {
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar pagamento', asaasErrors: paymentData.errors }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
    const isPaid = paidStatuses.includes(paymentData?.status);

    if (isPaid) {
      const expiraEm = new Date();
      expiraEm.setDate(expiraEm.getDate() + 30);

      if (subscription_id) {
        const { error: updateError } = await supabase
          .from('carreira_assinaturas')
          .update({
            status: 'ativa',
            inicio_em: new Date().toISOString().split('T')[0],
            expira_em: expiraEm.toISOString().split('T')[0],
          })
          .eq('id', subscription_id);

        if (updateError) {
          console.error('Error activating subscription by id:', updateError);
        } else {
          console.log('Subscription activated by id:', subscription_id);
        }
      }

      // Match by either the payment_id passed in (PIX flow) or the Asaas subscription id (card flow)
      const matchIds = [payment_id, asaasSubscriptionId].filter(Boolean) as string[];
      const { data: pendingSub } = await supabase
        .from('carreira_assinaturas')
        .select('id')
        .in('gateway_subscription_id', matchIds)
        .eq('status', 'pendente')
        .maybeSingle();

      if (pendingSub) {
        const { error: updateError2 } = await supabase
          .from('carreira_assinaturas')
          .update({
            status: 'ativa',
            metodo_pagamento: paymentData.billingType === 'PIX' ? 'pix' : 'cartao_credito',
            inicio_em: new Date().toISOString().split('T')[0],
            expira_em: expiraEm.toISOString().split('T')[0],
          })
          .eq('id', pendingSub.id);

        if (updateError2) {
          console.error('Error activating subscription by gateway_id:', updateError2);
        } else {
          console.log('Subscription activated by gateway_subscription_id:', pendingSub.id);
        }
      }

      // Assinatura família: o gateway_subscription_id fica em
      // carreira_assinaturas_familia (não numa linha individual) -- ativa a
      // família e cascateia pra todas as linhas satélite dos filhos cobertos.
      const { data: pendingFamilia } = await supabase
        .from('carreira_assinaturas_familia')
        .select('id')
        .in('gateway_subscription_id', matchIds)
        .eq('status', 'pendente')
        .maybeSingle();

      if (pendingFamilia) {
        const metodo = paymentData.billingType === 'PIX' ? 'pix' : 'cartao_credito';
        await supabase
          .from('carreira_assinaturas_familia')
          .update({
            status: 'ativa',
            metodo_pagamento: metodo,
            inicio_em: new Date().toISOString().split('T')[0],
            expira_em: expiraEm.toISOString().split('T')[0],
          })
          .eq('id', pendingFamilia.id);

        const { error: cascadeError } = await supabase
          .from('carreira_assinaturas')
          .update({
            status: 'ativa',
            metodo_pagamento: metodo,
            inicio_em: new Date().toISOString().split('T')[0],
            expira_em: expiraEm.toISOString().split('T')[0],
          })
          .eq('familia_id', pendingFamilia.id);

        if (cascadeError) {
          console.error('Error cascading familia activation to satellite rows:', cascadeError);
        } else {
          console.log('Familia activated and cascaded:', pendingFamilia.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ data: { isPaid, status: paymentData?.status } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
