import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_URL = "https://api.asaas.com/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let supabase: any = null;
  let jobId: string | null = null;

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada (conta raiz Atleta ID)");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, serviceKey);

    const { data: cadastro, error: cadErr } = await supabase
      .from("carreira_cadastro_bancario")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (cadErr || !cadastro) throw new Error("Cadastro bancário Carreira não encontrado");

    if (cadastro.asaas_account_id) {
      return new Response(
        JSON.stringify({ success: true, message: "Subconta já existe", account_id: cadastro.asaas_account_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!cadastro.income_value) throw new Error("Faturamento/renda mensal é obrigatório");
    if (!cadastro.cpf_cnpj) throw new Error("CPF/CNPJ é obrigatório");

    const { data: job } = await supabase
      .from("carreira_asaas_jobs")
      .insert({ tipo: "criar_subconta", status: "processando", payload: { cadastro } })
      .select()
      .single();
    jobId = job?.id ?? null;

    const extractBankCode = (b: string | null) => {
      if (!b) return "";
      const m = b.match(/^(\d+)/);
      return m ? m[1] : b.replace(/\D/g, "");
    };
    const bankCode = extractBankCode(cadastro.banco);
    if (!bankCode) throw new Error("Informe o código do banco (ex: 001, 237, 336)");

    const payload: Record<string, unknown> = {
      name: cadastro.nome,
      email: cadastro.email,
      cpfCnpj: cadastro.cpf_cnpj.replace(/\D/g, ""),
      mobilePhone: cadastro.telefone?.replace(/\D/g, ""),
      address: cadastro.rua,
      addressNumber: cadastro.numero,
      complement: cadastro.complemento,
      province: cadastro.bairro,
      postalCode: cadastro.cep?.replace(/\D/g, ""),
      companyType: cadastro.tipo_pessoa === "cnpj" ? "LIMITED" : null,
      incomeValue: cadastro.income_value,
      ...(cadastro.tipo_pessoa === "cpf" && cadastro.data_nascimento
        ? { birthDate: cadastro.data_nascimento }
        : {}),
    };

    console.log("[carreira-asaas] payload:", JSON.stringify(payload));

    const resp = await fetch(`${ASAAS_API_URL}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(`Asaas retornou resposta inválida (${resp.status}): ${text.slice(0, 200)}`);
    }

    if (!resp.ok) {
      const msg = result?.errors?.[0]?.description || result?.message || "Erro ao criar subconta";
      throw new Error(msg);
    }

    await supabase
      .from("carreira_cadastro_bancario")
      .update({
        asaas_account_id: result.id,
        asaas_api_key: result.apiKey ?? null,
        asaas_wallet_id: result.walletId ?? null,
        asaas_status: "pending",
        asaas_enviado_em: new Date().toISOString(),
        asaas_atualizado_em: new Date().toISOString(),
      })
      .eq("id", cadastro.id);

    if (jobId) {
      await supabase
        .from("carreira_asaas_jobs")
        .update({ status: "concluido", resultado: result, processed_at: new Date().toISOString() })
        .eq("id", jobId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Subconta Carreira criada",
        account_id: result.id,
        wallet_id: result.walletId ?? null,
        api_key_present: !!result.apiKey,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[carreira-asaas-create-subaccount]", msg);
    try {
      if (supabase && jobId) {
        await supabase
          .from("carreira_asaas_jobs")
          .update({ status: "erro", erro: msg, processed_at: new Date().toISOString() })
          .eq("id", jobId);
      }
    } catch (_) {}
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});