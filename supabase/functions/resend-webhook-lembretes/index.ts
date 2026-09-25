import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/svix@1.24.0";

// Recebe os eventos de todo o dominio carreiraid.com.br no Resend (nao so
// dos lembretes de perfil incompleto). So atualiza uma linha quando o
// email_id bate com um envio registrado em carreira_lembretes_perfil_enviados
// -- eventos de outros emails (ex: dicas de uso) sao ignorados silenciosamente.
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200 });

  try {
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (!webhookSecret) throw new Error("RESEND_WEBHOOK_SECRET não configurada");

    const payload = await req.text();
    const svixHeaders = {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    };

    let event: any;
    try {
      event = new Webhook(webhookSecret).verify(payload, svixHeaders);
    } catch (err) {
      console.error("[resend-webhook-lembretes] assinatura inválida:", err);
      return new Response("invalid signature", { status: 400 });
    }

    const emailId = event?.data?.email_id;
    if (!emailId || (event.type !== "email.opened" && event.type !== "email.clicked")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const coluna = event.type === "email.opened" ? "aberto_em" : "clicado_em";
    await supabase
      .from("carreira_lembretes_perfil_enviados")
      .update({ [coluna]: new Date().toISOString() })
      .eq("resend_email_id", emailId)
      .is(coluna, null);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[resend-webhook-lembretes] erro:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
