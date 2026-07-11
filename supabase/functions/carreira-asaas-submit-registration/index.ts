import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Orquestra: valida admin -> dispara create-subaccount e (encadeado) send-documents.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let supabase: any = null;
  let cadastroId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, serviceKey);

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
      .select("id, tipo_pessoa, cpf_cnpj, nome, email, telefone, data_nascimento, income_value, cep, rua, numero, bairro, cidade, estado, banco, agencia, conta, asaas_account_id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!cadastro) throw new Error("Cadastro bancário Carreira não encontrado");
    cadastroId = cadastro.id;

    const missingFields: string[] = [];
    const requiredFields: Array<[string, unknown]> = [
      ["CPF/CNPJ", cadastro.cpf_cnpj],
      ["Nome/Razão Social", cadastro.nome],
      ["Email", cadastro.email],
      ["Telefone", cadastro.telefone],
      ["Faturamento mensal", cadastro.income_value],
      ["CEP", cadastro.cep],
      ["Rua", cadastro.rua],
      ["Número", cadastro.numero],
      ["Bairro", cadastro.bairro],
      ["Cidade", cadastro.cidade],
      ["UF", cadastro.estado],
      ["Banco", cadastro.banco],
      ["Agência", cadastro.agencia],
      ["Conta", cadastro.conta],
    ];
    if (cadastro.tipo_pessoa === "cpf") requiredFields.push(["Data de nascimento", cadastro.data_nascimento]);
    for (const [label, value] of requiredFields) {
      if (value === null || value === undefined || String(value).trim() === "") missingFields.push(label);
    }
    if (missingFields.length > 0) {
      throw new Error(`Complete os campos obrigatórios antes de enviar: ${missingFields.join(", ")}`);
    }

    const { data: docs } = await supabase.from("carreira_documentos").select("tipo_documento");
    const requiredDocs = cadastro.tipo_pessoa === "cnpj"
      ? [
          ["contrato_social", "Contrato Social"],
          ["documento_responsavel_pj", "Documento do responsável"],
        ]
      : [["documento_foto_pf", "Documento com foto"]];
    const missingDocs = requiredDocs
      .filter(([tipo]) => !(docs || []).some((doc: any) => doc.tipo_documento === tipo))
      .map(([, label]) => label);
    if (missingDocs.length > 0) {
      throw new Error(`Envie os documentos obrigatórios antes de submeter: ${missingDocs.join(", ")}`);
    }

    const baseUrl = supabaseUrl.replace("/rest/v1", "");

    // Executa em modo síncrono para propagar erros reais ao frontend
    const createResp = await fetch(`${baseUrl}/functions/v1/carreira-asaas-create-subaccount`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({}),
    });
    const createText = await createResp.text();
    let createResult: any;
    try { createResult = JSON.parse(createText); } catch { createResult = { success: false, error: createText }; }
    console.log("[carreira submit] create result:", createResult);

    if (!createResult?.success) {
      throw new Error(
        `Falha ao criar subconta Asaas: ${createResult?.error || createText || "erro desconhecido"}`,
      );
    }

    let docsResult: any = null;
    if (createResult.account_id) {
      const r2 = await fetch(`${baseUrl}/functions/v1/carreira-asaas-send-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({}),
      });
      const docsText = await r2.text();
      try { docsResult = JSON.parse(docsText); } catch { docsResult = { success: false, error: docsText }; }
      console.log("[carreira submit] send-docs result:", docsResult);
      if (!docsResult?.success) {
        throw new Error(
          `Subconta criada, mas falhou ao enviar documentos: ${docsResult?.error || docsText || "erro desconhecido"}`,
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cadastro Carreira enviado para análise",
        status: "submitted",
        account_id: createResult.account_id,
        documents: docsResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    try {
      if (supabase && cadastroId) {
        await supabase
          .from("carreira_cadastro_bancario")
          .update({
            asaas_status: "awaiting_action",
            asaas_status_detail: { error: msg, source: "carreira-asaas-submit-registration" },
            asaas_atualizado_em: new Date().toISOString(),
          })
          .eq("id", cadastroId);
      }
    } catch (_) {}
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});