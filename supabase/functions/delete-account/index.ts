import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


const ASAAS_API_URL = "https://api.asaas.com/v3";

// Antes de apagar a conta, para a cobrança recorrente no Asaas. Sem isso, as assinaturas somem do nosso banco mas o cartão da pessoa
// continua sendo cobrado. Se o Asaas recusar (que não seja "já não existe"), a exclusão é interrompida para a pessoa tentar de novo.
async function cancelarCobrancasRecorrentes(adminClient: any, userId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { data: individuais } = await adminClient
    .from("carreira_assinaturas").select("gateway_subscription_id").eq("user_id", userId).not("gateway_subscription_id", "is", null);
  const { data: familias } = await adminClient
    .from("carreira_assinaturas_familia").select("gateway_subscription_id").eq("user_id", userId).not("gateway_subscription_id", "is", null);
  const ids = [...new Set([...(individuais || []), ...(familias || [])].map((x: any) => x.gateway_subscription_id).filter(Boolean))] as string[];
  if (ids.length === 0) return { ok: true };

  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) return { ok: false, erro: "Configuração de pagamento não encontrada." };
  for (const subId of ids) {
    try {
      const res = await fetch(`${ASAAS_API_URL}/subscriptions/${subId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", access_token: apiKey },
      });
      // 404 = já não existe mais no Asaas (cancelada por outro caminho): vale como cancelada.
      if (!res.ok && res.status !== 404) {
        console.error("[cancelarCobrancasRecorrentes] Asaas recusou:", res.status, await res.text().catch(() => ""));
        return { ok: false, erro: "Não foi possível cancelar a cobrança recorrente. Sua conta não foi apagada; tente novamente em instantes." };
      }
    } catch (e) {
      console.error("[cancelarCobrancasRecorrentes] erro de rede:", e);
      return { ok: false, erro: "Não foi possível falar com o sistema de pagamento. Sua conta não foi apagada; tente novamente em instantes." };
    }
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ====== STEP -1: PARA A COBRANÇA RECORRENTE (se falhar, nada é apagado) ======
    const cobranca = await cancelarCobrancasRecorrentes(adminClient, userId);
    if (!cobranca.ok) {
      return new Response(JSON.stringify({ error: cobranca.erro }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== STEP 0: BACKUP ALL DATA BEFORE DELETING ======
    console.log(`[delete-account] Backing up data for user ${userId}...`);

    // Fetch all data to backup
    const { data: perfilAtleta } = await adminClient
      .from("perfil_atleta")
      .select("*")
      .eq("user_id", userId);

    const { data: perfisRede } = await adminClient
      .from("perfis_rede")
      .select("*")
      .eq("user_id", userId);

    // Fetch posts
    const atletaIds = (perfilAtleta || []).map((p: any) => p.id);
    const redeIds = (perfisRede || []).map((p: any) => p.id);
    
    let allPosts: any[] = [];
    for (const aid of atletaIds) {
      const { data: posts } = await adminClient.from("posts_atleta").select("*").eq("autor_id", aid);
      if (posts) allPosts.push(...posts);
    }
    for (const rid of redeIds) {
      const { data: posts } = await adminClient.from("posts_atleta").select("*").eq("perfil_rede_id", rid);
      if (posts) allPosts.push(...posts);
    }

    // Fetch experiencias
    const { data: experiencias } = await adminClient
      .from("carreira_experiencias")
      .select("*")
      .eq("user_id", userId);

    // Fetch conexoes
    const { data: conexoes } = await adminClient
      .from("rede_conexoes")
      .select("*")
      .or(`solicitante_id.eq.${userId},destinatario_id.eq.${userId}`);

    // Fetch profile info for name
    const { data: profile } = await adminClient
      .from("profiles")
      .select("nome, email")
      .eq("user_id", userId)
      .maybeSingle();

    // Save backup
    const backupData = {
      user_id: userId,
      email: profile?.email || user.email,
      nome: profile?.nome || perfilAtleta?.[0]?.nome || perfisRede?.[0]?.nome || "Desconhecido",
      tipo_perfil: perfisRede?.[0]?.tipo || (perfilAtleta?.length ? "atleta" : "desconhecido"),
      dados_perfil_atleta: perfilAtleta && perfilAtleta.length > 0 ? perfilAtleta : null,
      dados_perfis_rede: perfisRede && perfisRede.length > 0 ? perfisRede : null,
      dados_posts: allPosts.length > 0 ? allPosts : null,
      dados_experiencias: experiencias && experiencias.length > 0 ? experiencias : null,
      dados_conexoes: conexoes && conexoes.length > 0 ? conexoes : null,
      motivo: "usuario_solicitou",
    };

    const { error: backupError } = await adminClient
      .from("conta_deletada_backup")
      .insert(backupData);

    if (backupError) {
      console.error("[delete-account] Backup failed:", backupError);
      // Don't block deletion, but log the error
    } else {
      console.log(`[delete-account] Backup saved for user ${userId}`);
    }

    // ====== STEP 1: DELETE DATA (same as before) ======
    
    // Delete posts by perfil_atleta
    if (perfilAtleta && perfilAtleta.length > 0) {
      for (const p of perfilAtleta) {
        await adminClient.from("posts_atleta").delete().eq("autor_id", p.id);
        await adminClient.from("perfil_visualizacoes").delete().eq("perfil_atleta_id", p.id);
        await adminClient.from("atleta_follows").delete().eq("following_perfil_id", p.id);
      }
    }

    // Delete posts by perfis_rede
    if (perfisRede && perfisRede.length > 0) {
      for (const p of perfisRede) {
        await adminClient.from("posts_atleta").delete().eq("perfil_rede_id", p.id);
      }
    }

    // Delete user interactions
    await adminClient.from("post_likes").delete().eq("user_id", userId);
    await adminClient.from("post_comentarios").delete().eq("user_id", userId);
    await adminClient.from("rede_conexoes").delete().or(`solicitante_id.eq.${userId},destinatario_id.eq.${userId}`);
    await adminClient.from("atleta_follows").delete().eq("follower_id", userId);
    await adminClient.from("perfil_visualizacoes").delete().eq("viewer_user_id", userId);
    await adminClient.from("rede_convites").delete().eq("convidado_user_id", userId);

    // Delete gamification data
    await adminClient.from("pontos_historico").delete().eq("user_id", userId);
    await adminClient.from("user_gamificacao").delete().eq("user_id", userId);
    await adminClient.from("user_badges").delete().eq("user_id", userId);
    await adminClient.from("desafio_progresso").delete().eq("user_id", userId);

    // Delete carreira data
    await adminClient.from("carreira_assinaturas").delete().eq("user_id", userId);
    await adminClient.from("carreira_assinaturas_familia").delete().eq("user_id", userId);
    await adminClient.from("carreira_experiencias").delete().eq("user_id", userId);

    // Delete push subscriptions
    await adminClient.from("carreira_push_subscriptions").delete().eq("user_id", userId);
    
    // Delete tutorial reads & comunicado reads
    await adminClient.from("carreira_tutorial_leituras").delete().eq("user_id", userId);
    await adminClient.from("carreira_comunicados_leituras").delete().eq("user_id", userId);

    // Delete profiles
    await adminClient.from("perfil_atleta").delete().eq("user_id", userId);
    await adminClient.from("perfis_rede").delete().eq("user_id", userId);

    // Delete user_roles and profiles
    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("user_id", userId);

    // Delete the auth user itself
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Erro ao apagar usuário: " + deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[delete-account] User ${userId} fully deleted with backup preserved for 30 days.`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-account error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
