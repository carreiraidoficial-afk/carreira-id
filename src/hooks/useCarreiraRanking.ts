import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LigaRankingEntry {
  position: number;
  user_id: string;
  nome: string;
  foto_url: string | null;
  slug: string | null;
  pontos: number;
  nivel: number | null;
}

export function useCarreiraRanking(limit = 100) {
  return useQuery({
    queryKey: ['liga-ranking', limit],
    queryFn: async (): Promise<LigaRankingEntry[]> => {
      const { data: gamData } = await supabase
        .from('user_gamificacao')
        .select('user_id, pontos_total, nivel')
        .order('pontos_total', { ascending: false })
        .limit(limit);

      if (!gamData || gamData.length === 0) return [];

      const userIds = gamData.map((g) => g.user_id);

      const { data: atletaProfiles } = await supabase
        .from('perfil_atleta')
        .select('user_id, nome, foto_url, slug, modalidade, crianca_id')
        .in('user_id', userIds);

      // Exclude institutional/platform profiles (e.g. "Carreira ID")
      const atletaMap = new Map(
        (atletaProfiles || [])
          .filter((p) => p.modalidade !== 'Plataforma')
          .map((perfil) => [perfil.user_id, perfil])
      );

      // Liga de Conexões can be disabled per plan — exclude athletes whose plan lacks it
      const { data: planosConfig } = await supabase
        .from('carreira_planos_config')
        .select('plano, liga_conexoes');
      const ligaAtivaPorPlano = new Map((planosConfig || []).map((p) => [p.plano, p.liga_conexoes]));

      const criancaIds = Array.from(atletaMap.values()).map((p) => p.crianca_id).filter(Boolean) as string[];
      let premiumCriancaIds = new Set<string>();
      if (criancaIds.length > 0) {
        const { data: premiumRows } = await supabase
          .rpc('get_premium_crianca_ids', { p_crianca_ids: criancaIds });
        premiumCriancaIds = new Set((premiumRows || []).map((r) => r.crianca_id));
      }

      const atletasOnly = gamData.filter((g) => {
        const perfil = atletaMap.get(g.user_id);
        if (!perfil) return false;
        const isPremium = !!(perfil.crianca_id && premiumCriancaIds.has(perfil.crianca_id));
        const ligaAtiva = ligaAtivaPorPlano.get(isPremium ? 'premium' : 'base') ?? true;
        return ligaAtiva;
      });

      return atletasOnly.map((g, idx) => {
        const atleta = atletaMap.get(g.user_id)!;
        return {
          position: idx + 1,
          user_id: g.user_id,
          nome: atleta.nome || 'Atleta',
          foto_url: atleta.foto_url || null,
          slug: atleta.slug || null,
          pontos: g.pontos_total,
          nivel: g.nivel,
        };
      });
    },
  });
}
