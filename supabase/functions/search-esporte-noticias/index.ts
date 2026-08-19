import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "carreiraidoficial@gmail.com";

// Fontes com feed RSS real, focadas em futebol de base. Adicionar uma nova
// fonte é só colocar a URL do feed aqui.
const FEED_URLS = [
  "https://portalbrazuca.com.br/feed/",
];

const TEMA_KEYWORDS: Record<string, string[]> = {
  regional: [
    "paulista", "carioca", "mineiro", "mineira", "gaucho", "catarinense",
    "paranaense", "baiano", "cearense", "pernambucano", "goiano", "capixaba",
    "sulista", "nordestino", "estadual", "regional", "potiguar", "alagoano",
    "sergipano", "maranhense", "paraense", "amazonense",
  ],
  nacional: [
    "brasileiro", "brasileirao", "copa do brasil", "selecao brasileira",
    "cbf", "nacional", "copa do nordeste",
  ],
  escolinha: [
    "escolinha", "escola de futebol", "peneira", "formacao", "iniciacao",
    "categoria de base", "categorias de base",
  ],
};

const ACCENT_MARKS_REGEX = new RegExp(String.fromCharCode(92) + "u0300-" + String.fromCharCode(92) + "u036f", "");

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(new RegExp(`[${ACCENT_MARKS_REGEX.source}]`, "g"), "");
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return "";
  let val = m[1].trim();
  const cdata = val.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cdata) val = cdata[1];
  return val.trim();
}

function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let m;
  while ((m = re.exec(xml))) {
    let val = m[1].trim();
    const cdata = val.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
    if (cdata) val = cdata[1];
    out.push(val.trim());
  }
  return out;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

interface FeedItem {
  titulo: string;
  link: string;
  pubDate: string;
  categorias: string[];
  descricao: string;
  fonte: string;
}

async function fetchFeedItems(url: string): Promise<FeedItem[]> {
  const fonte = new URL(url).hostname.replace(/^www\./, "");
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CarreiraIDBot/1.0)" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    return blocks.map((block) => ({
      titulo: extractTag(block, "title"),
      link: extractTag(block, "link"),
      pubDate: extractTag(block, "pubDate"),
      categorias: extractAll(block, "category"),
      descricao: stripHtml(extractTag(block, "description")),
      fonte,
    }));
  } catch (e) {
    console.error(`Erro lendo feed ${url}:`, e);
    return [];
  }
}

function itemCombinedText(item: FeedItem): string {
  return normalizar(`${item.titulo} ${item.categorias.join(" ")} ${item.descricao}`);
}

function matchesTema(item: FeedItem, tema: string): boolean {
  const keywords = TEMA_KEYWORDS[tema];
  if (!keywords) return true;
  const texto = itemCombinedText(item);
  return keywords.some((k) => texto.includes(normalizar(k)));
}

function matchesFiltro(item: FeedItem, filtro: string): boolean {
  if (!filtro.trim()) return true;
  const texto = itemCombinedText(item);
  // Cada palavra do filtro precisa aparecer em algum lugar do item.
  const termos = normalizar(filtro).split(/\s+/).filter(Boolean);
  return termos.every((t) => texto.includes(t));
}

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
    const filtro: string = (body?.filtro || "").toString().slice(0, 100);

    // 1. Junta os itens de todos os feeds configurados.
    const todosItens = (await Promise.all(FEED_URLS.map(fetchFeedItems))).flat();
    if (todosItens.length === 0) {
      return new Response(JSON.stringify({ error: "Não consegui acessar nenhuma fonte de notícias agora. Tente de novo em instantes." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Evita repetir uma notícia que já foi publicada no feed do app.
    const { data: postsRecentes } = await adminClient
      .from("posts_atleta")
      .select("texto")
      .order("created_at", { ascending: false })
      .limit(100);
    const textosPostados = (postsRecentes || []).map((p: any) => p.texto || "");
    const jaPostado = (link: string) => textosPostados.some((t) => t.includes(link));

    // 3. Tenta tema + filtro; se não achar e havia filtro, tenta só o filtro.
    let candidato = todosItens.find((it) => matchesTema(it, tema) && matchesFiltro(it, filtro) && !jaPostado(it.link));
    if (!candidato && filtro.trim()) {
      candidato = todosItens.find((it) => matchesFiltro(it, filtro) && !jaPostado(it.link));
    }
    if (!candidato) {
      return new Response(JSON.stringify({ error: "Nenhuma notícia recente encontrada nas fontes pra esse tema/filtro. Tente outro filtro ou tema." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Reescreve em tom curto e próprio, com a IA vendo o conteúdo real (não buscando sozinha).
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    let resumo = candidato.descricao.slice(0, 240);
    if (openaiKey) {
      const prompt = `Reescreva a notícia abaixo em 2 a 3 frases curtas, com suas próprias palavras (NÃO copie frases literais), tom de pai/mãe contando uma novidade pra outros pais no feed do Carreira ID. Responda só com o texto do resumo, sem aspas, sem título.

Título original: ${candidato.titulo}
Conteúdo: ${candidato.descricao.slice(0, 1500)}`;

      try {
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5,
            max_tokens: 200,
          }),
        });
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const aiText = aiData.choices?.[0]?.message?.content?.trim();
          if (aiText) resumo = aiText;
        } else {
          console.error("OpenAI rewrite error:", await aiResponse.text());
        }
      } catch (e) {
        console.error("OpenAI rewrite exception:", e);
      }
    }

    return new Response(JSON.stringify({
      titulo: candidato.titulo,
      resumo,
      fonte_nome: "Portal Brazuca",
      fonte_url: candidato.link,
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
