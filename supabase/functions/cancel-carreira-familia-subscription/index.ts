import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';

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
    const familiaId: string | undefined = body?.familia_id;
    if (!familiaId) {
      return new Response(JSON.stringify({ error: 'familia_id obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: familia, error: familiaError } = await adminClient
      .from('carreira_assinaturas_familia')
      .select('id, user_id, status, gateway_subscription_id')
      .eq('id', familiaId)
      .maybeSingle();

    if (familiaError || !familia) {
      return new Response(JSON.stringify({ error: 'Assinatura família não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (familia.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Essa assinatura família não pertence a você' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (familia.status === 'cancelada') {
      return new Response(JSON.stringify({ success: true, alreadyCancelled: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (familia.gateway_subscription_id && ASAAS_API_KEY) {
      try {
        await fetch(`${ASAAS_API_URL}/subscriptions/${familia.gateway_subscription_id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        });
      } catch (_) { /* ignora falha ao cancelar na Asaas -- as linhas locais ainda são marcadas canceladas abaixo */ }
    }

    const canceladaEm = new Date().toISOString();
    await adminClient
      .from('carreira_assinaturas_familia')
      .update({ status: 'cancelada', cancelada_em: canceladaEm })
      .eq('id', familiaId);

    const { error: cascadeError } = await adminClient
      .from('carreira_assinaturas')
      .update({ status: 'cancelada', cancelada_em: canceladaEm })
      .eq('familia_id', familiaId);

    if (cascadeError) {
      console.error('[cancel-carreira-familia-subscription] erro ao cancelar linhas satélite:', cascadeError);
    }

    return new Response(JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('cancel-carreira-familia-subscription error:', err);
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
