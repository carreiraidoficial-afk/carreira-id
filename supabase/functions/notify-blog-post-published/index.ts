import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BlogPostPublishedRequest {
  title: string;
  url: string;
  image?: string;
  excerpt?: string;
}

// Repassa o artigo recém-publicado pro webhook do Make (Integromat), que
// cria o post na Página do Facebook. O endereço real do webhook fica só no
// secret MAKE_FACEBOOK_WEBHOOK_URL do Supabase -- nunca no código, porque
// este repositório é público.
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookUrl = Deno.env.get("MAKE_FACEBOOK_WEBHOOK_URL");
    const webhookApiKey = Deno.env.get("MAKE_FACEBOOK_WEBHOOK_APIKEY");
    if (!webhookUrl || !webhookApiKey) {
      console.warn("MAKE_FACEBOOK_WEBHOOK_URL/APIKEY não configuradas ainda -- ignorando notificação");
      return new Response(
        JSON.stringify({ success: false, error: "MAKE_FACEBOOK_WEBHOOK_URL ou MAKE_FACEBOOK_WEBHOOK_APIKEY não configurada" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { title, url, image, excerpt }: BlogPostPublishedRequest = await req.json();

    if (!title || !url) {
      return new Response(
        JSON.stringify({ success: false, error: "title e url são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Notificando Make sobre novo artigo: ${title} (${url})`);

    const makeResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", "x-make-apikey": webhookApiKey },
      body: JSON.stringify({ title, url, image: image ?? null, excerpt: excerpt ?? null }),
    });

    if (!makeResponse.ok) {
      const body = await makeResponse.text();
      console.error("Make retornou erro:", makeResponse.status, body);
      return new Response(
        JSON.stringify({ success: false, error: `Make retornou ${makeResponse.status}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Make notificado com sucesso");

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Erro ao notificar Make:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
