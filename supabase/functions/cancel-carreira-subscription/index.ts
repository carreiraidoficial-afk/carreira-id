import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';

// Cancela uma assinatura individual (nao-familia) de verdade: primeiro na
// Asaas (pra parar a cobranca recorrente real), so depois no nosso banco.
// Ao contrario de mudar o status direto pelo client (como o
// AssinaturaCard.tsx fazia antes), isso garante que "cancelado no app"
// signifique "cancelado na cobranca de verdade".
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const assinaturaId: string | undefined = body?.assinatura_id;
    if (!assinaturaId) {
      return new Response(JSON.stringify({ error: 'assinatura_id obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: assinatura, error: assinaturaError } = await adminClient
      .from('carreira_assinaturas')
      .select('id, user_id, status, gateway_subscription_id, inicio_em, expira_em')
      .eq('id', assinaturaId)
      .maybeSingle();

    if (assinaturaError || !assinatura) {
      return new Response(JSON.stringify({ error: 'Assinatura não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (assinatura.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Essa assinatura não pertence a você' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (assinatura.status === 'cancelada') {
      return new Response(JSON.stringify({ success: true, alreadyCancelled: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (assinatura.gateway_subscription_id) {
      if (!ASAAS_API_KEY) {
        return new Response(JSON.stringify({ error: 'Configuração de pagamento não encontrada' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      try {
        const asaasRes = await fetch(`${ASAAS_API_URL}/subscriptions/${assinatura.gateway_subscription_id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        });
        // 404 = a assinatura ja nao existe mais na Asaas (cancelada por outro
        // caminho) -- trata como sucesso. Qualquer outra falha NAO marca como
        // cancelada aqui, pra nunca repetir "app diz cancelado mas a Asaas
        // continua cobrando" -- o usuario ve o erro e pode tentar de novo.
        if (!asaasRes.ok && asaasRes.status !== 404) {
          const bodyText = await asaasRes.text().catch(() => '');
          console.error('[cancel-carreira-subscription] Asaas recusou o cancelamento:', asaasRes.status, bodyText);
          return new Response(JSON.stringify({ error: 'Não foi possível cancelar o pagamento recorrente. Tente novamente em instantes.' }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (fetchErr) {
        console.error('[cancel-carreira-subscription] erro de rede ao cancelar na Asaas:', fetchErr);
        return new Response(JSON.stringify({ error: 'Não foi possível falar com o sistema de pagamento. Tente novamente em instantes.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const canceladaEm = new Date().toISOString();
    const expiraEm = assinatura.expira_em ||
      new Date(new Date(assinatura.inicio_em).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await adminClient
      .from('carreira_assinaturas')
      .update({ status: 'cancelada', cancelada_em: canceladaEm, expira_em: expiraEm })
      .eq('id', assinaturaId);

    return new Response(JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('cancel-carreira-subscription error:', err);
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
