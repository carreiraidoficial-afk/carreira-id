import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "carreiraidoficial@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verifica admin: email fixo OU role admin em user_roles
    let isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
    if (!isAdmin) {
      const { data: roles } = await adminClient
        .from("user_roles").select("role").eq("user_id", user.id);
      isAdmin = !!(roles || []).find((r: any) => r.role === "admin");
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso restrito ao admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId: string | undefined = body?.user_id;
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (targetUserId === user.id) {
      return new Response(JSON.stringify({ error: "Use excluir minha conta para deletar a si mesmo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[admin-delete-user] admin=${user.id} deletando target=${targetUserId}`);

    // ===== Backup =====
    const { data: perfilAtleta } = await adminClient.from("perfil_atleta").select("*").eq("user_id", targetUserId);
    const { data: perfisRede } = await adminClient.from("perfis_rede").select("*").eq("user_id", targetUserId);

    const atletaIds = (perfilAtleta || []).map((p: any) => p.id);
    const redeIds = (perfisRede || []).map((p: any) => p.id);

    const allPosts: any[] = [];
    for (const aid of atletaIds) {
      const { data: posts } = await adminClient.from("posts_atleta").select("*").eq("autor_id", aid);
      if (posts) allPosts.push(...posts);
    }
    for (const rid of redeIds) {
      const { data: posts } = await adminClient.from("posts_atleta").select("*").eq("perfil_rede_id", rid);
      if (posts) allPosts.push(...posts);
    }

    const { data: experiencias } = await adminClient.from("carreira_experiencias").select("*").eq("user_id", targetUserId);
    const { data: conexoes } = await adminClient.from("rede_conexoes").select("*")
      .or(`solicitante_id.eq.${targetUserId},destinatario_id.eq.${targetUserId}`);
    const { data: profile } = await adminClient.from("profiles").select("nome, email").eq("user_id", targetUserId).maybeSingle();

    await adminClient.from("conta_deletada_backup").insert({
      user_id: targetUserId,
      email: profile?.email || null,
      nome: profile?.nome || perfilAtleta?.[0]?.nome || perfisRede?.[0]?.nome || "Desconhecido",
      tipo_perfil: perfisRede?.[0]?.tipo || (perfilAtleta?.length ? "atleta" : "desconhecido"),
      dados_perfil_atleta: perfilAtleta && perfilAtleta.length ? perfilAtleta : null,
      dados_perfis_rede: perfisRede && perfisRede.length ? perfisRede : null,
      dados_posts: allPosts.length ? allPosts : null,
      dados_experiencias: experiencias && experiencias.length ? experiencias : null,
      dados_conexoes: conexoes && conexoes.length ? conexoes : null,
      motivo: "admin_excluiu",
    });

    // ===== Cascata de deletes =====
    if (perfilAtleta && perfilAtleta.length) {
      for (const p of perfilAtleta) {
        await adminClient.from("posts_atleta").delete().eq("autor_id", p.id);
        await adminClient.from("perfil_visualizacoes").delete().eq("perfil_atleta_id", p.id);
        await adminClient.from("atleta_follows").delete().eq("following_perfil_id", p.id);
      }
    }
    if (perfisRede && perfisRede.length) {
      for (const p of perfisRede) {
        await adminClient.from("posts_atleta").delete().eq("perfil_rede_id", p.id);
      }
    }

    await adminClient.from("post_likes").delete().eq("user_id", targetUserId);
    await adminClient.from("post_comentarios").delete().eq("user_id", targetUserId);
    await adminClient.from("rede_conexoes").delete().or(`solicitante_id.eq.${targetUserId},destinatario_id.eq.${targetUserId}`);
    await adminClient.from("atleta_follows").delete().eq("follower_id", targetUserId);
    await adminClient.from("perfil_visualizacoes").delete().eq("viewer_user_id", targetUserId);
    await adminClient.from("rede_convites").delete().eq("convidado_user_id", targetUserId);

    await adminClient.from("pontos_historico").delete().eq("user_id", targetUserId);
    await adminClient.from("user_gamificacao").delete().eq("user_id", targetUserId);
    await adminClient.from("user_badges").delete().eq("user_id", targetUserId);
    await adminClient.from("desafio_progresso").delete().eq("user_id", targetUserId);

    await adminClient.from("carreira_assinaturas").delete().eq("user_id", targetUserId);
    await adminClient.from("carreira_experiencias").delete().eq("user_id", targetUserId);
    await adminClient.from("carreira_push_subscriptions").delete().eq("user_id", targetUserId);
    await adminClient.from("carreira_tutorial_leituras").delete().eq("user_id", targetUserId);
    await adminClient.from("carreira_comunicados_leituras").delete().eq("user_id", targetUserId);

    await adminClient.from("perfil_atleta").delete().eq("user_id", targetUserId);
    await adminClient.from("perfis_rede").delete().eq("user_id", targetUserId);

    await adminClient.from("user_roles").delete().eq("user_id", targetUserId);
    await adminClient.from("profiles").delete().eq("user_id", targetUserId);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      console.error("[admin-delete-user] deleteUser error:", deleteError);
      return new Response(JSON.stringify({ error: "Erro ao apagar usuário: " + deleteError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[admin-delete-user] target=${targetUserId} deletado.`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("admin-delete-user error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});