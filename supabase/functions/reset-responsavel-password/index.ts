import { createClient as __criarCliente } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
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

serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  if (!(await __autorizado(req, ["admin", "school"]))) {
    return new Response(JSON.stringify({ success: false, error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const { responsavelId, email, newPassword } = await req.json();
    if (!responsavelId && !email) {
      throw new Error("responsavelId ou email é obrigatório");
    }
    // Get the responsavel by id or email
    let query = supabaseAdmin.from('responsaveis').select('id, user_id, email, nome');
    if (responsavelId) {
      query = query.eq('id', responsavelId);
    } else if (email) {
      query = query.eq('email', email);
    }
    const { data: responsavel, error: fetchError } = await query.single();
    if (fetchError || !responsavel) {
      throw new Error("Responsável não encontrado");
    }
    if (!responsavel.user_id) {
      throw new Error("Responsável não possui usuário vinculado");
    }
    // Use provided password or generate a new one
    const tempPassword = newPassword || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    // Update the user's password
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(responsavel.user_id, {
      password: tempPassword
    });
    if (authError) throw authError;
    // Update responsavel with new temp password
    await supabaseAdmin.from('responsaveis').update({
      senha_temporaria: tempPassword,
      senha_temporaria_ativa: true
    }).eq('id', responsavel.id);
    // Mark profile as needing password change
    await supabaseAdmin.from('profiles').update({
      password_needs_change: true
    }).eq('user_id', responsavel.user_id);
    console.log(`Password reset for responsavel ${responsavel.email}`);
    // Send password reset email
    let emailSent = false;
    try {
      const emailResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-password-reset-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify({
          guardianName: responsavel.nome,
          guardianEmail: responsavel.email,
          tempPassword: tempPassword,
          loginUrl: "https://atletaid.com.br/auth"
        })
      });
      const emailResult = await emailResponse.json();
      emailSent = emailResult.success === true;
      if (emailSent) {
        console.log("Password reset email sent successfully to", responsavel.email);
      } else {
        console.error("Failed to send password reset email:", emailResult.error);
      }
    } catch (emailError) {
      console.error("Error sending password reset email:", emailError);
    // Non-fatal error, continue
    }
    return new Response(JSON.stringify({
      success: true,
      tempPassword,
      emailSent,
      responsavel: {
        id: responsavel.id,
        nome: responsavel.nome,
        email: responsavel.email
      },
      message: emailSent ? `Senha resetada e enviada por email para ${responsavel.email}` : "Senha resetada com sucesso"
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error resetting responsavel password:", error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
