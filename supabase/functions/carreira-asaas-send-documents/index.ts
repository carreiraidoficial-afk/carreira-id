import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_URL = "https://api.asaas.com/v3";

const DOCUMENT_TYPE_MAP: Record<string, string> = {
  documento_foto_pf: "IDENTIFICATION",
  contrato_social: "SOCIAL_CONTRACT",
  documento_responsavel_pj: "IDENTIFICATION",
};

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

    if (!cadastro?.asaas_account_id) throw new Error("Subconta Carreira não criada ainda");
    if (!cadastro.asaas_api_key) throw new Error("apiKey da subconta ausente");

    const { data: documentos } = await supabase.from("carreira_documentos").select("*");
    if (!documentos || documentos.length === 0) throw new Error("Nenhum documento para enviar");

    const { data: job } = await supabase
      .from("carreira_asaas_jobs")
      .insert({ tipo: "enviar_documento", status: "processando", payload: { count: documentos.length } })
      .select()
      .single();

    const results: Array<{ documento: string; success: boolean; error?: string }> = [];

    for (const doc of documentos as any[]) {
      try {
        const { data: file, error: dlErr } = await supabase.storage
          .from("carreira-asaas-documentos")
          .download(doc.storage_path);
        if (dlErr || !file) throw new Error(`download: ${dlErr?.message}`);

        const buf = new Uint8Array(await file.arrayBuffer());
        const base64 = btoa(String.fromCharCode(...buf));
        const asaasType = DOCUMENT_TYPE_MAP[doc.tipo_documento] ?? "CUSTOM";

        const resp = await fetch(`${ASAAS_API_URL}/myAccount/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "access_token": cadastro.asaas_api_key },
          body: JSON.stringify({ type: asaasType, documentFile: base64 }),
        });
        const r = await resp.json();
        if (!resp.ok) {
          results.push({ documento: doc.nome_arquivo, success: false, error: r?.errors?.[0]?.description || "erro" });
        } else {
          results.push({ documento: doc.nome_arquivo, success: true });
          await supabase
            .from("carreira_documentos")
            .update({ asaas_document_id: r.id, asaas_status: r.status })
            .eq("id", doc.id);
        }
      } catch (e) {
        results.push({ documento: doc.nome_arquivo, success: false, error: e instanceof Error ? e.message : "erro" });
      }
    }

    const allOk = results.every((r) => r.success);
    await supabase
      .from("carreira_asaas_jobs")
      .update({
        status: allOk ? "concluido" : "erro",
        resultado: results,
        erro: allOk ? null : "Alguns documentos falharam",
        processed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (results.some((r) => r.success)) {
      await supabase
        .from("carreira_cadastro_bancario")
        .update({ asaas_status: "pending_approval", asaas_atualizado_em: new Date().toISOString() })
        .eq("id", cadastro.id);
    }

    return new Response(JSON.stringify({ success: allOk, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[carreira-asaas-send-documents]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});