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

function renderHtml(opts: { title: string; description: string; image: string; canonical: string; internalRoute: string; type?: string; wideImage?: boolean }) {
  const { title, description, image, canonical, internalRoute, type = "profile", wideImage = false } = opts;
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
<meta property="og:image:secure_url" content="${escapeHtml(image)}" />${wideImage ? `
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />` : ""}

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

  // Links de cadastro com convite (/cadastro?convite=CÓDIGO, ?escola=slug ou ?a=slug): sem isto o preview cai no card
  // genérico do site e ninguém sabe de quem é o convite. Só usa dados que já são públicos (escola, perfil público).
  if (slug === "cadastro") {
    const params = new URLSearchParams(url.searchParams);
    params.delete("slug");
    const canonicalCad = `${APP_BASE}/cadastro${params.toString() ? `?${params.toString()}` : ""}`;
    const noindex = { "X-Robots-Tag": "noindex" };
    const resposta = (title: string, description: string, image: string, wide = false) =>
      new Response(
        renderHtml({ title, description, image, canonical: canonicalCad, internalRoute: canonicalCad, type: "website", wideImage: wide }),
        { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300", ...noindex } },
      );
    const convite = url.searchParams.get("convite") || url.searchParams.get("c");
    const escolaSlug = url.searchParams.get("escola");
    const atletaSlug = url.searchParams.get("a");
    const ref = url.searchParams.get("ref");

    // 1) Convite de uma escola (pelo código do convite ou pelo slug da escola)
    let convidante: { nome: string; foto_url: string | null; banner_url: string | null; tipo: string; dados_perfil: unknown } | null = null;
    if (convite) {
      const { data } = await supabase.from("perfis_rede").select("nome, foto_url, banner_url, tipo, dados_perfil").eq("convite_codigo", convite).limit(1).maybeSingle();
      convidante = data;
    } else if (escolaSlug) {
      const { data } = await supabase.from("perfis_rede").select("nome, foto_url, banner_url, tipo, dados_perfil").eq("slug", escolaSlug).eq("tipo", "dono_escola").limit(1).maybeSingle();
      convidante = data;
    }
    if (convidante) {
      if (convidante.tipo === "dono_escola") {
        const dados = (convidante.dados_perfil || {}) as Record<string, unknown>;
        const cartao = typeof dados.og_image_url === "string" ? dados.og_image_url : null;
        if (ref === "equipe") {
          return resposta(
            `${convidante.nome} convida você para a equipe`,
            `Crie seu perfil de professor(a) no Carreira ID para entrar na equipe técnica da ${convidante.nome}. Toque para se cadastrar.`,
            cartao || convidante.banner_url || convidante.foto_url || GENERIC_IMAGE,
            !!cartao,
          );
        }
        return resposta(
          `${convidante.nome} convida você para o Carreira ID`,
          `A ${convidante.nome} está no Carreira ID. Crie o perfil do atleta e registre a jornada esportiva: jogos, campeonatos e conquistas. Toque para se cadastrar.`,
          cartao || convidante.banner_url || convidante.foto_url || GENERIC_IMAGE,
          !!cartao,
        );
      }
      return resposta(
        `${convidante.nome} convidou você para o Carreira ID`,
        `Crie seu perfil no Carreira ID e acompanhe a trajetória esportiva de atletas de base. Toque para se cadastrar.`,
        convidante.foto_url || GENERIC_IMAGE,
      );
    }

    // 2) Convite de um atleta (torcida ou colega), só se o perfil dele for público
    if (atletaSlug) {
      const { data: amigo } = await supabase.from("perfil_atleta").select("nome, foto_url, is_public").eq("slug", atletaSlug).maybeSingle();
      if (amigo && amigo.is_public !== false) {
        const primeiro = (amigo.nome || "").split(" ")[0] || "Um atleta";
        const colega = ref === "atleta";
        return resposta(
          `${primeiro} convidou você para ${colega ? "o Carreira ID" : "a torcida"}`,
          colega
            ? `${amigo.nome} convidou você para o Carreira ID, a plataforma da trajetória esportiva do atleta de base. Toque para se cadastrar e se conectar.`
            : `${amigo.nome} quer você na torcida. Cadastre-se no Carreira ID e acompanhe a jornada esportiva dele(a). Toque para entrar.`,
          amigo.foto_url || GENERIC_IMAGE,
        );
      }
    }

    // 3) Cadastro sem convite identificável: card de cadastro, mais claro que o genérico
    return resposta(
      "Cadastre-se no Carreira ID",
      "A plataforma da trajetória esportiva do atleta de base: jogos, campeonatos, conquistas e evolução num perfil só. Cadastro rápido.",
      GENERIC_IMAGE,
    );
  }

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
    .select("nome, foto_url, banner_url, bio, tipo, user_id, cidade, estado, dados_perfil")
    .eq("slug", slug)
    .or("status_conta.is.null,status_conta.neq.inativo") // perfil oculto pelo admin não gera prévia
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
    let description = rede.bio || `Perfil de ${rede.nome} na rede CARREIRA ID.`;
    let image = rede.foto_url || GENERIC_IMAGE;
    let wide = false;
    if (rede.tipo === "dono_escola") {
      const dados = (rede.dados_perfil || {}) as Record<string, unknown>;
      const modalidades = Array.isArray(dados.modalidades) ? (dados.modalidades as string[]).join(", ") : "";
      const local = [rede.cidade, rede.estado].filter(Boolean).join("/");
      const cabecalho = ["Escola de esportes", modalidades, local].filter(Boolean).join(" · ");
      description = rede.bio ? `${cabecalho}. ${rede.bio}` : cabecalho;
      // Cartão 1200x630 em JPG (og_image_url) > capa da escola > logo. WhatsApp lida mal com webp e imagem quadrada.
      const cartao = typeof dados.og_image_url === "string" ? dados.og_image_url : null;
      image = cartao || rede.banner_url || rede.foto_url || GENERIC_IMAGE;
      wide = !!cartao;
    }
    return new Response(
      renderHtml({ title, description, image, canonical: internalRoute, internalRoute, wideImage: wide }),
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
