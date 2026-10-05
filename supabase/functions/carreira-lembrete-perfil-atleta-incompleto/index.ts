import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pra quem JÁ tem perfil de atleta criado, mas não preencheu Experiência
// (clube/escolinha) nem Jornada Esportiva (nenhum jogo cadastrado).
// Experiência sempre tem prioridade sobre Jornada -- só considera o
// lembrete de Jornada se a Experiência já estiver preenchida. Cada tipo é
// enviado no máximo 1 vez por pessoa (não é uma sequência numerada como o
// lembrete de cadastro). Roda diariamente via pg_cron.
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const functionsUrl = `${supabaseUrl}/functions/v1`;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: templates, error: templatesError } = await supabase
      .from("carreira_lembretes_perfil_atleta_templates")
      .select("*")
      .eq("ativo", true);
    if (templatesError) throw templatesError;
    if (!templates?.length) {
      return new Response(JSON.stringify({ success: true, enviados: 0, motivo: "nenhum template ativo" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const templatePorTipo = new Map(templates.map((t: any) => [t.tipo, t]));

    const [{ data: perfis, error: perfisError }, { data: experiencias }, { data: jogos }, { data: catalogo }] = await Promise.all([
      supabase.from("perfil_atleta").select("id, user_id, crianca_id, nome, created_at").eq("is_teste", false),
      supabase.from("carreira_experiencias").select("crianca_id"),
      supabase.from("carreira_jogos").select("crianca_id"),
      supabase.from("carreira_email_catalogo").select("tipo_email, cooldown_dias").in("tipo_email", ["perfil_sem_experiencia", "perfil_sem_jornada"]),
    ]);
    if (perfisError) throw perfisError;

    const criancasComExperiencia = new Set((experiencias || []).map((e: any) => e.crianca_id));
    const criancasComJogo = new Set((jogos || []).map((j: any) => j.crianca_id));
    const cooldownPorTipo = new Map<string, number>((catalogo || []).map((c: any) => [c.tipo_email, c.cooldown_dias]));

    const userIds = [...new Set((perfis || []).map((p: any) => p.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, nome, email").in("user_id", userIds);
    const profilePorUser = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    const { data: jaEnviados } = await supabase
      .from("carreira_emails_enviados")
      .select("user_id, tipo_email, enviado_em")
      .in("tipo_email", ["perfil_sem_experiencia", "perfil_sem_jornada"]);
    const tiposJaEnviadosPorUser = new Map<string, Set<string>>();
    for (const e of jaEnviados || []) {
      if (!tiposJaEnviadosPorUser.has(e.user_id)) tiposJaEnviadosPorUser.set(e.user_id, new Set());
      tiposJaEnviadosPorUser.get(e.user_id)!.add(e.tipo_email);
    }

    const { data: ultimosEnvios } = await supabase
      .from("carreira_emails_enviados")
      .select("user_id, enviado_em")
      .order("enviado_em", { ascending: false });
    const ultimoEnvioPorUser = new Map<string, string>();
    for (const e of ultimosEnvios || []) {
      if (!ultimoEnvioPorUser.has(e.user_id)) ultimoEnvioPorUser.set(e.user_id, e.enviado_em);
    }

    let enviados = 0;
    const erros: string[] = [];

    for (const perfil of perfis || []) {
      const responsavel = profilePorUser.get(perfil.user_id);
      if (!responsavel?.email || !responsavel?.nome) continue;

      const temExperiencia = criancasComExperiencia.has(perfil.crianca_id);
      const temJornada = criancasComJogo.has(perfil.crianca_id);
      const tipoCandidato = !temExperiencia ? "sem_experiencia" : (!temJornada ? "sem_jornada" : null);
      if (!tipoCandidato) continue;

      const template = templatePorTipo.get(tipoCandidato);
      if (!template) continue;

      const diasDesdeCriacao = Math.floor(
        (Date.now() - new Date(perfil.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diasDesdeCriacao < template.dias_apos_criacao) continue;

      const jaEnviadosTipos = tiposJaEnviadosPorUser.get(perfil.user_id) || new Set();
      if (jaEnviadosTipos.has(tipoCandidato)) continue; // só manda cada tipo 1 vez

      const cooldownDias = cooldownPorTipo.get(tipoCandidato) ?? 7;
      const ultimoEnvio = ultimoEnvioPorUser.get(perfil.user_id);
      if (ultimoEnvio) {
        const diasDesdeUltimoEnvio = (Date.now() - new Date(ultimoEnvio).getTime()) / (1000 * 60 * 60 * 24);
        if (diasDesdeUltimoEnvio < cooldownDias) continue;
      }

      try {
        const resp = await fetch(`${functionsUrl}/send-perfil-incompleto-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            nome: responsavel.nome,
            email: responsavel.email,
            assunto: template.assunto,
            titulo: template.titulo,
            corpo: template.corpo,
            ctaTexto: template.cta_texto,
            userId: perfil.user_id,
            tipoEmail: tipoCandidato,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || data?.success === false) {
          erros.push(`${responsavel.email}: ${data?.error || resp.status}`);
          continue;
        }
        enviados++;
        // Reflete localmente pra não reenviar o mesmo tipo de novo nesta
        // mesma execução, caso haja mais de um perfil pro mesmo user_id.
        ultimoEnvioPorUser.set(perfil.user_id, new Date().toISOString());
        tiposJaEnviadosPorUser.set(perfil.user_id, new Set([...jaEnviadosTipos, tipoCandidato]));
      } catch (e: any) {
        erros.push(`${responsavel.email}: ${e.message}`);
      }
    }

    console.log(`[carreira-lembrete-perfil-atleta-incompleto] enviados=${enviados} erros=${erros.length}`);
    return new Response(JSON.stringify({ success: true, enviados, erros }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[carreira-lembrete-perfil-atleta-incompleto] erro:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
