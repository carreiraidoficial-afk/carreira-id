import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';

function friendlyRefusal(msg?: string) {
  if (!msg) return 'Pagamento não autorizado pelo emissor do cartão.';
  const m = msg.toLowerCase();
  if (m.includes('insufficient') || m.includes('saldo')) return 'Cartão sem limite/saldo disponível.';
  if (m.includes('cpf') || m.includes('titular')) return 'CPF ou nome do titular não conferem com o cartão.';
  if (m.includes('expired') || m.includes('vencid')) return 'Cartão vencido.';
  if (m.includes('invalid')) return 'Dados do cartão inválidos. Confira número, validade e CVV.';
  if (m.includes('refused') || m.includes('recus') || m.includes('denied') || m.includes('autoriz')) {
    return 'Pagamento recusado pelo banco emissor. Tente outro cartão ou contate seu banco.';
  }
  return msg;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!ASAAS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Configuração de pagamento não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const payload = await req.json();
    const {
      user_id, crianca_id, cpf, nome, email,
      card, holderInfo,
    } = payload;

    if (!user_id || !crianca_id || !cpf || !nome || !email || !card || !holderInfo) {
      return new Response(JSON.stringify({ error: 'Dados obrigatórios não informados' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate card fields
    const requiredCard = ['holderName', 'number', 'expiryMonth', 'expiryYear', 'ccv'];
    for (const f of requiredCard) {
      if (!card[f]) return new Response(JSON.stringify({ error: `Campo do cartão obrigatório: ${f}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const requiredHolder = ['name', 'email', 'cpfCnpj', 'postalCode', 'addressNumber', 'phone'];
    for (const f of requiredHolder) {
      if (!holderInfo[f]) return new Response(JSON.stringify({ error: `Dado do titular obrigatório: ${f}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Block if there is already an active subscription
    const { data: existingActive } = await supabase
      .from('carreira_assinaturas')
      .select('id, expira_em')
      .eq('user_id', user_id)
      .eq('crianca_id', crianca_id)
      .eq('status', 'ativa')
      .maybeSingle();
    if (existingActive && (!existingActive.expira_em || new Date(existingActive.expira_em) > new Date())) {
      return new Response(JSON.stringify({ error: 'Já existe uma assinatura ativa para este atleta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Cancel any prior pending Asaas subscription for the same athlete to avoid duplicates
    const { data: pendingSubs } = await supabase
      .from('carreira_assinaturas')
      .select('id, gateway_subscription_id')
      .eq('user_id', user_id)
      .eq('crianca_id', crianca_id)
      .in('status', ['pendente', 'inadimplente']);
    for (const p of (pendingSubs || [])) {
      if (p.gateway_subscription_id) {
        try {
          await fetch(`${ASAAS_API_URL}/subscriptions/${p.gateway_subscription_id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
          });
        } catch (_) {}
      }
      await supabase.from('carreira_assinaturas').update({ status: 'cancelada' }).eq('id', p.id);
    }

    // Valor from config
    let valor = 12.0;
    const { data: configValor } = await supabase
      .from('saas_config').select('valor').eq('chave', 'carreira_valor_premium').maybeSingle();
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
      const cResp = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: JSON.stringify({ name: nome, email, cpfCnpj: cleanCpf, notificationDisabled: true }),
      });
      const cResult = await cResp.json();
      if (cResult.errors) {
        return new Response(JSON.stringify({ error: cResult.errors[0]?.description || 'Erro ao criar cliente' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      customerId = cResult.id;
    }

    const remoteIp = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '127.0.0.1';

    const today = new Date().toISOString().split('T')[0];
    const subBody = {
      customer: customerId,
      billingType: 'CREDIT_CARD',
      cycle: 'MONTHLY',
      value: valor,
      nextDueDate: today,
      description: 'Carreira ID Premium - Assinatura mensal',
      externalReference: `carreira_premium_${user_id}_${crianca_id}`,
      notificationDisabled: true,
      creditCard: {
        holderName: card.holderName,
        number: String(card.number).replace(/\D/g, ''),
        expiryMonth: String(card.expiryMonth).padStart(2, '0'),
        expiryYear: String(card.expiryYear).length === 2 ? `20${card.expiryYear}` : String(card.expiryYear),
        ccv: String(card.ccv),
      },
      creditCardHolderInfo: {
        name: holderInfo.name,
        email: holderInfo.email,
        cpfCnpj: String(holderInfo.cpfCnpj).replace(/\D/g, ''),
        postalCode: String(holderInfo.postalCode).replace(/\D/g, ''),
        addressNumber: String(holderInfo.addressNumber),
        phone: String(holderInfo.phone).replace(/\D/g, ''),
      },
      remoteIp,
    };

    console.log('Creating card subscription for user', user_id, 'crianca', crianca_id);
    const subResp = await fetch(`${ASAAS_API_URL}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify(subBody),
    });
    const subResult = await subResp.json();
    console.log('Card subscription result:', JSON.stringify(subResult));

    if (subResult.errors) {
      const raw = subResult.errors[0]?.description || 'Erro ao criar assinatura';
      return new Response(JSON.stringify({ error: friendlyRefusal(raw), raw }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch first payment to check status (authorization result)
    const payResp = await fetch(`${ASAAS_API_URL}/subscriptions/${subResult.id}/payments?limit=1`,
      { headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY } });
    const payJson = await payResp.json();
    const firstPayment = payJson.data?.[0];
    const status = firstPayment?.status;

    const cardToken = subResult.creditCard?.creditCardToken || null;
    const last4 = subResult.creditCard?.creditCardNumber || null;
    const brand = subResult.creditCard?.creditCardBrand || null;

    const expiraEm = new Date();
    expiraEm.setDate(expiraEm.getDate() + 30);

    // Attempt insert with new columns; fall back if columns not migrated yet
    const baseRow: any = {
      user_id, crianca_id, plano: 'premium',
      status: (status === 'CONFIRMED' || status === 'RECEIVED') ? 'ativa' : 'pendente',
      valor, gateway: 'asaas',
      gateway_subscription_id: subResult.id,
      metodo_pagamento: 'cartao_credito',
      inicio_em: new Date().toISOString().split('T')[0],
      expira_em: expiraEm.toISOString().split('T')[0],
    };
    let ins = await supabase.from('carreira_assinaturas').insert({
      ...baseRow, gateway_card_token: cardToken, card_last4: last4, card_brand: brand,
    });
    if (ins.error) {
      console.warn('Insert w/ card cols failed, retrying minimal:', ins.error.message);
      await supabase.from('carreira_assinaturas').insert(baseRow);
    }

    // If payment was refused, surface the reason
    if (firstPayment && (status === 'REFUSED' || firstPayment.refusalReason)) {
      try {
        await fetch(`${ASAAS_API_URL}/subscriptions/${subResult.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        });
      } catch (_) {}
      return new Response(JSON.stringify({
        error: friendlyRefusal(firstPayment.refusalReason),
        raw: firstPayment.refusalReason,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        subscriptionId: subResult.id,
        paymentId: firstPayment?.id || null,
        status: status || 'PENDING',
        valor,
        card: { last4, brand },
      },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('create-carreira-card-subscription error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});