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
      console.error('Missing ASAAS_API_KEY');
      return new Response(
        JSON.stringify({ error: 'Configuração de pagamento não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    const { crianca_id, cpf, nome, email, ciclo: cicloBody } = await req.json();
    const ciclo: 'mensal' | 'anual' = cicloBody === 'anual' ? 'anual' : 'mensal';
    const duracaoDias = ciclo === 'anual' ? 365 : 30;
    const planoSelecionado = 'premium';

    console.log('Generating Carreira PIX for user:', user_id, 'crianca:', crianca_id, 'plano:', planoSelecionado);

    if (!user_id || !crianca_id || !cpf || !nome || !email) {
      return new Response(
        JSON.stringify({ error: 'Dados obrigatórios não informados (user_id, crianca_id, cpf, nome, email)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // O atleta precisa ser do usuário logado.
    const { data: donoAtleta } = await supabase.from('perfil_atleta').select('id').eq('crianca_id', crianca_id).eq('user_id', user_id).maybeSingle();
    if (!donoAtleta) {
      return new Response(JSON.stringify({ error: 'Atleta não encontrado para este usuário' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check if already has active subscription
    const { data: existingSub } = await supabase
      .from('carreira_assinaturas')
      .select('id, status, expira_em')
      .eq('user_id', user_id)
      .eq('crianca_id', crianca_id)
      .eq('status', 'ativa')
      .maybeSingle();

    if (existingSub && (!existingSub.expira_em || new Date(existingSub.expira_em) > new Date())) {
      return new Response(
        JSON.stringify({ error: ciclo === 'anual' ? 'Este atleta já tem uma assinatura ativa. O plano anual pode ser contratado quando ela vencer ou for cancelada.' : 'Já existe uma assinatura ativa para este atleta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cancela cobranças pendentes/inadimplentes anteriores da mesma criança (o TESTE grátis NÃO é cancelado aqui: ele só termina quando o pagamento confirma, ver trigger carreira_assinatura_converte_trial) para
    // evitar duas linhas paralelas em carreira_assinaturas (trial nunca tem
    // gateway_subscription_id, então não há nada a cancelar na Asaas para ela)
    const { data: pendingSubs } = await supabase
      .from('carreira_assinaturas')
      .select('id, gateway_subscription_id')
      .eq('user_id', user_id)
      .eq('crianca_id', crianca_id)
      .in('status', ['pendente', 'inadimplente']);
    for (const p of (pendingSubs || [])) {
      if (p.gateway_subscription_id) {
        try {
          await fetch(`${ASAAS_API_URL}/payments/${p.gateway_subscription_id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
          });
        } catch (_) { /* ignora falha ao cancelar cobrança antiga na Asaas */ }
      }
      await supabase.from('carreira_assinaturas').update({ status: 'cancelada' }).eq('id', p.id);
    }

    // Preço vem sempre da configuração (nunca do app): mensal R$ 12 / anual R$ 120.
    let valor = ciclo === 'anual' ? 120.0 : 12.0;
    const { data: configValor } = await supabase
      .from('saas_config')
      .select('valor')
      .eq('chave', ciclo === 'anual' ? 'carreira_valor_premium_anual' : 'carreira_valor_premium')
      .maybeSingle();
    if (configValor) valor = parseFloat(configValor.valor);

    // Step 1: Find or create customer in Asaas
    const cleanCpf = cpf.replace(/\D/g, '');
    // Guarda o CPF do responsável nos atletas dele que ainda não têm um: a renovação automática do PIX lê esse CPF.
    try {
      const dg = cleanCpf.split('').map(Number);
      const dv = (n: number) => { const s = dg.slice(0, n).reduce((a: number, x: number, i: number) => a + x * (n + 1 - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
      if (cleanCpf.length === 11 && !/^(\d)\1{10}$/.test(cleanCpf) && dv(9) === dg[9] && dv(10) === dg[10]) {
        await supabase.from('perfil_atleta').update({ cpf_cnpj: cleanCpf, tipo_documento: 'cpf' }).eq('user_id', user_id).or('cpf_cnpj.is.null,cpf_cnpj.eq.');
      }
    } catch (e) { console.warn('Não foi possível guardar o CPF no perfil:', e); }
    let customerId: string | null = null;

    const searchResp = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cleanCpf}`, {
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
    });
    const searchResult = await searchResp.json();
    console.log('Customer search result:', JSON.stringify(searchResult));

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
      console.log('Customer creation result:', JSON.stringify(customerResult));

      if (customerResult.errors) {
        return new Response(
          JSON.stringify({ error: customerResult.errors[0]?.description || 'Erro ao criar cliente' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      customerId = customerResult.id;
    }

    // Step 2: Create PIX payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    const paymentResp = await fetch(`${ASAAS_API_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: valor,
        dueDate: dueDate.toISOString().split('T')[0],
        description: ciclo === 'anual' ? 'Carreira ID Elite - Plano anual' : 'Carreira ID Elite - Assinatura mensal',
        externalReference: `carreira_premium_${user_id}_${crianca_id}`,
        notificationDisabled: true,
      }),
    });

    const paymentResult = await paymentResp.json();
    console.log('Payment result:', JSON.stringify(paymentResult));

    if (paymentResult.errors) {
      return new Response(
        JSON.stringify({ error: paymentResult.errors[0]?.description || 'Erro ao criar cobrança' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Get PIX QR Code
    const qrResp = await fetch(`${ASAAS_API_URL}/payments/${paymentResult.id}/pixQrCode`, {
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
    });
    const qrResult = await qrResp.json();
    console.log('QR Code result:', JSON.stringify(qrResult));

    if (qrResult.errors) {
      return new Response(
        JSON.stringify({ error: qrResult.errors[0]?.description || 'Erro ao gerar QR Code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Create pending subscription record
    const expiraEm = new Date();
    expiraEm.setDate(expiraEm.getDate() + duracaoDias);

    const { data: subscription, error: subError } = await supabase
      .from('carreira_assinaturas')
      .insert({
        user_id,
        crianca_id,
        plano: planoSelecionado,
        status: 'pendente',
        valor,
        metodo_pagamento: 'pix',
        ciclo,
        duracao_dias: duracaoDias,
        gateway: 'asaas',
        gateway_subscription_id: paymentResult.id,
        inicio_em: new Date().toISOString().split('T')[0],
        expira_em: expiraEm.toISOString().split('T')[0],
      })
      .select('id')
      .single();

    if (subError) {
      console.error('Error creating subscription record:', subError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          paymentId: paymentResult.id,
          subscriptionId: subscription?.id,
          brCode: qrResult.payload,
          qrCodeImage: `data:image/png;base64,${qrResult.encodedImage}`,
          expiresAt: qrResult.expirationDate,
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
