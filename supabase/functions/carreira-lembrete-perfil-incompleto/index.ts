import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Envia até 1 lembrete por pessoa por execução (a próxima etapa da
// sequência 1 -> 2 -> 3 que ainda não foi mandada e já passou do prazo em
// dias). Roda diariamente via pg_cron -- ver migration
// 20260924130000_create_carreira_lembretes_perfil.sql.
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const functionsUrl = `${supabaseUrl}/functions/v1`;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: templates, error: templatesError } = await supabase
      .from("carreira_lembretes_perfil_templates")
      .select("*")
      .eq("ativo", true)
      .order("numero_lembrete", { ascending: true });
    if (templatesError) throw templatesError;
    if (!templates?.length) {
      return new Response(JSON.stringify({ success: true, enviados: 0, motivo: "nenhum template ativo" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, nome, email, created_at, excluir_lembretes");
    if (profilesError) throw profilesError;

    const [{ data: atletas }, { data: redes }, { data: colaboradores }, { data: jaEnviados }, { data: catalogo }] = await Promise.all([
      supabase.from("perfil_atleta").select("user_id"),
      supabase.from("perfis_rede").select("user_id"),
      supabase.from("perfil_atleta_colaboradores").select("user_id").eq("status", "ativo"),
      supabase.from("carreira_lembretes_perfil_enviados").select("user_id, numero_lembrete"),
      supabase.from("carreira_email_catalogo").select("tipo_email, cooldown_dias").like("tipo_email", "lembrete_perfil_%"),
    ]);

    // Cooldown: não manda lembrete se a pessoa recebeu QUALQUER email
    // lifecycle (boas-vindas, outro lembrete, etc) há menos dias do que o
    // cooldown configurado no catálogo pra esse número de lembrete.
    const cooldownPorTipo = new Map<string, number>(
      (catalogo || []).map((c: any) => [c.tipo_email, c.cooldown_dias])
    );
    const { data: ultimosEnvios } = await supabase
      .from("carreira_emails_enviados")
      .select("user_id, enviado_em")
      .order("enviado_em", { ascending: false });
    const ultimoEnvioPorUser = new Map<string, string>();
    for (const e of ultimosEnvios || []) {
      if (!ultimoEnvioPorUser.has(e.user_id)) ultimoEnvioPorUser.set(e.user_id, e.enviado_em);
    }

    const comPerfil = new Set([
      ...(atletas || []).map((a: any) => a.user_id),
      ...(redes || []).map((r: any) => r.user_id),
      ...(colaboradores || []).map((c: any) => c.user_id),
    ]);
    const enviadosPorUser = new Map<string, Set<number>>();
    for (const e of jaEnviados || []) {
      if (!enviadosPorUser.has(e.user_id)) enviadosPorUser.set(e.user_id, new Set());
      enviadosPorUser.get(e.user_id)!.add(e.numero_lembrete);
    }

    const perfilIncompleto = (profiles || []).filter((p: any) =>
      !comPerfil.has(p.user_id) && !p.email?.toLowerCase().endsWith("@example.com") && !p.excluir_lembretes
    );

    let enviados = 0;
    const erros: string[] = [];

    for (const pessoa of perfilIncompleto) {
      if (!pessoa.email || !pessoa.nome) continue;
      const diasDesdeCadastro = Math.floor(
        (Date.now() - new Date(pessoa.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const jaEnviado = enviadosPorUser.get(pessoa.user_id) || new Set();

      // Manda só a próxima etapa da sequência ainda não enviada e já vencida.
      const proximoTemplate = templates.find(
        (t: any) => diasDesdeCadastro >= t.dias_apos_cadastro && !jaEnviado.has(t.numero_lembrete)
      );
      if (!proximoTemplate) continue;

      const tipoEmail = `lembrete_perfil_${proximoTemplate.numero_lembrete}`;
      const cooldownDias = cooldownPorTipo.get(tipoEmail) ?? 3;
      const ultimoEnvio = ultimoEnvioPorUser.get(pessoa.user_id);
      if (ultimoEnvio) {
        const diasDesdeUltimoEnvio = (Date.now() - new Date(ultimoEnvio).getTime()) / (1000 * 60 * 60 * 24);
        if (diasDesdeUltimoEnvio < cooldownDias) continue; // ainda dentro do cooldown, tenta de novo amanhã
      }

      try {
        const resp = await fetch(`${functionsUrl}/send-perfil-incompleto-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            nome: pessoa.nome,
            email: pessoa.email,
            assunto: proximoTemplate.assunto,
            titulo: proximoTemplate.titulo,
            corpo: proximoTemplate.corpo,
            ctaTexto: proximoTemplate.cta_texto,
            userId: pessoa.user_id,
            tipoEmail,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || data?.success === false) {
          erros.push(`${pessoa.email}: ${data?.error || resp.status}`);
          continue;
        }
        await supabase.from("carreira_lembretes_perfil_enviados").insert({
          user_id: pessoa.user_id,
          numero_lembrete: proximoTemplate.numero_lembrete,
          resend_email_id: data?.id ?? null,
        });
        enviados++;
      } catch (e: any) {
        erros.push(`${pessoa.email}: ${e.message}`);
      }
    }

    console.log(`[carreira-lembrete-perfil-incompleto] enviados=${enviados} erros=${erros.length}`);
    return new Response(JSON.stringify({ success: true, enviados, erros }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[carreira-lembrete-perfil-incompleto] erro:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
