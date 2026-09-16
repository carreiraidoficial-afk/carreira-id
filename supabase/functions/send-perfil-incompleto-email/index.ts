import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PerfilIncompletoEmailRequest {
  nome: string;
  email: string;
  profileUrl?: string;
  percentualCompleto?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }
    const resend = new Resend(resendApiKey);

    const {
      nome,
      email,
      profileUrl = "https://carreiraid.com.br/cadastro",
      percentualCompleto = 50,
    }: PerfilIncompletoEmailRequest = await req.json();

    if (!nome || !email) {
      return new Response(
        JSON.stringify({ success: false, error: "nome e email são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const primeiroNome = nome.trim().split(" ")[0];
    const pct = Math.max(0, Math.min(100, Math.round(percentualCompleto)));

    console.log(`Enviando email de perfil incompleto para ${email} (${pct}%)`);

    const emailResponse = await resend.emails.send({
      from: "Carreira ID <contato@carreiraid.com.br>",
      to: [email],
      subject: "Falta pouco pro seu perfil ficar completo ⚽",
      html: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Perfil Incompleto</title>
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
    Falta pouco — complete seu perfil e apareça pra quem importa no esporte de base.
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
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td valign="middle" style="padding-right:10px;">
                          <table role="presentation" width="30" height="30" cellpadding="0" cellspacing="0" style="width:30px;height:30px;background:#f97316;">
                            <tr><td align="center" valign="middle" style="font-size:15px;font-weight:800;color:#0b1220;line-height:30px;">iD</td></tr>
                          </table>
                        </td>
                        <td valign="middle">
                          <span style="font-size:18px;font-weight:800;color:#f1f5f9;letter-spacing:0.2px;">CARREIRA<span style="color:#f97316;">ID</span></span>
                        </td>
                      </tr>
                    </table>
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
                Falta pouco pro seu<br>perfil ficar completo
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#94a3b8;max-width:440px;">
                Você já deu o primeiro passo e criou seu perfil de atleta — mas o cadastro ainda não foi concluído.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1a2e;border:1px solid #24324a;">
                <tr>
                  <td align="center" style="padding:36px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:64px;font-weight:800;color:#f1f5f9;letter-spacing:-2px;">
                          ${pct}<span style="color:#f97316;">%</span>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" width="220" cellpadding="0" cellspacing="0" style="margin-top:14px;">
                      <tr>
                        <td style="height:6px;background:#24324a;">
                          <table role="presentation" width="${pct}%" height="6" cellpadding="0" cellspacing="0"><tr><td style="background:#f97316;height:6px;"></td></tr></table>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:14px 0 0 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">do perfil preenchido</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="stack-pad" style="padding:32px 40px 4px 40px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#f1f5f9;">
                <strong>Ao concluir seu cadastro, você poderá:</strong>
              </p>
            </td>
          </tr>

          <tr>
            <td class="stack-pad" style="padding:12px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="44" valign="top" style="padding:18px 0;border-top:1px solid #24324a;">
                    <table role="presentation" width="30" height="30" cellpadding="0" cellspacing="0" style="width:30px;height:30px;background:#1c2c47;">
                      <tr><td align="center" valign="middle" style="font-size:14px;color:#f97316;font-weight:700;">01</td></tr>
                    </table>
                  </td>
                  <td valign="top" style="padding:18px 0 18px 14px;border-top:1px solid #24324a;">
                    <p style="margin:0 0 3px 0;font-size:15px;font-weight:700;color:#f1f5f9;">Registrar sua jornada esportiva</p>
                    <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;">Campeonatos, jogos, gols e estatísticas — documentados automaticamente.</p>
                  </td>
                </tr>
                <tr>
                  <td width="44" valign="top" style="padding:18px 0;border-top:1px solid #24324a;">
                    <table role="presentation" width="30" height="30" cellpadding="0" cellspacing="0" style="width:30px;height:30px;background:#1c2c47;">
                      <tr><td align="center" valign="middle" style="font-size:14px;color:#f97316;font-weight:700;">02</td></tr>
                    </table>
                  </td>
                  <td valign="top" style="padding:18px 0 18px 14px;border-top:1px solid #24324a;">
                    <p style="margin:0 0 3px 0;font-size:15px;font-weight:700;color:#f1f5f9;">Publicar fotos e vídeos</p>
                    <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;">Mostre lances e momentos direto no feed do seu perfil.</p>
                  </td>
                </tr>
                <tr>
                  <td width="44" valign="top" style="padding:18px 0;border-top:1px solid #24324a;">
                    <table role="presentation" width="30" height="30" cellpadding="0" cellspacing="0" style="width:30px;height:30px;background:#1c2c47;">
                      <tr><td align="center" valign="middle" style="font-size:14px;color:#f97316;font-weight:700;">03</td></tr>
                    </table>
                  </td>
                  <td valign="top" style="padding:18px 0 18px 14px;border-top:1px solid #24324a;">
                    <p style="margin:0 0 3px 0;font-size:15px;font-weight:700;color:#f1f5f9;">Se conectar com quem importa</p>
                    <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;">Professores, técnicos, torcedores e outros atletas de base.</p>
                  </td>
                </tr>
                <tr>
                  <td width="44" valign="top" style="padding:18px 0 18px 0;border-top:1px solid #24324a;border-bottom:1px solid #24324a;">
                    <table role="presentation" width="30" height="30" cellpadding="0" cellspacing="0" style="width:30px;height:30px;background:#1c2c47;">
                      <tr><td align="center" valign="middle" style="font-size:14px;color:#f97316;font-weight:700;">04</td></tr>
                    </table>
                  </td>
                  <td valign="top" style="padding:18px 0 18px 14px;border-top:1px solid #24324a;border-bottom:1px solid #24324a;">
                    <p style="margin:0 0 3px 0;font-size:15px;font-weight:700;color:#f1f5f9;">Compartilhar seu perfil</p>
                    <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;">Um link só, pronto pra mostrar seu potencial pra qualquer clube.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="stack-pad" style="padding:28px 40px 0 40px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#f1f5f9;">
                Quanto mais completo o perfil, maiores as chances de <strong style="color:#f97316;">alguém enxergar seu potencial</strong>.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:32px 40px 12px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background:#f97316;">
                    <a href="${profileUrl}" style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:700;color:#0b1220;">
                      Completar meu perfil →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0 0;font-size:12px;color:#64748b;">Leva menos de 3 minutos.</p>
            </td>
          </tr>

          <tr>
            <td class="stack-pad" style="padding:20px 40px 40px 40px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#94a3b8;">
                Estamos na torcida pela sua jornada.<br>
                <strong style="color:#f1f5f9;">Equipe Carreira ID</strong>
              </p>
            </td>
          </tr>

          <tr>
            <td class="stack-pad" style="padding:24px 40px;background:#0f1a2e;border-top:1px solid #24324a;">
              <p style="margin:0 0 8px 0;font-size:12px;line-height:1.6;color:#64748b;">
                Dúvidas? Fale com a gente no <a href="https://wa.me/5521969622045" style="color:#22c55e;font-weight:600;">WhatsApp</a>.
              </p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#475569;">
                Você recebeu este e-mail porque criou um perfil no Carreira ID.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    console.log("Resposta do Resend:", emailResponse);

    if (emailResponse.error) {
      console.error("Erro retornado pelo Resend:", emailResponse.error);
      return new Response(
        JSON.stringify({ success: false, error: emailResponse.error.message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email de perfil incompleto enviado com sucesso para:", email);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Erro ao enviar email de perfil incompleto:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
