import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';

// One-shot admin utility: percorre todos os clientes Asaas e desativa
// notificações (email/SMS/WhatsApp) para não gerar custos.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing ASAAS_API_KEY' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let offset = 0;
    const limit = 100;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const errors: Array<{ id: string; error: string }> = [];

    while (true) {
      const listResp = await fetch(
        `${ASAAS_API_URL}/customers?limit=${limit}&offset=${offset}`,
        { headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY } }
      );
      const listJson = await listResp.json();
      const customers: Array<{ id: string; notificationDisabled?: boolean }> = listJson.data || [];
      if (customers.length === 0) break;

      for (const c of customers) {
        if (c.notificationDisabled) { totalSkipped++; continue; }
        try {
          const upd = await fetch(`${ASAAS_API_URL}/customers/${c.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
            body: JSON.stringify({ notificationDisabled: true }),
          });
          const updJson = await upd.json();
          if (updJson.errors) {
            errors.push({ id: c.id, error: JSON.stringify(updJson.errors) });
          } else {
            totalUpdated++;
          }
        } catch (e) {
          errors.push({ id: c.id, error: String(e) });
        }
      }

      if (customers.length < limit) break;
      offset += limit;
    }

    return new Response(
      JSON.stringify({ ok: true, updated: totalUpdated, alreadyDisabled: totalSkipped, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[disable-asaas-notifications]', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});