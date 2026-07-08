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
    const { user_id, crianca_id, cpf, nome, email, callback_url, plano } = await req.json();
    const planoSelecionado = plano || 'competidor';

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

    // Get subscription value based on plan
    const planoConfig: Record<string, { chave: string; fallback: number }> = {
      competidor: { chave: 'carreira_valor_competidor', fallback: 17.90 },
      elite: { chave: 'carreira_valor_elite', fallback: 29.90 },
    };
    const cfg = planoConfig[planoSelecionado] || planoConfig.competidor;
    
    const { data: configValor } = await supabase
      .from('saas_config')
      .select('valor')
      .eq('chave', cfg.chave)
      .maybeSingle();

    let valor = cfg.fallback;
    if (configValor) {
      valor = parseFloat(configValor.valor);
    } else {
      const { data: legacyConfig } = await supabase
        .from('saas_config')
        .select('valor')
        .eq('chave', 'carreira_valor_mensal')
        .maybeSingle();
      if (legacyConfig) valor = parseFloat(legacyConfig.valor);
    }

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

    // Create payment with notifications disabled
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    const paymentResp = await fetch(`${ASAAS_API_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'UNDEFINED',
        value: valor,
        dueDate: dueDate.toISOString().split('T')[0],
        description: `Carreira ID ${planoSelecionado.charAt(0).toUpperCase() + planoSelecionado.slice(1)} - Assinatura mensal`,
        externalReference: `carreira_${planoSelecionado}_${user_id}_${crianca_id}`,
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

    const checkoutUrl = paymentResult.invoiceUrl || null;
    console.log('Checkout URL:', checkoutUrl);

    // Save subscription record as pending
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
        gateway_subscription_id: paymentResult.id,
        inicio_em: new Date().toISOString().split('T')[0],
        expira_em: expiraEm.toISOString().split('T')[0],
      });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          paymentId: paymentResult.id,
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
