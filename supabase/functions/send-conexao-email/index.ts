import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

// E-mail de segurança para avisos de conexão (pedido e aceite). Só o servidor chama (gatilho do banco, via segredo interno).
// Regra: só envia para quem NÃO está recebendo push (sem aparelho cadastrado, ou que desligou o push), e no máximo
// 1 e-mail do mesmo tipo a cada 30 minutos por pessoa. Quem já recebe push não recebe e-mail duplicado.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const internalSecret = Deno.env.get('PUSH_INTERNAL_SECRET') || '';
    const authHeader = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const okSecret = internalSecret && req.headers.get('x-internal-secret') === internalSecret;
    if (!okSecret && authHeader !== serviceKey) return json({ error: 'unauthorized' }, 401);

    const { user_id, tipo, nome } = await req.json();
    if (!user_id || !['conexao_solicitada', 'conexao_aceita'].includes(tipo)) return json({ error: 'bad request' }, 400);

    const supabase = createClient(url, serviceKey);

    // Já recebe push? Então não manda e-mail.
    const { data: prof } = await supabase.from('profiles').select('push_optout, nome').eq('user_id', user_id).maybeSingle();
    const { count: aparelhos } = await supabase.from('carreira_push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user_id);
    if (!(prof?.push_optout) && (aparelhos || 0) > 0) return json({ sent: false, reason: 'recebe push' });

    // Limite: 1 e-mail do mesmo tipo a cada 30 minutos
    const desde = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { count: recentes } = await supabase.from('carreira_emails_enviados').select('id', { count: 'exact', head: true })
      .eq('user_id', user_id).eq('tipo_email', tipo).gte('enviado_em', desde);
    if ((recentes || 0) > 0) return json({ sent: false, reason: 'cooldown' });

    const { data: u } = await supabase.auth.admin.getUserById(user_id);
    const email = u?.user?.email;
    if (!email) return json({ sent: false, reason: 'sem e-mail' });

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return json({ error: 'RESEND_API_KEY não configurada' }, 500);

    const quem = esc(String(nome || 'Alguém').slice(0, 80));
    const primeiroNome = esc(String(prof?.nome || '').trim().split(' ')[0] || 'tudo bem');
    const solicitada = tipo === 'conexao_solicitada';
    const assunto = solicitada
      ? `${String(nome || 'Alguém').slice(0, 60)} quer se conectar com você no Carreira ID`
      : `${String(nome || 'Alguém').slice(0, 60)} aceitou sua conexão no Carreira ID`;
    const titulo = solicitada ? `${quem} quer se conectar com você` : `${quem} aceitou sua conexão`;
    const texto = solicitada
      ? 'Abra o Carreira ID para aceitar ou recusar o pedido. Conectar-se ajuda a mostrar a trajetória do atleta para quem importa no esporte de base.'
      : 'Vocês agora estão conectados no Carreira ID. Abra o app para ver o perfil e continuar construindo a rede.';
    const cta = solicitada ? 'Ver o pedido' : 'Ver a conexão';
    const link = 'https://carreiraid.com.br/conexoes';

    // Mesmo molde dos e-mails de lembrete (send-perfil-incompleto-email): fundo escuro, logo original, botão laranja.
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo}</title>
<style>
  table{border-collapse:collapse;}
  img{border:0;display:block;}
  a{text-decoration:none;}
  @media (max-width:520px){
    .container{width:100% !important;}
    .stack-pad{padding-left:24px !important;padding-right:24px !important;}
    .hero-headline{font-size:26px !important;line-height:1.25 !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#0b1220;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${titulo} — abra o Carreira ID para ver.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#131f35;border:1px solid #24324a;">

          <tr>
            <td class="stack-pad" style="padding:28px 40px;border-bottom:1px solid #24324a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" valign="middle">
                    <img src="https://carreiraid.com.br/logo-carreira-id-email.png" width="170" height="42" alt="Carreira ID" style="display:block;">
                  </td>
                  <td align="right" valign="middle">
                    <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1.2px;">Esporte de Base</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="stack-pad" style="padding:44px 40px 8px 40px;">
              <p style="margin:0 0 10px 0;font-size:13px;font-weight:700;color:#22c55e;text-transform:uppercase;letter-spacing:1.5px;">
                Olá, ${primeiroNome}!
              </p>
              <h1 class="hero-headline" style="margin:0 0 14px 0;font-size:32px;line-height:1.2;font-weight:800;color:#f1f5f9;letter-spacing:-0.3px;">
                ${titulo}
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#94a3b8;max-width:480px;">
                ${texto}
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:32px 40px 8px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background:#f97316;">
                    <a href="${link}" style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:700;color:#0b1220;">
                      ${cta} →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0 0;font-size:12px;color:#64748b;">Quer ser avisado na hora, direto no celular? Ative as notificações no app (basta um toque).</p>
            </td>
          </tr>

          <tr>
            <td class="stack-pad" style="padding:28px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:1px;background:#24324a;font-size:0;line-height:0;">&nbsp;</td></tr></table>
            </td>
          </tr>

          <tr>
            <td class="stack-pad" style="padding:20px 40px;background:#0f1a2e;border-top:1px solid #24324a;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#475569;">
                Você recebeu este e-mail porque tem uma conta no Carreira ID.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resend = new Resend(resendKey);
    const r = await resend.emails.send({ from: 'Carreira ID <contato@carreiraid.com.br>', to: [email], subject: assunto, html });
    if ((r as any)?.error) return json({ sent: false, error: String((r as any).error?.message || (r as any).error).slice(0, 200) }, 502);

    await supabase.from('carreira_emails_enviados').insert({ user_id, tipo_email: tipo, categoria: 'critico' });
    return json({ sent: true });
  } catch (err: any) {
    console.error('send-conexao-email', err);
    return json({ error: String(err?.message || err).slice(0, 200) }, 500);
  }
});
