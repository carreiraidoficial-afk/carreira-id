import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';

// One-shot admin utility: for each externalReference with more than one
// active/pending Asaas subscription, keep the newest and cancel the rest.
// Optionally accepts { customer_email } or { external_reference } to scope.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!ASAAS_API_KEY) throw new Error('ASAAS_API_KEY missing');
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const body = await req.json().catch(() => ({}));
    const customerEmail: string | undefined = body?.customer_email;
    const externalRef: string | undefined = body?.external_reference;

    // Fetch active subscriptions
    const params = new URLSearchParams({ limit: '100' });
    if (externalRef) params.set('externalReference', externalRef);
    const subsResp = await fetch(`${ASAAS_API_URL}/subscriptions?${params}`, {
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
    });
    const subsJson = await subsResp.json();
    const subs = (subsJson.data || []) as any[];

    // Optionally filter by customer email
    let filtered = subs;
    if (customerEmail) {
      const cResp = await fetch(`${ASAAS_API_URL}/customers?email=${encodeURIComponent(customerEmail)}`, {
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      });
      const cJson = await cResp.json();
      const custIds = new Set((cJson.data || []).map((c: any) => c.id));
      filtered = subs.filter((s) => custIds.has(s.customer));
    }

    // Group by externalReference
    const byRef = new Map<string, any[]>();
    for (const s of filtered) {
      const key = s.externalReference || `__nokey_${s.customer}`;
      if (!byRef.has(key)) byRef.set(key, []);
      byRef.get(key)!.push(s);
    }

    const canceled: string[] = [];
    const kept: string[] = [];
    for (const [key, group] of byRef.entries()) {
      // Sort by dateCreated desc; keep first, cancel the rest
      group.sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''));
      kept.push(group[0].id);
      for (let i = 1; i < group.length; i++) {
        try {
          await fetch(`${ASAAS_API_URL}/subscriptions/${group[i].id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
          });
          canceled.push(group[i].id);
          await supabase.from('carreira_assinaturas')
            .update({ status: 'cancelada' })
            .eq('gateway_subscription_id', group[i].id);
        } catch (e) {
          console.warn('failed cancel', group[i].id, e);
        }
      }
    }

    // Also delete any PENDING payments not tied to kept subs (best effort)
    const paysResp = await fetch(`${ASAAS_API_URL}/payments?status=PENDING&limit=100`, {
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
    });
    const paysJson = await paysResp.json();
    const deletedPayments: string[] = [];
    for (const p of (paysJson.data || [])) {
      if (p.subscription && !kept.includes(p.subscription) && canceled.includes(p.subscription)) {
        try {
          await fetch(`${ASAAS_API_URL}/payments/${p.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
          });
          deletedPayments.push(p.id);
        } catch (_) {}
      }
    }

    return new Response(JSON.stringify({
      success: true,
      inspected: filtered.length,
      kept, canceled, deletedPayments,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('cleanup-asaas-duplicates error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});