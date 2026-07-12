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
      return new Response(
        JSON.stringify({ error: 'Configuração de pagamento não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Find active PIX subscriptions expiring in the next 2 days
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const { data: expiringSubs, error: queryError } = await supabase
      .from('carreira_assinaturas')
      .select('id, user_id, crianca_id, plano, valor, gateway_subscription_id, expira_em')
      .eq('status', 'ativa')
      .eq('metodo_pagamento', 'pix')
      .lte('expira_em', twoDaysFromNow.toISOString())
      .gte('expira_em', new Date().toISOString());

    if (queryError) {
      console.error('Error querying expiring subscriptions:', queryError);
      return new Response(
        JSON.stringify({ error: 'Erro ao consultar assinaturas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiringSubs?.length || 0} PIX subscriptions expiring within 2 days`);

    const results: any[] = [];

    for (const sub of (expiringSubs || [])) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, nome, telefone')
          .eq('user_id', sub.user_id)
          .single();

        if (!profile) {
          console.warn(`No profile found for user ${sub.user_id}`);
          continue;
        }

        const { data: perfil } = await supabase
          .from('perfil_atleta')
          .select('cpf_cnpj')
          .eq('user_id', sub.user_id)
          .limit(1)
          .maybeSingle();

        const cpf = perfil?.cpf_cnpj?.replace(/\D/g, '');
        if (!cpf) {
          console.warn(`No CPF found for user ${sub.user_id}`);
          continue;
        }

        // Find customer in Asaas
        const searchResp = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cpf}`, {
          headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        });
        const searchResult = await searchResp.json();

        if (!searchResult.data?.length) {
          console.warn(`No Asaas customer found for CPF ending in ${cpf.slice(-4)}`);
          continue;
        }

        const customerId = searchResult.data[0].id;
        const valor = 12.0; // Preço fixo Premium

        // Create new PIX payment with notifications disabled
        const dueDate = new Date(sub.expira_em!);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        const paymentResp = await fetch(`${ASAAS_API_URL}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
          body: JSON.stringify({
            customer: customerId,
            billingType: 'PIX',
            value: valor,
            dueDate: dueDateStr,
            description: `Carreira ID Premium - Renovação mensal`,
            externalReference: `carreira_renew_premium_${sub.user_id}_${sub.crianca_id}`,
            notificationDisabled: true,
          }),
        });

        const paymentResult = await paymentResp.json();

        if (paymentResult.errors) {
          console.error(`Error creating renewal payment for sub ${sub.id}:`, paymentResult.errors);
          continue;
        }

        // Get PIX QR Code
        const qrResp = await fetch(`${ASAAS_API_URL}/payments/${paymentResult.id}/pixQrCode`, {
          headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        });
        const qrResult = await qrResp.json();

        // Update subscription with new payment ID
        await supabase
          .from('carreira_assinaturas')
          .update({
            gateway_subscription_id: paymentResult.id,
          })
          .eq('id', sub.id);

        console.log(`Renewal PIX generated for sub ${sub.id}, payment ${paymentResult.id}`);

        results.push({
          subscriptionId: sub.id,
          userId: sub.user_id,
          paymentId: paymentResult.id,
          valor,
          dueDate: dueDateStr,
          brCode: qrResult.payload || null,
        });

      } catch (err) {
        console.error(`Error processing subscription ${sub.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        total: expiringSubs?.length || 0,
        results,
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
