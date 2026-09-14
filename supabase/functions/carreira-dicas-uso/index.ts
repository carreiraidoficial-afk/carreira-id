import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Dica {
  key: string;
  diaMinimo: number;
  title: string;
  body: string;
  url: string;
  /** Se true, só manda pra quem o perfil ainda está incompleto. */
  soIncompleto?: boolean;
}

// Sequência de dicas de uso/engajamento pro responsável, uma vez por
// atleta cadastrado. "diaMinimo" = dias desde a criação do perfil do
// atleta (perfil_atleta.created_at). Foco em uso e crescimento da rede
// (convites) -- sem menção a Premium, de propósito.
const DICAS: Dica[] = [
  {
    key: "perfil-incompleto",
    diaMinimo: 2,
    title: "📸 Falta pouco pro perfil ficar completo",
    body: "Um perfil completo (foto, posição, cidade) passa muito mais credibilidade pra quem visita.",
    url: "/",
    soIncompleto: true,
  },
  {
    key: "jornada-esportiva",
    diaMinimo: 4,
    title: "🏆 Registre cada jogo e campeonato",
    body: "Cada jogo registrado vira histórico automático — gols, estatísticas e evolução, tudo documentado sozinho.",
    url: "/",
  },
  {
    key: "convidar-atleta",
    diaMinimo: 6,
    title: "⚽ Chama um amigo atleta pro app",
    body: "Conhece outro atleta de base? Convide — vocês acompanham a evolução um do outro.",
    url: "/",
  },
  {
    key: "convidar-torcedor",
    diaMinimo: 9,
    title: "📣 Sabia que dá pra convidar a torcida?",
    body: "Família, amigos, professor — qualquer um pode acompanhar e torcer pelo atleta no perfil.",
    url: "/",
  },
  {
    key: "conexoes",
    diaMinimo: 12,
    title: "👀 Alguém já está de olho",
    body: "Veja em Conexões quem visitou o perfil e quem entrou na torcida até agora.",
    url: "/conexoes",
  },
  {
    key: "suporte-whatsapp",
    diaMinimo: 14,
    title: "💬 Dúvidas de como usar?",
    body: "Chama a gente no WhatsApp — respondemos rapidinho qualquer dúvida sobre o app.",
    url: "/contato",
  },
  {
    key: "fotos-videos",
    diaMinimo: 17,
    title: "🎥 Publique fotos dos seus momentos",
    body: "Poste as fotos dos jogos e treinos no feed do atleta — registra e ainda mostra pra quem acompanha.",
    url: "/",
  },
  {
    key: "professores-tecnicos",
    diaMinimo: 20,
    title: "🧑‍🏫 Conecte-se com professores e técnicos",
    body: "Professores e técnicos também têm perfil no Carreira ID — encontre e se conecte com quem já acompanha o atleta de perto.",
    url: "/descobrir",
  },
  {
    key: "feed",
    diaMinimo: 23,
    title: "📰 Acompanhe o feed do Carreira ID",
    body: "Veja as publicações de outros atletas e novidades da plataforma direto no Feed.",
    url: "/feed",
  },
  {
    key: "ultimo-jogo",
    diaMinimo: 26,
    title: "🔥 Não deixa o último jogo de fora",
    body: "Já registrou o jogo mais recente? Manter tudo atualizado é o que faz o perfil crescer.",
    url: "/",
  },
  {
    key: "convidar-mais",
    diaMinimo: 29,
    title: "🤝 Quanto mais gente, melhor",
    body: "Chama mais um amigo atleta ou torcedor — cada convite ajuda a fortalecer a rede.",
    url: "/",
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const now = new Date();

    const sendPush = async (userIds: string[], title: string, body: string, url: string, tag: string) => {
      if (userIds.length === 0) return;
      await fetch(`${SUPABASE_URL}/functions/v1/send-carreira-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ user_ids: userIds, title, body, url, tag }),
      });
    };

    // Todos os perfis de atleta (um responsável pode ter mais de um).
    const { data: perfis, error: perfisError } = await supabase
      .from("perfil_atleta")
      .select("user_id, foto_url, cidade, estado, posicao_principal, created_at")
      .not("crianca_id", "is", null);
    if (perfisError) throw perfisError;

    // Perfil mais antigo por usuário (define a "idade" da conta pra fins de
    // dica) e se PELO MENOS UM perfil do usuário está incompleto.
    const porUsuario = new Map<string, { createdAt: Date; incompleto: boolean }>();
    for (const p of perfis || []) {
      const createdAt = new Date((p as any).created_at);
      const incompleto = !(p as any).foto_url || !(p as any).cidade || !(p as any).estado || !(p as any).posicao_principal;
      const atual = porUsuario.get((p as any).user_id);
      if (!atual || createdAt < atual.createdAt) {
        porUsuario.set((p as any).user_id, { createdAt, incompleto: atual ? (atual.incompleto || incompleto) : incompleto });
      } else if (incompleto) {
        atual.incompleto = true;
      }
    }

    const todosUserIds = [...porUsuario.keys()];
    const { data: jaEnviadas } = await supabase
      .from("carreira_dicas_enviadas")
      .select("user_id, dica_key")
      .in("user_id", todosUserIds.length > 0 ? todosUserIds : ["00000000-0000-0000-0000-000000000000"]);
    const enviadasPorUsuario = new Map<string, Set<string>>();
    for (const row of jaEnviadas || []) {
      const set = enviadasPorUsuario.get((row as any).user_id) || new Set<string>();
      set.add((row as any).dica_key);
      enviadasPorUsuario.set((row as any).user_id, set);
    }

    // Pra cada usuário, acha só a PRÓXIMA dica pendente na sequência (nunca
    // mais de uma por dia, mesmo que várias já estejam "liberadas" por
    // idade -- evita empilhar avisos em contas antigas no primeiro run).
    const porDica = new Map<string, string[]>();
    for (const [userId, info] of porUsuario.entries()) {
      const diasDesdeCadastro = (now.getTime() - info.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      const jaSet = enviadasPorUsuario.get(userId) || new Set<string>();
      const proxima = DICAS.find((d) => {
        if (jaSet.has(d.key)) return false;
        if (diasDesdeCadastro < d.diaMinimo) return false;
        if (d.soIncompleto && !info.incompleto) return false;
        return true;
      });
      if (proxima) {
        const lista = porDica.get(proxima.key) || [];
        lista.push(userId);
        porDica.set(proxima.key, lista);
      }
    }

    const resultados: Record<string, number> = {};
    for (const dica of DICAS) {
      const userIds = porDica.get(dica.key) || [];
      if (userIds.length === 0) {
        resultados[dica.key] = 0;
        continue;
      }

      // ?dica=<key> na URL -- o app le esse param ao abrir (useTrackDicaClick)
      // e marca clicado_em, pra saber quem realmente abriu a partir do push.
      const urlComTracking = `${dica.url}${dica.url.includes("?") ? "&" : "?"}dica=${dica.key}`;
      await sendPush(userIds, dica.title, dica.body, urlComTracking, `dica-${dica.key}`);

      await supabase
        .from("carreira_dicas_enviadas")
        .insert(userIds.map((user_id) => ({ user_id, dica_key: dica.key })));

      resultados[dica.key] = userIds.length;
    }

    console.log("[carreira-dicas-uso]", JSON.stringify(resultados));

    return new Response(JSON.stringify({ success: true, ...resultados }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("carreira-dicas-uso error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
