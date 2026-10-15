import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const ASAAS_API_URL = "https://api.asaas.com/v3";

/** Consulta a cobrança direto no Asaas. null = falha ao consultar (não confirma nada); "nao_encontrada" = 404. */
async function consultarCobranca(paymentId: string): Promise<Record<string, any> | "nao_encontrada" | null> {
  const key = Deno.env.get("ASAAS_API_KEY");
  if (!key || !paymentId) return null;
  try {
    const r = await fetch(`${ASAAS_API_URL}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { "Content-Type": "application/json", access_token: key },
    });
    if (r.status === 404) return "nao_encontrada";
    if (!r.ok) return null;
    return await r.json();
  } catch (_) {
    return null;
  }
}

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

    const { event, account } = payload;
    let payment = payload.payment;

    if (payment) {
      console.log("Processing payment event:", event, "Payment ID:", payment.id);

      const paymentConfirmedEvents = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];
      // Reembolso e chargeback tiram o acesso na hora (status "cancelada" + validade encerrada).
      const paymentRevokedEvents = ["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"];
      const paymentFailedEvents = ["PAYMENT_OVERDUE", "PAYMENT_DELETED", ...paymentRevokedEvents];

      if (paymentConfirmedEvents.includes(event) || paymentFailedEvents.includes(event)) {
        // O corpo do webhook NÃO é confiável (a URL é pública e o token pode estar ausente ou errado):
        // quem manda é o Asaas, então o evento só vale se a cobrança, consultada direto na API do Asaas, confirmar.
        // Também passamos a usar os dados consultados (assinatura, referência, valor), nunca os do corpo.
        const verificado = await consultarCobranca(String(payment.id || ""));
        const statusReal = verificado === "nao_encontrada" ? "DELETED" : verificado?.status;
        const eventoConfere =
          (paymentConfirmedEvents.includes(event) && ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(statusReal)) ||
          (event === "PAYMENT_OVERDUE" && statusReal === "OVERDUE") ||
          (event === "PAYMENT_DELETED" && (statusReal === "DELETED" || (verificado && verificado !== "nao_encontrada" && verificado.deleted === true))) ||
          (event === "PAYMENT_REFUNDED" && ["REFUNDED", "REFUND_REQUESTED"].includes(statusReal)) ||
          (event === "PAYMENT_CHARGEBACK_REQUESTED" && ["CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL"].includes(statusReal));
        if (!eventoConfere) {
          console.warn("Evento não confirmado pela API do Asaas (ignorado):", event, payment.id, statusReal ?? "sem resposta");
          return new Response(
            JSON.stringify({ success: true, ignored: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (verificado && verificado !== "nao_encontrada") {
          payment = { ...payment, ...verificado };
        }
        const valorPago = Number(payment.value ?? 0);
        // Assinatura família: o gateway_subscription_id fica em
        // carreira_assinaturas_familia, não numa linha individual -- checa
        // esse caminho primeiro e, se bater, ativa/cancela em cascata pras
        // linhas satélite dos filhos cobertos.
        const familiaMatchIds = [payment.subscription, payment.id].filter(Boolean) as string[];
        if (familiaMatchIds.length > 0) {
          const { data: familia } = await supabase
            .from("carreira_assinaturas_familia")
            .select("id, user_id, status, valor")
            .in("gateway_subscription_id", familiaMatchIds)
            .maybeSingle();

          if (familia) {
            if (paymentConfirmedEvents.includes(event)) {
              if (familia.valor && valorPago > 0 && valorPago < Number(familia.valor) * 0.99) {
                console.warn("Valor pago menor que o da assinatura família (ignorado):", valorPago, familia.valor);
                return new Response(JSON.stringify({ success: true, ignored: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
              }
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
            const revogar = paymentRevokedEvents.includes(event) ? { expira_em: new Date().toISOString().split("T")[0] } : {};
            await supabase.from("carreira_assinaturas_familia").update({ status: novoStatus, ...revogar }).eq("id", familia.id);
            await supabase.from("carreira_assinaturas").update({ status: novoStatus, ...revogar }).eq("familia_id", familia.id);

            return new Response(
              JSON.stringify({ success: true, familiaId: familia.id }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        let assinatura: { id: string; user_id: string; status: string; valor?: number | null; expira_em?: string | null; duracao_dias?: number | null; ultimo_pagamento_id?: string | null } | null = null;

        if (payment.subscription) {
          const { data } = await supabase
            .from("carreira_assinaturas")
            .select("id, user_id, status, valor, expira_em, duracao_dias, ultimo_pagamento_id")
            .eq("gateway_subscription_id", payment.subscription)
            .maybeSingle();
          assinatura = data;
        }

        if (!assinatura) {
          const { data } = await supabase
            .from("carreira_assinaturas")
            .select("id, user_id, status, valor, expira_em, duracao_dias, ultimo_pagamento_id")
            .eq("gateway_subscription_id", payment.id)
            .maybeSingle();
          assinatura = data;
        }

        if (!assinatura && payment.installment) {
          const { data } = await supabase
            .from("carreira_assinaturas")
            .select("id, user_id, status, valor, expira_em, duracao_dias, ultimo_pagamento_id")
            .eq("gateway_subscription_id", payment.installment)
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
              .select("id, user_id, status, valor, expira_em, duracao_dias, ultimo_pagamento_id")
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
          if (!payment.installment && assinatura.valor && valorPago > 0 && valorPago < Number(assinatura.valor) * 0.99) {
            console.warn("Valor pago menor que o da assinatura (ignorado):", valorPago, assinatura.valor);
            return new Response(JSON.stringify({ success: true, ignored: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          const wasPending = assinatura.status === "pendente";
          // Cada cobrança soma os dias UMA vez (CONFIRMED e RECEIVED da mesma cobrança, parcelas do cartão e a checagem do app
          // chegam todas aqui). A validade soma ao que ainda resta, em vez de recomeçar de hoje.
          const chavePagamento = String(payment.installment || payment.id);
          if (assinatura.ultimo_pagamento_id === chavePagamento) {
            return new Response(
              JSON.stringify({ success: true, subscriptionId: assinatura.id, alreadyCounted: true }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          const hoje = new Date();
          const aindaValida = assinatura.status === "ativa" && assinatura.expira_em && new Date(assinatura.expira_em) > hoje;
          const base = aindaValida ? new Date(assinatura.expira_em as string) : hoje;
          const expiraEm = new Date(base.getTime());
          expiraEm.setDate(expiraEm.getDate() + (assinatura.duracao_dias || 30));

          const { error: updateError } = await supabase
            .from("carreira_assinaturas")
            .update({
              status: "ativa",
              metodo_pagamento: payment.billingType === "CREDIT_CARD" ? "cartao_credito" : "pix",
              ...(aindaValida ? {} : { inicio_em: hoje.toISOString().split("T")[0] }),
              expira_em: expiraEm.toISOString().split("T")[0],
              ultimo_pagamento_id: chavePagamento,
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
                  body: "Sua assinatura Elite do Carreira ID já está ativa.",
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
        const revogar = paymentRevokedEvents.includes(event) ? { expira_em: new Date().toISOString().split("T")[0] } : {};
        const { error: updateError } = await supabase
          .from("carreira_assinaturas")
          .update({ status: novoStatus, ...revogar })
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
