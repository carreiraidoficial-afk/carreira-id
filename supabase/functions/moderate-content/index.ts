import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, user_id, content_type = 'post' } = await req.json();

    if (!content || !user_id) {
      return new Response(JSON.stringify({ error: 'content and user_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Só usuário logado: a análise usa a chave da OpenAI e não pode ficar aberta a visitantes.
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user: autor } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!autor) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== LEVEL 1: Word filter =====
    const { data: blockedWords } = await supabase
      .from('blocked_words')
      .select('word, category');

    if (blockedWords && blockedWords.length > 0) {
      const contentLower = content.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      for (const bw of blockedWords) {
        const wordNorm = bw.word.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        // Word boundary check
        const regex = new RegExp(`\\b${wordNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(contentLower)) {
          // Log and block
          const { data: logData } = await supabase.from('moderation_logs').insert({
            user_id,
            content,
            content_type,
            reason: `Palavra bloqueada: "${bw.word}" (${bw.category})`,
            level: 'filtro',
            status: 'bloqueado',
          }).select('id').single();

          return new Response(JSON.stringify({
            aprovado: false,
            motivo: `Conteúdo contém linguagem inadequada.`,
            level: 'filtro',
            log_id: logData?.id || null,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // ===== LEVEL 2: AI moderation =====
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      // If no OpenAI key, pass with just word filter
      return new Response(JSON.stringify({ aprovado: true, motivo: '', level: 'filtro' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Você é um moderador de conteúdo de uma rede social esportiva voltada para atletas e jovens. Analise o texto abaixo e responda APENAS com JSON no formato: {"aprovado": true/false, "motivo": "..."}.

REGRAS DE APROVAÇÃO:
- Links de plataformas conhecidas como YouTube, Vimeo, Instagram, Twitter/X, TikTok, Kwai, Facebook e sites de notícias esportivas são SEMPRE permitidos, mesmo que o conteúdo contenha apenas um link.
- Conteúdo sobre futebol, esportes, treinos, jogos, campeonatos, escolinhas e carreira esportiva é SEMPRE permitido.
- Emojis e gírias comuns do esporte são permitidos.

REGRAS DE REPROVAÇÃO (só reprove se claramente violar):
- Linguagem sexual explícita ou implícita
- Discurso de ódio, racismo, homofobia
- Xingamentos graves e ofensas pessoais
- Spam repetitivo ou golpes financeiros
- Links para sites maliciosos, phishing ou conteúdo adulto
- Conteúdo inadequado para menores de 18 anos
- Conteúdo completamente fora do contexto esportivo E que seja prejudicial

NA DÚVIDA, APROVE. É melhor permitir conteúdo legítimo do que bloquear usuários indevidamente.

Texto para analisar:`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
    });

    if (!aiResponse.ok) {
      console.error('OpenAI error:', await aiResponse.text());
      // On AI failure, allow (don't block users due to API issues)
      return new Response(JSON.stringify({ aprovado: true, motivo: '', level: 'filtro' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const aiText = aiData.choices?.[0]?.message?.content?.trim() || '';

    let result = { aprovado: true, motivo: '' };
    try {
      // Extract JSON from response
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error('Failed to parse AI response:', aiText);
    }

    let logId = null;
    if (!result.aprovado) {
      const { data: logData } = await supabase.from('moderation_logs').insert({
        user_id,
        content,
        content_type,
        reason: result.motivo || 'Reprovado pela IA',
        level: 'ia',
        status: 'bloqueado',
      }).select('id').single();
      logId = logData?.id || null;
    }

    return new Response(JSON.stringify({
      aprovado: result.aprovado,
      motivo: result.motivo || '',
      level: 'ia',
      log_id: logId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Moderation error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
