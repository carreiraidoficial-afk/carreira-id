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
    const { user_id, crianca_ids, cpf, nome, email, card, holderInfo } = payload;

    if (!user_id || !Array.isArray(crianca_ids) || crianca_ids.length < 2 || !cpf || !nome || !email || !card || !holderInfo) {
      return new Response(JSON.stringify({ error: 'Dados obrigatórios não informados' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    // Confere que todas as crianças pertencem de fato a esse responsável
    const { data: perfis } = await supabase
      .from('perfil_atleta')
      .select('crianca_id')
      .eq('user_id', user_id)
      .in('crianca_id', crianca_ids);
    if (!perfis || perfis.length !== crianca_ids.length) {
      return new Response(JSON.stringify({ error: 'Um ou mais atletas não pertencem a esse responsável' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Bloqueia se já existe família ativa/pendente pra esse responsável
    const { data: familiaExistente } = await supabase
      .from('carreira_assinaturas_familia')
      .select('id')
      .eq('user_id', user_id)
      .in('status', ['ativa', 'pendente'])
      .maybeSingle();
    if (familiaExistente) {
      return new Response(JSON.stringify({ error: 'Você já tem uma assinatura família ativa ou em processamento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Cancela de verdade qualquer assinatura individual (ou satélite de família
    // anterior) dessas crianças, já que o modelo escolhido é "cancela e recomeça"
    const { data: assinaturasAntigas } = await supabase
      .from('carreira_assinaturas')
      .select('id, gateway_subscription_id')
      .in('crianca_id', crianca_ids)
      .neq('status', 'cancelada');
    for (const a of (assinaturasAntigas || [])) {
      if (a.gateway_subscription_id) {
        try {
          await fetch(`${ASAAS_API_URL}/subscriptions/${a.gateway_subscription_id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
          });
        } catch (_) { /* ignora falha ao cancelar cobrança antiga na Asaas */ }
      }
      await supabase.from('carreira_assinaturas')
        .update({ status: 'cancelada', cancelada_em: new Date().toISOString() })
        .eq('id', a.id);
    }

    // Preço fixo da família (configurável em saas_config -> carreira_valor_familia)
    let valor = 19.9;
    const { data: configValor } = await supabase
      .from('saas_config').select('valor').eq('chave', 'carreira_valor_familia').maybeSingle();
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
      description: 'Carreira ID - Assinatura Família',
      externalReference: `carreira_familia_${user_id}`,
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

    const subResp = await fetch(`${ASAAS_API_URL}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify(subBody),
    });
    const subResult = await subResp.json();

    if (subResult.errors) {
      const raw = subResult.errors[0]?.description || 'Erro ao criar assinatura';
      return new Response(JSON.stringify({ error: friendlyRefusal(raw), raw }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payResp = await fetch(`${ASAAS_API_URL}/subscriptions/${subResult.id}/payments?limit=1`,
      { headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY } });
    const payJson = await payResp.json();
    const firstPayment = payJson.data?.[0];
    const status = firstPayment?.status;

    const cardToken = subResult.creditCard?.creditCardToken || null;
    const last4 = subResult.creditCard?.creditCardNumber || null;
    const brand = subResult.creditCard?.creditCardBrand || null;

    // If payment was refused, cancel the Asaas subscription right away and
    // surface the reason -- no rows written, nothing left to clean up.
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

    const expiraEm = new Date();
    expiraEm.setDate(expiraEm.getDate() + 30);
    const inicioEm = new Date().toISOString().split('T')[0];
    const expiraEmStr = expiraEm.toISOString().split('T')[0];
    const approved = status === 'CONFIRMED' || status === 'RECEIVED';

    const { data: familia, error: familiaError } = await supabase
      .from('carreira_assinaturas_familia')
      .insert({
        user_id,
        status: approved ? 'ativa' : 'pendente',
        valor,
        gateway: 'asaas',
        gateway_subscription_id: subResult.id,
        metodo_pagamento: 'cartao_credito',
        inicio_em: inicioEm,
        expira_em: expiraEmStr,
      })
      .select('id')
      .single();

    if (familiaError || !familia) {
      console.error('Error creating carreira_assinaturas_familia:', familiaError);
      return new Response(JSON.stringify({ error: 'Erro ao registrar assinatura família' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const satelliteRows = crianca_ids.map((crianca_id: string) => ({
      user_id,
      crianca_id,
      plano: 'premium',
      status: approved ? 'ativa' : 'pendente',
      metodo_pagamento: 'cartao_credito',
      gateway: 'asaas',
      familia_id: familia.id,
      inicio_em: inicioEm,
      expira_em: expiraEmStr,
    }));
    const { error: satelliteError } = await supabase.from('carreira_assinaturas').insert(satelliteRows);
    if (satelliteError) {
      console.error('Error creating satellite carreira_assinaturas rows:', satelliteError);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        subscriptionId: subResult.id,
        familiaId: familia.id,
        paymentId: firstPayment?.id || null,
        status: approved ? 'approved' : 'processing',
        asaasStatus: status || 'PENDING',
        valor,
        card: { last4, brand },
      },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('create-carreira-familia-card-subscription error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
