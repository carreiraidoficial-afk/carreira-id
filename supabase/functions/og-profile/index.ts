import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_BASE = "https://carreiraid.com.br";

// Mesma lista usada em share-post, para tratar preview de link de forma consistente em todo o app.
const CRAWLER_UA_RE = /(facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|pinterest|googlebot|bingbot|applebot|yandex|baiduspider|duckduckbot|embedly|skypeuripreview|redditbot|tumblr|vkshare|quora|outbrain|w3c_validator|opengraph)/i;

const GENERIC_TITLE = "CARREIRA ID - Identidade Esportiva Digital para Atletas de Base";
const GENERIC_DESC = "Organize e valorize a trajetória esportiva do atleta desde a base. Perfil público, histórico de clubes, campeonatos e conquistas documentadas.";
const GENERIC_IMAGE = `${APP_BASE}/carreira-og-image.png`;

function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(opts: { title: string; description: string; image: string; canonical: string; internalRoute: string; type?: string }) {
  const { title, description, image, canonical, internalRoute, type = "profile" } = opts;
  return `<!DOCTYPE html>
<html lang="pt-BR" prefix="og: https://ogp.me/ns#">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${canonical}" />

<meta property="og:type" content="${type}" />
<meta property="og:site_name" content="Carreira ID" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:secure_url" content="${escapeHtml(image)}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<p><a href="${internalRoute}">Abrir no Carreira ID</a></p>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || url.pathname.split("/").filter(Boolean).pop();

  if (!slug) {
    return new Response("slug required", { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") || "";
  const isCrawler = CRAWLER_UA_RE.test(userAgent);
  const internalRoute = `${APP_BASE}/${slug}`;

  // Humanos (e Googlebot, que renderiza JS) -> a SPA já resolve isso sozinha via useSEO.
  // Esta function existe só para os bots de preview de link que não executam JS.
  if (!isCrawler) {
    return Response.redirect(internalRoute, 302);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Convite de colaborador (/colaborar?codigo=XXX) -- não é slug de perfil,
  // mas precisa de card próprio, senão cai no genérico e ninguém entende
  // que é um convite antes de clicar.
  if (slug === "colaborar") {
    const codigo = url.searchParams.get("codigo");
    const canonicalColab = codigo ? `${APP_BASE}/colaborar?codigo=${codigo}` : `${APP_BASE}/colaborar`;

    if (codigo) {
      const { data: convite } = await supabase
        .from("perfil_atleta_colaboradores")
        .select("crianca_id, nome")
        .eq("codigo_convite", codigo)
        .eq("status", "pendente")
        .limit(1)
        .maybeSingle();

      if (convite) {
        const { data: atleta } = await supabase
          .from("perfil_atleta")
          .select("nome, foto_url")
          .eq("crianca_id", convite.crianca_id)
          .maybeSingle();

        const title = "Convite de Colaboração - CARREIRA ID";
        const description = atleta
          ? `Você foi convidado(a) a ajudar a registrar a jornada esportiva de ${atleta.nome} no Carreira ID. Toque para aceitar.`
          : "Você foi convidado(a) a colaborar num perfil de atleta no Carreira ID. Toque para aceitar.";
        const image = atleta?.foto_url || GENERIC_IMAGE;

        return new Response(
          renderHtml({ title, description, image, canonical: canonicalColab, internalRoute: canonicalColab }),
          { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" } },
        );
      }
    }

    // Código ausente, inválido ou já usado -> card genérico de convite, ainda
    // assim mais claro que o card padrão do site.
    return new Response(
      renderHtml({
        title: "Convite de Colaboração - CARREIRA ID",
        description: "Você foi convidado(a) a colaborar num perfil de atleta no Carreira ID. Toque para aceitar.",
        image: GENERIC_IMAGE,
        canonical: canonicalColab,
        internalRoute: canonicalColab,
      }),
      { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" } },
    );
  }

  // Mesma prioridade usada em useProfileBySlug no app: perfil_atleta primeiro.
  const { data: atleta } = await supabase
    .from("perfil_atleta")
    .select("nome, foto_url, modalidade, cidade, estado, bio, is_public")
    .eq("slug", slug)
    .maybeSingle();

  if (atleta) {
    if (atleta.is_public === false) {
      return new Response(renderHtml({ title: GENERIC_TITLE, description: GENERIC_DESC, image: GENERIC_IMAGE, canonical: internalRoute, internalRoute }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
      });
    }
    const title = `${atleta.nome}${atleta.modalidade ? ` - ${atleta.modalidade}` : ""} | CARREIRA ID`;
    const local = [atleta.cidade, atleta.estado].filter(Boolean).join("/");
    const description = [atleta.modalidade, local, atleta.bio].filter(Boolean).join(" — ") || `Perfil esportivo de ${atleta.nome} no CARREIRA ID.`;
    const image = atleta.foto_url || GENERIC_IMAGE;
    return new Response(
      renderHtml({ title, description, image, canonical: internalRoute, internalRoute }),
      { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300" } },
    );
  }

  // Fallback: perfis_rede (professor, técnico, torcedor, etc. e o legado pai_responsavel)
  const { data: rede } = await supabase
    .from("perfis_rede")
    .select("nome, foto_url, bio, tipo, user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (rede) {
    // pai_responsavel legado: se a conta já migrou pra um perfil_atleta próprio, prefere ele
    // (mesma lógica de useProfileBySlug no app, evita mostrar o card desatualizado).
    if (rede.tipo === "pai_responsavel" && rede.user_id) {
      const { data: atletaDoUser } = await supabase
        .from("perfil_atleta")
        .select("nome, foto_url, modalidade, cidade, estado, bio, slug, is_public")
        .eq("user_id", rede.user_id)
        .maybeSingle();
      if (atletaDoUser?.slug && atletaDoUser.is_public !== false) {
        const title = `${atletaDoUser.nome}${atletaDoUser.modalidade ? ` - ${atletaDoUser.modalidade}` : ""} | CARREIRA ID`;
        const local = [atletaDoUser.cidade, atletaDoUser.estado].filter(Boolean).join("/");
        const description = [atletaDoUser.modalidade, local, atletaDoUser.bio].filter(Boolean).join(" — ") || `Perfil esportivo de ${atletaDoUser.nome} no CARREIRA ID.`;
        const canonical = `${APP_BASE}/${atletaDoUser.slug}`;
        return new Response(
          renderHtml({ title, description, image: atletaDoUser.foto_url || GENERIC_IMAGE, canonical, internalRoute: canonical }),
          { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300" } },
        );
      }
    }
    const title = `${rede.nome} | CARREIRA ID`;
    const description = rede.bio || `Perfil de ${rede.nome} na rede CARREIRA ID.`;
    return new Response(
      renderHtml({ title, description, image: rede.foto_url || GENERIC_IMAGE, canonical: internalRoute, internalRoute }),
      { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300" } },
    );
  }

  // Não é um slug de perfil (ex: /explorar, /cadastro, /feed) -> cai pro card genérico
  // do site, idêntico ao que o index.html já mostra hoje. Sem regressão pra rotas do app.
  return new Response(
    renderHtml({ title: GENERIC_TITLE, description: GENERIC_DESC, image: GENERIC_IMAGE, canonical: internalRoute, internalRoute, type: "website" }),
    { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
});
