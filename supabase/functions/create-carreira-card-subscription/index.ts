import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';
// deploy-touch: v2

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
    // O usuário vem do token de login, nunca do corpo da requisição (antes dava para agir em nome de outro user_id).
    const { data: { user: authUser } } = await createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    ).auth.getUser();
    if (!authUser) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const user_id = authUser.id;
    const payload = await req.json();
    const {
      crianca_id, cpf, nome, email,
      card, holderInfo,
    } = payload;
    const ciclo: 'mensal' | 'anual' = payload.ciclo === 'anual' ? 'anual' : 'mensal';
    const parcelas = Math.min(12, Math.max(1, Math.floor(Number(payload.parcelas) || 1)));

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

    // O atleta precisa ser do usuário logado.
    const { data: donoAtleta } = await supabase.from('perfil_atleta').select('id').eq('crianca_id', crianca_id).eq('user_id', user_id).maybeSingle();
    if (!donoAtleta) {
      return new Response(JSON.stringify({ error: 'Atleta não encontrado para este usuário' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      return new Response(JSON.stringify({ error: ciclo === 'anual' ? 'Este atleta já tem uma assinatura ativa. O plano anual pode ser contratado quando ela vencer ou for cancelada.' : 'Já existe uma assinatura ativa para este atleta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Cancel any prior pending/trial subscription for the same athlete to avoid duplicates
    // (trial rows never have a gateway_subscription_id, so the Asaas DELETE below is a no-op for them)
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

    // Valor sempre da configuração (nunca do app)
    let valor = ciclo === 'anual' ? 120.0 : 12.0;
    const { data: configValor } = await supabase
      .from('saas_config').select('valor').eq('chave', ciclo === 'anual' ? 'carreira_valor_premium_anual' : 'carreira_valor_premium').maybeSingle();
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
    const cartaoAsaas = {
      holderName: card.holderName,
      number: String(card.number).replace(/\D/g, ''),
      expiryMonth: String(card.expiryMonth).padStart(2, '0'),
      expiryYear: String(card.expiryYear).length === 2 ? `20${card.expiryYear}` : String(card.expiryYear),
      ccv: String(card.ccv),
    };
    const titularAsaas = {
      name: holderInfo.name,
      email: holderInfo.email,
      cpfCnpj: String(holderInfo.cpfCnpj).replace(/\D/g, ''),
      postalCode: String(holderInfo.postalCode).replace(/\D/g, ''),
      addressNumber: String(holderInfo.addressNumber),
      phone: String(holderInfo.phone).replace(/\D/g, ''),
    };

    // Plano anual: UMA cobrança de 365 dias (à vista ou em até 12x no cartão), sem renovação automática.
    if (ciclo === 'anual') {
      console.log('Creating annual card payment for user', user_id, 'crianca', crianca_id, 'parcelas', parcelas);
      const payResp = await fetch(`${ASAAS_API_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: JSON.stringify({
          customer: customerId,
          billingType: 'CREDIT_CARD',
          dueDate: today,
          description: 'Carreira ID Premium - Plano anual',
          externalReference: `carreira_premium_${user_id}_${crianca_id}`,
          notificationDisabled: true,
          ...(parcelas > 1 ? { installmentCount: parcelas, totalValue: valor } : { value: valor }),
          creditCard: cartaoAsaas,
          creditCardHolderInfo: titularAsaas,
          remoteIp,
        }),
      });
      const payResult = await payResp.json();
      console.log('Annual payment result:', JSON.stringify({ id: payResult.id, status: payResult.status, installment: payResult.installment, errors: payResult.errors }));
      if (payResult.errors) {
        const raw = payResult.errors[0]?.description || 'Erro ao processar o pagamento';
        return new Response(JSON.stringify({ error: friendlyRefusal(raw), raw }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const aprovado = payResult.status === 'CONFIRMED' || payResult.status === 'RECEIVED';
      const chavePagamento: string = payResult.installment || payResult.id;
      const expiraAnual = new Date();
      expiraAnual.setDate(expiraAnual.getDate() + 365);
      const linhaAnual: any = {
        user_id, crianca_id, plano: 'premium',
        status: aprovado ? 'ativa' : 'pendente',
        valor, gateway: 'asaas',
        gateway_subscription_id: chavePagamento,
        metodo_pagamento: 'cartao_credito',
        ciclo: 'anual', duracao_dias: 365,
        inicio_em: today,
        expira_em: expiraAnual.toISOString().split('T')[0],
        ultimo_pagamento_id: aprovado ? chavePagamento : null,
        gateway_card_token: payResult.creditCard?.creditCardToken || null,
        card_last4: payResult.creditCard?.creditCardNumber || null,
        card_brand: payResult.creditCard?.creditCardBrand || null,
      };
      let insAnual = await supabase.from('carreira_assinaturas').insert(linhaAnual);
      if (insAnual.error) {
        console.error('Erro ao gravar a assinatura anual:', insAnual.error.message);
        return new Response(JSON.stringify({ error: 'Pagamento recebido, mas não foi possível registrar a assinatura. Fale com o suporte.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        success: true,
        data: {
          subscriptionId: chavePagamento,
          paymentId: payResult.id,
          status: aprovado ? 'approved' : 'processing',
          asaasStatus: payResult.status || 'PENDING',
          valor, ciclo: 'anual', parcelas,
          card: { last4: payResult.creditCard?.creditCardNumber || null, brand: payResult.creditCard?.creditCardBrand || null },
        },
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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
      ultimo_pagamento_id: (status === 'CONFIRMED' || status === 'RECEIVED') ? (firstPayment?.id || null) : null,
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

    const approved = status === 'CONFIRMED' || status === 'RECEIVED';
    return new Response(JSON.stringify({
      success: true,
      data: {
        subscriptionId: subResult.id,
        paymentId: firstPayment?.id || null,
        status: approved ? 'approved' : 'processing',
        asaasStatus: status || 'PENDING',
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