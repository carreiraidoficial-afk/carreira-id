import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Orquestra: valida admin -> dispara create-subaccount e (encadeado) send-documents.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Autorização necessária");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Não autenticado");

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito ao admin");

    const { data: cadastro } = await supabase
      .from("carreira_cadastro_bancario")
      .select("id, asaas_account_id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!cadastro) throw new Error("Cadastro bancário Carreira não encontrado");

    const { data: docs } = await supabase.from("carreira_documentos").select("id").limit(1);
    if (!docs || docs.length === 0) throw new Error("Envie os documentos obrigatórios antes de submeter");

    const baseUrl = supabaseUrl.replace("/rest/v1", "");

    // Fire and forget
    (async () => {
      try {
        const r = await fetch(`${baseUrl}/functions/v1/carreira-asaas-create-subaccount`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({}),
        });
        const result = await r.json();
        console.log("[carreira submit] create result:", result);
        if (result.success && result.account_id) {
          const r2 = await fetch(`${baseUrl}/functions/v1/carreira-asaas-send-documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({}),
          });
          console.log("[carreira submit] send-docs status:", r2.status);
        }
      } catch (e) {
        console.error("[carreira submit] chain error:", e);
      }
    })();

    return new Response(
      JSON.stringify({ success: true, message: "Cadastro Carreira enviado para análise", status: "submitted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});