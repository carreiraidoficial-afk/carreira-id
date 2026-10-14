import { createClient as __criarCliente } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// ---- Trava de acesso (adicionada em 14/10/2026) ----
// Antes esta função não exigia login: qualquer pessoa com a chave pública conseguia chamá-la.
// Agora só passa o servidor (chave de serviço) ou um usuário logado com um dos papéis permitidos.
async function __autorizado(req: Request, papeis: string[]): Promise<boolean> {
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  if (token === chave) return true;
  const admin = __criarCliente(Deno.env.get("SUPABASE_URL") ?? "", chave, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await admin.auth.getUser(token);
  if (!data?.user) return false;
  const { data: papeisDoUsuario } = await admin.from("user_roles").select("role").eq("user_id", data.user.id);
  return (papeisDoUsuario ?? []).some((r: any) => papeis.includes(r.role));
}

Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  if (!(await __autorizado(req, ["admin"]))) {
    return new Response(JSON.stringify({ success: false, error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ASAAS_API_KEY = Deno.env.get('ASAAS_SANDBOX_API_KEY');
  if (!ASAAS_API_KEY) {
    return new Response(JSON.stringify({
      error: 'No key'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  const resp = await fetch('https://sandbox.asaas.com/api/v3/myAccount/commercialInfo', {
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY
    }
  });
  const data = await resp.json();
  return new Response(JSON.stringify({
    name: data.name,
    cpfCnpj: data.cpfCnpj,
    email: data.email
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
});
