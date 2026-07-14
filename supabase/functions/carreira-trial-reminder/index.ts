import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const now = new Date();
    const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const sendPush = async (userIds: string[], title: string, body: string, tag: string) => {
      if (userIds.length === 0) return;
      await fetch(`${SUPABASE_URL}/functions/v1/send-carreira-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ user_ids: userIds, title, body, url: "/planos", tag }),
      });
    };

    const results = { avisos_2dias: 0, avisos_expirado: 0 };

    // 1. Trials expirando em até 2 dias, sem forma de pagamento definida, ainda não avisados
    const { data: expirandoEm2Dias } = await supabase
      .from("carreira_assinaturas")
      .select("id, user_id")
      .eq("status", "trial")
      .is("metodo_pagamento", null)
      .is("lembrete_trial_2d_em", null)
      .lte("expira_em", in2Days.toISOString())
      .gt("expira_em", now.toISOString());

    if (expirandoEm2Dias && expirandoEm2Dias.length > 0) {
      const userIds = [...new Set(expirandoEm2Dias.map((a: any) => a.user_id))];
      await sendPush(
        userIds,
        "⏰ Seu trial termina em 2 dias",
        "Escolha uma forma de pagamento para continuar aproveitando o Premium sem interrupção.",
        "trial-2dias"
      );
      await supabase
        .from("carreira_assinaturas")
        .update({ lembrete_trial_2d_em: now.toISOString() } as any)
        .in("id", expirandoEm2Dias.map((a: any) => a.id));
      results.avisos_2dias = userIds.length;
    }

    // 2. Trials já expirados, sem forma de pagamento definida, ainda não avisados
    const { data: expirados } = await supabase
      .from("carreira_assinaturas")
      .select("id, user_id")
      .eq("status", "trial")
      .is("metodo_pagamento", null)
      .is("lembrete_trial_expirado_em", null)
      .lte("expira_em", now.toISOString());

    if (expirados && expirados.length > 0) {
      const userIds = [...new Set(expirados.map((a: any) => a.user_id))];
      await sendPush(
        userIds,
        "Seu trial do Premium acabou",
        "Adicione uma forma de pagamento para continuar com os benefícios Premium.",
        "trial-expirado"
      );
      await supabase
        .from("carreira_assinaturas")
        .update({ lembrete_trial_expirado_em: now.toISOString() } as any)
        .in("id", expirados.map((a: any) => a.id));
      results.avisos_expirado = userIds.length;
    }

    console.log(`[carreira-trial-reminder] avisos_2dias=${results.avisos_2dias} avisos_expirado=${results.avisos_expirado}`);

    return new Response(JSON.stringify({ success: true, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("carreira-trial-reminder error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
