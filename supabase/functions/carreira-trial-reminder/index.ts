import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

// Avisos de fim de teste grátis, por push E por e-mail (e-mail vai para todos, tenham ou não o push ligado).
// Roda todo dia pelo agendador do banco. Só o servidor chama: exige o segredo interno.
//   - 2 dias antes do fim do teste;
//   - depois que o teste acabou (só até 3 dias depois, para nunca avisar tarde demais ou de teste antigo).
// Pessoas que pediram para não receber lembretes (profiles.excluir_lembretes) não recebem o e-mail; o push segue a regra do app.
// Para testar o visual: chamada com o segredo e {"preview_to": "email", "tipo": "trial_2dias" | "trial_expirado"}.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const LINK_PLANOS = "https://carreiraid.com.br/planos";

function htmlTrial(tipo: "trial_2dias" | "trial_expirado", primeiroNome: string, atleta: string) {
  const antes = tipo === "trial_2dias";
  const titulo = antes
    ? `O teste do Elite de ${esc(atleta)} termina em 2 dias`
    : `O teste do Elite de ${esc(atleta)} terminou`;
  const texto = antes
    ? "Depois disso o perfil continua no ar e tudo o que já foi registrado fica guardado. Mas o plano volta para o Base, que tem limites. Para continuar com o Elite sem interrupção, é só assinar — e quem assina antes do fim do teste ganha pelo menos 7 dias grátis a mais."
    : "O perfil continua no ar e nada foi apagado. A partir de agora ele está no plano Base, que tem limites. Quando quiser voltar ao Elite, é só assinar: os registros e as conquistas continuam exatamente onde estavam.";
  const lista = [
    "1 registro de Carreira por mês",
    "1 campeonato novo na Jornada por mês",
    "1 publicação por dia, sem vídeos",
    "Sem a lista de quem visitou o perfil",
  ].map((i) => `<li style="margin:0 0 6px 0;">${i}</li>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="dark"><title>${titulo}</title></head>
<body bgcolor="#000000" style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#0d0d0d" style="width:600px;max-width:100%;background:#0d0d0d;border:1px solid #262626;">
<tr><td style="padding:28px 40px;border-bottom:1px solid #262626;"><img src="https://carreiraid.com.br/logo-carreira-id-email.png" width="170" height="42" alt="Carreira ID" style="display:block;border:0;"></td></tr>
<tr><td style="padding:40px 40px 8px 40px;">
<p style="margin:0 0 10px 0;font-size:13px;font-weight:700;color:#22c55e;text-transform:uppercase;letter-spacing:1.5px;">Olá, ${primeiroNome}!</p>
<h1 style="margin:0 0 14px 0;font-size:28px;line-height:1.25;font-weight:800;color:#f5f5f5;">${titulo}</h1>
<p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#a3a3a3;">${texto}</p>
<p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#f5f5f5;">No plano Base:</p>
<ul style="margin:0 0 18px 18px;padding:0;font-size:14px;line-height:1.5;color:#a3a3a3;">${lista}</ul>
<p style="margin:0;font-size:14px;line-height:1.6;color:#a3a3a3;">Elite: <strong style="color:#f5f5f5;">R$ 12,00 por mês</strong> ou <strong style="color:#f5f5f5;">R$ 120,00 por ano</strong> (em até 12x no cartão). Pode pagar por PIX ou cartão.</p>
</td></tr>
<tr><td align="center" style="padding:28px 40px 36px 40px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#f97316" style="background:#f97316;"><a href="${LINK_PLANOS}" style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:700;color:#000000;text-decoration:none;">${antes ? "Continuar com o Elite" : "Voltar ao Elite"} →</a></td></tr></table></td></tr>
<tr><td style="padding:20px 40px;background:#0a0a0a;border-top:1px solid #262626;"><p style="margin:0;font-size:11px;line-height:1.6;color:#525252;">Você recebeu este e-mail porque ${esc(atleta)} tem um perfil no Carreira ID com período de teste do Elite.</p></td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSecret = Deno.env.get("PUSH_INTERNAL_SECRET") || "";
    if (!internalSecret || req.headers.get("x-internal-secret") !== internalSecret) {
      return json({ error: "unauthorized" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const resend = resendKey ? new Resend(resendKey) : null;
    const body = await req.json().catch(() => ({} as any));

    // Modo de teste do visual: manda um exemplo só para o endereço informado.
    if (body?.preview_to) {
      if (!resend) return json({ error: "RESEND_API_KEY não configurada" }, 500);
      const tipo = body.tipo === "trial_expirado" ? "trial_expirado" : "trial_2dias";
      const r = await resend.emails.send({
        from: "Carreira ID <contato@carreiraid.com.br>",
        to: [String(body.preview_to)],
        subject: tipo === "trial_2dias" ? "O teste do Elite de João termina em 2 dias" : "O teste do Elite de João terminou",
        html: htmlTrial(tipo, "William", "João"),
      });
      return json({ preview: true, erro: (r as any)?.error ? String((r as any).error?.message || (r as any).error).slice(0, 200) : null });
    }

    const now = new Date();
    const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const ha3Dias = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const sendPush = async (userIds: string[], title: string, texto: string, tag: string) => {
      if (userIds.length === 0) return;
      await fetch(`${SUPABASE_URL}/functions/v1/send-carreira-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": internalSecret },
        body: JSON.stringify({ user_ids: userIds, title, body: texto, url: "/planos", tag }),
      });
    };

    // E-mail para cada assinatura avisada (todos, com ou sem push), no máximo um de cada tipo por pessoa/atleta.
    const sendEmails = async (rows: any[], tipo: "trial_2dias" | "trial_expirado") => {
      if (!resend) return 0;
      let enviados = 0;
      for (const a of rows) {
        try {
          const { data: prof } = await supabase.from("profiles").select("nome, excluir_lembretes").eq("user_id", a.user_id).maybeSingle();
          if (prof?.excluir_lembretes) continue;
          const { data: u } = await supabase.auth.admin.getUserById(a.user_id);
          const email = u?.user?.email;
          if (!email) continue;
          const { data: atl } = await supabase.from("perfil_atleta").select("nome").eq("crianca_id", a.crianca_id).maybeSingle();
          const atleta = String(atl?.nome || "seu atleta").trim().split(" ")[0] || "seu atleta";
          const primeiroNome = esc(String(prof?.nome || "").trim().split(" ")[0] || "tudo bem");
          const r = await resend.emails.send({
            from: "Carreira ID <contato@carreiraid.com.br>",
            to: [email],
            subject: tipo === "trial_2dias" ? `O teste do Elite de ${atleta} termina em 2 dias` : `O teste do Elite de ${atleta} terminou`,
            html: htmlTrial(tipo, primeiroNome, atleta),
          });
          if ((r as any)?.error) { console.error("e-mail de teste falhou:", (r as any).error); continue; }
          await supabase.from("carreira_emails_enviados").insert({ user_id: a.user_id, tipo_email: tipo, categoria: "critico" });
          enviados++;
        } catch (e) { console.error("e-mail de teste:", e); }
      }
      return enviados;
    };

    const results = { avisos_2dias: 0, avisos_expirado: 0, emails_2dias: 0, emails_expirado: 0 };

    // 1. Testes que terminam em até 2 dias, sem forma de pagamento definida, ainda não avisados
    const { data: expirandoEm2Dias } = await supabase
      .from("carreira_assinaturas")
      .select("id, user_id, crianca_id")
      .eq("status", "trial")
      .is("metodo_pagamento", null)
      .is("lembrete_trial_2d_em", null)
      .lte("expira_em", in2Days.toISOString())
      .gt("expira_em", now.toISOString());

    if (expirandoEm2Dias && expirandoEm2Dias.length > 0) {
      const userIds = [...new Set(expirandoEm2Dias.map((a: any) => a.user_id))];
      await sendPush(userIds, "⏰ Seu teste termina em 2 dias", "Assine para continuar com o Elite sem interrupção.", "trial-2dias");
      results.emails_2dias = await sendEmails(expirandoEm2Dias, "trial_2dias");
      await supabase.from("carreira_assinaturas").update({ lembrete_trial_2d_em: now.toISOString() } as any).in("id", expirandoEm2Dias.map((a: any) => a.id));
      results.avisos_2dias = userIds.length;
    }

    // 2. Testes que acabaram nos últimos 3 dias, sem forma de pagamento definida, ainda não avisados
    const { data: expirados } = await supabase
      .from("carreira_assinaturas")
      .select("id, user_id, crianca_id")
      .eq("status", "trial")
      .is("metodo_pagamento", null)
      .is("lembrete_trial_expirado_em", null)
      .lte("expira_em", now.toISOString())
      .gte("expira_em", ha3Dias.toISOString());

    if (expirados && expirados.length > 0) {
      const userIds = [...new Set(expirados.map((a: any) => a.user_id))];
      await sendPush(userIds, "Seu teste do Elite acabou", "O perfil continua no ar no plano Base. Assine para voltar ao Elite.", "trial-expirado");
      results.emails_expirado = await sendEmails(expirados, "trial_expirado");
      await supabase.from("carreira_assinaturas").update({ lembrete_trial_expirado_em: now.toISOString() } as any).in("id", expirados.map((a: any) => a.id));
      results.avisos_expirado = userIds.length;
    }

    console.log(`[carreira-trial-reminder] ${JSON.stringify(results)}`);
    return json({ success: true, ...results });
  } catch (error) {
    console.error("carreira-trial-reminder error:", error);
    return json({ error: "Erro interno" }, 500);
  }
});
