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
    const { user_id, crianca_ids, cpf, nome, email } = await req.json();

    if (!user_id || !Array.isArray(crianca_ids) || crianca_ids.length < 2 || !cpf || !nome || !email) {
      return new Response(
        JSON.stringify({ error: 'Dados obrigatórios não informados (user_id, crianca_ids com 2+ itens, cpf, nome, email)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Confere que todas as crianças pertencem de fato a esse responsável
    const { data: perfis } = await supabase
      .from('perfil_atleta')
      .select('crianca_id')
      .eq('user_id', user_id)
      .in('crianca_id', crianca_ids);
    if (!perfis || perfis.length !== crianca_ids.length) {
      return new Response(
        JSON.stringify({ error: 'Um ou mais atletas não pertencem a esse responsável' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bloqueia se já existe família ativa/pendente pra esse responsável
    const { data: familiaExistente } = await supabase
      .from('carreira_assinaturas_familia')
      .select('id')
      .eq('user_id', user_id)
      .in('status', ['ativa', 'pendente'])
      .maybeSingle();
    if (familiaExistente) {
      return new Response(
        JSON.stringify({ error: 'Você já tem uma assinatura família ativa ou em processamento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      .from('saas_config')
      .select('valor')
      .eq('chave', 'carreira_valor_familia')
      .maybeSingle();
    if (configValor) valor = parseFloat(configValor.valor);

    // Find or create customer in Asaas
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
        body: JSON.stringify({ name: nome, email, cpfCnpj: cleanCpf, notificationDisabled: true }),
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

    // Create PIX payment
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
        description: 'Carreira ID - Assinatura Família',
        externalReference: `carreira_familia_${user_id}`,
        notificationDisabled: true,
      }),
    });
    const paymentResult = await paymentResp.json();

    if (paymentResult.errors) {
      return new Response(
        JSON.stringify({ error: paymentResult.errors[0]?.description || 'Erro ao criar cobrança' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get PIX QR Code
    const qrResp = await fetch(`${ASAAS_API_URL}/payments/${paymentResult.id}/pixQrCode`, {
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
    });
    const qrResult = await qrResp.json();

    if (qrResult.errors) {
      return new Response(
        JSON.stringify({ error: qrResult.errors[0]?.description || 'Erro ao gerar QR Code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expiraEm = new Date();
    expiraEm.setDate(expiraEm.getDate() + 30);
    const inicioEm = new Date().toISOString().split('T')[0];
    const expiraEmStr = expiraEm.toISOString().split('T')[0];

    const { data: familia, error: familiaError } = await supabase
      .from('carreira_assinaturas_familia')
      .insert({
        user_id,
        status: 'pendente',
        valor,
        metodo_pagamento: 'pix',
        gateway: 'asaas',
        gateway_subscription_id: paymentResult.id,
        inicio_em: inicioEm,
        expira_em: expiraEmStr,
      })
      .select('id')
      .single();

    if (familiaError || !familia) {
      console.error('Error creating carreira_assinaturas_familia:', familiaError);
      return new Response(
        JSON.stringify({ error: 'Erro ao registrar assinatura família' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const satelliteRows = crianca_ids.map((crianca_id: string) => ({
      user_id,
      crianca_id,
      plano: 'premium',
      status: 'pendente',
      metodo_pagamento: 'pix',
      gateway: 'asaas',
      familia_id: familia.id,
      inicio_em: inicioEm,
      expira_em: expiraEmStr,
    }));
    const { error: satelliteError } = await supabase.from('carreira_assinaturas').insert(satelliteRows);
    if (satelliteError) {
      console.error('Error creating satellite carreira_assinaturas rows:', satelliteError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          paymentId: paymentResult.id,
          familiaId: familia.id,
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
