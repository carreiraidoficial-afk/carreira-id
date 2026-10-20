import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Decode HTML entities like &#xe7; &quot; &#x2013; etc.
function decodeHtmlEntities(str: string): string {
  if (!str) return str;
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}


const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Endereços que nunca devem ser acessados a pedido de um usuário (rede interna, nuvem, loopback...).
function ipv4Privado(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
}
function ipv6Privado(ip: string): boolean {
  const x = ip.toLowerCase();
  if (x === "::" || x === "::1") return true;
  const mapeado = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeado) return ipv4Privado(mapeado[1]);
  return x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe8") || x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb");
}
async function urlSegura(u: URL): Promise<boolean> {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "80" && u.port !== "443") return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && !host.includes(":")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return !ipv4Privado(host);
  if (host.includes(":")) return !ipv6Privado(host);
  try {
    const [v4, v6] = await Promise.all([
      Deno.resolveDns(host, "A").catch(() => [] as string[]),
      Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
    ]);
    if (v4.length + v6.length === 0) return false;
    return v4.every((i) => !ipv4Privado(i)) && v6.every((i) => !ipv6Privado(i));
  } catch {
    return false;
  }
}
// Só links http(s) vão para o cartão de prévia (nada de javascript:, data: etc.).
const urlWebOuNulo = (v: string | null): string | null => {
  if (!v) return null;
  try { const u = new URL(v); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null; } catch { return null; }
};
const MAX_BYTES = 512 * 1024;
async function lerTexto(resp: Response): Promise<string> {
  const reader = resp.body?.getReader();
  if (!reader) return "";
  const partes: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    partes.push(value); total += value.length;
  }
  try { await reader.cancel(); } catch { /* já terminou */ }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of partes) { buf.set(p, off); off += p.length; }
  return new TextDecoder().decode(buf);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Só usuário logado (quem publica ou o admin); visitantes não podem usar a função como proxy.
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: "unauthorized" }, 401);

    const { url: urlBruta } = await req.json();
    if (!urlBruta || typeof urlBruta !== "string" || urlBruta.length > 2000) return json({ error: "URL required" }, 400);

    let atual: URL;
    try { atual = new URL(urlBruta); } catch { return json({ error: "URL inválida" }, 400); }
    const url = atual.toString();

    // Segue até 3 redirecionamentos, conferindo cada destino (um redirecionamento não pode levar à rede interna).
    let response: Response | null = null;
    for (let i = 0; i <= 3; i++) {
      if (!(await urlSegura(atual))) return json({ error: "Link não permitido" }, 400);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      response = await fetch(atual, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
      });
      clearTimeout(timeout);
      const destino = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && destino) {
        try { atual = new URL(destino, atual); } catch { return json({ error: "Redirecionamento inválido" }, 400); }
        response = null;
        continue;
      }
      break;
    }
    if (!response) return json({ error: "Redirecionamentos demais" }, 400);
    const tipo = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(tipo)) return json({ error: "Conteúdo não suportado" }, 400);

    const html = await lerTexto(response);

    // Extract OG meta tags
    const getMetaContent = (property: string): string | null => {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
        new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return decodeHtmlEntities(match[1]);
      }
      return null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const rawImage = getMetaContent("og:image") || getMetaContent("twitter:image") || null;
    // Instagram CDN images often block direct embedding; keep only reliable ones
    const image = rawImage && !rawImage.includes("scontent") ? urlWebOuNulo(rawImage) : null;

    // Detect Instagram URLs and build a useful preview even when OG tags are sparse
    const isInstagram = /instagram\.com/i.test(url);
    const ogTitle = getMetaContent("og:title") || getMetaContent("twitter:title") || (titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1].trim()) : null);
    const ogDescription = getMetaContent("og:description") || getMetaContent("twitter:description") || getMetaContent("description") || null;

    const preview = {
      url,
      title: ogTitle ? ogTitle.slice(0, 300) : (isInstagram ? "Publicação no Instagram" : null),
      description: ogDescription || (isInstagram ? "Veja esta publicação no Instagram" : null),
      image,
      site_name: getMetaContent("og:site_name") || (isInstagram ? "Instagram" : new URL(url).hostname.replace("www.", "").toUpperCase()),
      type: isInstagram ? "instagram" : null,
    };

    return new Response(JSON.stringify(preview), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
