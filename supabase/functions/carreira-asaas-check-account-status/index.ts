import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_URL = "https://api.asaas.com/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cadastro } = await supabase
      .from("carreira_cadastro_bancario")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!cadastro) throw new Error("Cadastro Carreira não encontrado");
    if (!cadastro.asaas_account_id) {
      return new Response(
        JSON.stringify({ success: true, status: "not_submitted", localStatus: cadastro.asaas_status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Prefer subaccount API key; fall back to CARREIRA env if já configurada
    const apiKey = cadastro.asaas_api_key || Deno.env.get("ASAAS_CARREIRA_API_KEY");
    if (!apiKey) throw new Error("apiKey da subconta Carreira ausente");

    const resp = await fetch(`${ASAAS_API_URL}/myAccount/status`, {
      headers: { "Content-Type": "application/json", "access_token": apiKey },
    });
    if (!resp.ok) throw new Error(`Asaas status ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();

    const allApproved =
      data.general === "APPROVED" &&
      data.commercialInfo === "APPROVED" &&
      data.bankAccountInfo === "APPROVED" &&
      data.documentation === "APPROVED";

    let mapped = "pending";
    if (allApproved) mapped = "approved";
    else if (data.general === "REJECTED") mapped = "rejected";
    else if ([data.bankAccountInfo, data.documentation].some((s) => s === "PENDING" || s === "REJECTED"))
      mapped = "awaiting_action";

    await supabase
      .from("carreira_cadastro_bancario")
      .update({
        asaas_status: mapped,
        asaas_status_detail: data,
        asaas_atualizado_em: new Date().toISOString(),
      })
      .eq("id", cadastro.id);

    return new Response(
      JSON.stringify({ success: true, status: mapped, detailedStatus: data, accountId: cadastro.asaas_account_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[carreira-asaas-check-account-status]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});