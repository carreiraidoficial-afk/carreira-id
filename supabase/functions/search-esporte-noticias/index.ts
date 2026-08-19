import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "carreiraidoficial@gmail.com";

const TEMA_PROMPTS: Record<string, string> = {
  regional: "um campeonato regional ou estadual de futebol de base (categorias sub-9 a sub-20) no Brasil, com resultado ou fato recente e relevante",
  nacional: "um campeonato nacional de futebol de base no Brasil (ex: Copa do Brasil Sub-15, Sub-17, Sub-20, Brasileirão de base) com resultado ou fato recente e relevante",
  escolinha: "uma escolinha ou clube de formação de futebol de base no Brasil que teve alguma conquista, iniciativa ou destaque recente",
};

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
    const tema: string = body?.tema || "regional";
    const temaDescricao = TEMA_PROMPTS[tema] || TEMA_PROMPTS.regional;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "Busca não configurada (falta chave de API)" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Busque na web ${temaDescricao}. Priorize fontes brasileiras confiáveis (portais de notícia, sites de federações/confederações, sites oficiais de clubes/escolinhas) e fatos dos últimos 30 dias.

Depois de encontrar, responda APENAS com um JSON no formato exato abaixo, sem nenhum texto antes ou depois:
{"titulo": "título curto (máx 80 caracteres)", "resumo": "resumo em 2 a 3 frases, escrito com suas próprias palavras (NÃO copie frases literais da fonte), tom de pai/mãe contando uma novidade pra outros pais no feed do Carreira ID", "fonte_nome": "nome do veículo/site da fonte", "fonte_url": "URL exata da matéria original"}

Se não encontrar nada relevante e recente sobre o tema, responda apenas: {"erro": "nao_encontrado"}`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-search-preview",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI error:", errText);
      return new Response(JSON.stringify({ error: "Falha ao buscar notícias. Tente novamente." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiText: string = aiData.choices?.[0]?.message?.content?.trim() || "";

    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON in AI response:", aiText);
      return new Response(JSON.stringify({ error: "Não consegui interpretar o resultado da busca." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(JSON.stringify({ error: "Não consegui interpretar o resultado da busca." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (result.erro || !result.titulo || !result.fonte_url) {
      return new Response(JSON.stringify({ error: "Nenhuma notícia recente e relevante encontrada pra esse tema. Tente de novo em instantes ou escolha outro tema." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      titulo: result.titulo,
      resumo: result.resumo,
      fonte_nome: result.fonte_nome || "",
      fonte_url: result.fonte_url,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("search-esporte-noticias error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
