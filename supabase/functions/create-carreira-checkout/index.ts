import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
      console.error('Missing ASAAS_API_KEY');
      return new Response(
        JSON.stringify({ error: 'Configuração de pagamento não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { user_id, crianca_id, cpf, nome, email, callback_url } = await req.json();
    const planoSelecionado = 'premium';

    console.log('Creating Carreira Checkout for user:', user_id, 'crianca:', crianca_id);

    if (!user_id || !crianca_id || !cpf || !nome || !email) {
      return new Response(
        JSON.stringify({ error: 'Dados obrigatórios não informados' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check existing active subscription
    const { data: existingSub } = await supabase
      .from('carreira_assinaturas')
      .select('id, status, expira_em')
      .eq('user_id', user_id)
      .eq('crianca_id', crianca_id)
      .eq('status', 'ativa')
      .maybeSingle();

    if (existingSub && (!existingSub.expira_em || new Date(existingSub.expira_em) > new Date())) {
      return new Response(
        JSON.stringify({ error: 'Já existe uma assinatura ativa para este atleta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preço fixo do Premium: R$ 12,00 (configurável em saas_config -> carreira_valor_premium)
    let valor = 12.0;
    const { data: configValor } = await supabase
      .from('saas_config')
      .select('valor')
      .eq('chave', 'carreira_valor_premium')
      .maybeSingle();
    if (configValor) valor = parseFloat(configValor.valor);

    // Find or create customer
    const cleanCpf = cpf.replace(/\D/g, '');
    let customerId: string | null = null;

    const searchResp = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cleanCpf}`, {
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
    });
    const searchResult = await searchResp.json();

    if (searchResult.data?.length > 0) {
      customerId = searchResult.data[0].id;
    } else {
      const customerResp = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: JSON.stringify({
          name: nome,
          email: email,
          cpfCnpj: cleanCpf,
          notificationDisabled: true,
        }),
      });
      const customerResult = await customerResp.json();

      if (customerResult.errors) {
        return new Response(
          JSON.stringify({ error: customerResult.errors[0]?.description || 'Erro ao criar cliente' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      customerId = customerResult.id;
    }

    // Create RECURRING subscription (monthly credit card) with notifications disabled
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);

    const subResp = await fetch(`${ASAAS_API_URL}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'CREDIT_CARD',
        cycle: 'MONTHLY',
        value: valor,
        nextDueDate: nextDueDate.toISOString().split('T')[0],
        description: `Carreira ID Premium - Assinatura mensal`,
        externalReference: `carreira_premium_${user_id}_${crianca_id}`,
        notificationDisabled: true,
      }),
    });

    const subResult = await subResp.json();
    console.log('Subscription result:', JSON.stringify(subResult));

    if (subResult.errors) {
      return new Response(
        JSON.stringify({ error: subResult.errors[0]?.description || 'Erro ao criar assinatura' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch first payment from subscription to get the invoice URL for card capture
    const paymentsResp = await fetch(
      `${ASAAS_API_URL}/subscriptions/${subResult.id}/payments?limit=1`,
      { headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY } }
    );
    const paymentsResult = await paymentsResp.json();
    const firstPayment = paymentsResult.data?.[0];
    const checkoutUrl = firstPayment?.invoiceUrl || null;
    const firstPaymentId = firstPayment?.id || null;
    console.log('Checkout URL:', checkoutUrl, 'firstPaymentId:', firstPaymentId);

    // Save subscription record as pending. gateway_subscription_id = Asaas subscription id.
    const expiraEm = new Date();
    expiraEm.setDate(expiraEm.getDate() + 30);

    await supabase
      .from('carreira_assinaturas')
      .insert({
        user_id,
        crianca_id,
        plano: planoSelecionado,
        status: 'pendente',
        valor,
        gateway: 'asaas',
        gateway_subscription_id: subResult.id,
        metodo_pagamento: 'cartao_credito',
        inicio_em: new Date().toISOString().split('T')[0],
        expira_em: expiraEm.toISOString().split('T')[0],
      });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          subscriptionId: subResult.id,
          paymentId: firstPaymentId,
          checkoutUrl,
          valor,
        },
      }),
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
