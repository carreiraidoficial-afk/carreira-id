import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase env vars");
      return new Response(
        JSON.stringify({ error: "Supabase not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate webhook access token (if configured)
    const accessToken = req.headers.get("asaas-access-token");
    const expectedToken = Deno.env.get("ASAAS_CARREIRA_WEBHOOK_TOKEN") || Deno.env.get("ASAAS_WEBHOOK_TOKEN");

    if (expectedToken && accessToken !== expectedToken) {
      console.warn("Webhook token mismatch (processing anyway):", {
        receivedLast6: accessToken ? accessToken.slice(-6) : null,
        receivedLength: accessToken?.length ?? 0,
      });
    }

    const payload = await req.json();
    console.log("Asaas webhook received:", JSON.stringify(payload));

    const { event, payment, account } = payload;

    if (payment) {
      console.log("Processing payment event:", event, "Payment ID:", payment.id);

      const paymentConfirmedEvents = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];
      const paymentFailedEvents = ["PAYMENT_OVERDUE", "PAYMENT_DELETED"];

      if (paymentConfirmedEvents.includes(event) || paymentFailedEvents.includes(event)) {
        // Assinatura família: o gateway_subscription_id fica em
        // carreira_assinaturas_familia, não numa linha individual -- checa
        // esse caminho primeiro e, se bater, ativa/cancela em cascata pras
        // linhas satélite dos filhos cobertos.
        const familiaMatchIds = [payment.subscription, payment.id].filter(Boolean) as string[];
        if (familiaMatchIds.length > 0) {
          const { data: familia } = await supabase
            .from("carreira_assinaturas_familia")
            .select("id, user_id, status")
            .in("gateway_subscription_id", familiaMatchIds)
            .maybeSingle();

          if (familia) {
            if (paymentConfirmedEvents.includes(event)) {
              const wasPending = familia.status === "pendente";
              const expiraEm = new Date();
              expiraEm.setDate(expiraEm.getDate() + 30);
              const metodo = payment.billingType === "CREDIT_CARD" ? "cartao_credito" : "pix";

              await supabase.from("carreira_assinaturas_familia").update({
                status: "ativa",
                metodo_pagamento: metodo,
                inicio_em: new Date().toISOString().split("T")[0],
                expira_em: expiraEm.toISOString().split("T")[0],
              }).eq("id", familia.id);

              await supabase.from("carreira_assinaturas").update({
                status: "ativa",
                metodo_pagamento: metodo,
                inicio_em: new Date().toISOString().split("T")[0],
                expira_em: expiraEm.toISOString().split("T")[0],
              }).eq("familia_id", familia.id);

              if (wasPending) {
                try {
                  await fetch(`${supabaseUrl}/functions/v1/send-carreira-push`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "apikey": supabaseServiceKey,
                      "Authorization": `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({
                      user_ids: [familia.user_id],
                      title: "✅ Pagamento confirmado!",
                      body: "Sua assinatura Família do Carreira ID já está ativa.",
                      url: "/minhas-assinaturas",
                      tag: "pagamento-confirmado-familia",
                    }),
                  });
                } catch (pushErr) {
                  console.error("Erro ao enviar push de confirmação (família):", pushErr);
                }
              }

              return new Response(
                JSON.stringify({ success: true, familiaId: familia.id }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            const novoStatus = event === "PAYMENT_OVERDUE" ? "inadimplente" : "cancelada";
            await supabase.from("carreira_assinaturas_familia").update({ status: novoStatus }).eq("id", familia.id);
            await supabase.from("carreira_assinaturas").update({ status: novoStatus }).eq("familia_id", familia.id);

            return new Response(
              JSON.stringify({ success: true, familiaId: familia.id }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        let assinatura: { id: string; user_id: string; status: string } | null = null;

        if (payment.subscription) {
          const { data } = await supabase
            .from("carreira_assinaturas")
            .select("id, user_id, status")
            .eq("gateway_subscription_id", payment.subscription)
            .maybeSingle();
          assinatura = data;
        }

        if (!assinatura) {
          const { data } = await supabase
            .from("carreira_assinaturas")
            .select("id, user_id, status")
            .eq("gateway_subscription_id", payment.id)
            .maybeSingle();
          assinatura = data;
        }

        if (!assinatura && payment.externalReference) {
          const parts = String(payment.externalReference).split("_");
          const criancaId = parts[parts.length - 1];
          const userId = parts[parts.length - 2];
          if (userId && criancaId) {
            const { data } = await supabase
              .from("carreira_assinaturas")
              .select("id, user_id, status")
              .eq("user_id", userId)
              .eq("crianca_id", criancaId)
              .neq("status", "cancelada")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            assinatura = data;
          }
        }

        if (!assinatura) {
          console.warn("No carreira_assinaturas row matched for payment:", payment.id);
          return new Response(
            JSON.stringify({ success: true, message: "No matching subscription found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (paymentConfirmedEvents.includes(event)) {
          const wasPending = assinatura.status === "pendente";
          const expiraEm = new Date();
          expiraEm.setDate(expiraEm.getDate() + 30);

          const { error: updateError } = await supabase
            .from("carreira_assinaturas")
            .update({
              status: "ativa",
              metodo_pagamento: payment.billingType === "CREDIT_CARD" ? "cartao_credito" : "pix",
              inicio_em: new Date().toISOString().split("T")[0],
              expira_em: expiraEm.toISOString().split("T")[0],
            })
            .eq("id", assinatura.id);

          if (updateError) {
            console.error("Error activating subscription:", updateError);
          } else {
            console.log("Subscription", assinatura.id, "activated (event:", event, ")");
          }

          // Se a assinatura estava "pendente" (ex: cartão em análise de risco pelo
          // Asaas, tela de checkout já fechada pelo usuário), avisa por push que
          // confirmou — cumpre a promessa que a UI faz ao usuário.
          if (wasPending && !updateError) {
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-carreira-push`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": supabaseServiceKey,
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  user_ids: [assinatura.user_id],
                  title: "✅ Pagamento confirmado!",
                  body: "Sua assinatura Premium do Carreira ID já está ativa.",
                  url: "/planos",
                  tag: "pagamento-confirmado",
                }),
              });
            } catch (pushErr) {
              console.error("Erro ao enviar push de confirmação:", pushErr);
            }
          }

          return new Response(
            JSON.stringify({ success: true, subscriptionId: assinatura.id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const novoStatus = event === "PAYMENT_OVERDUE" ? "inadimplente" : "cancelada";
        const { error: updateError } = await supabase
          .from("carreira_assinaturas")
          .update({ status: novoStatus })
          .eq("id", assinatura.id);

        if (updateError) {
          console.error("Error updating subscription:", updateError);
        } else {
          console.log("Subscription", assinatura.id, "marked", novoStatus);
        }

        return new Response(
          JSON.stringify({ success: true, subscriptionId: assinatura.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Unhandled payment event:", event);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Event processed:", event);
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
