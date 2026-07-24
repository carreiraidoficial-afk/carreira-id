import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CarreiraPlano, PLANOS, PlanoLimites, temAcessoAoPlano, normalizePlano } from '@/config/carreiraPlanos';

export interface CarreiraPlanoResult {
  plano: CarreiraPlano;
  limites: PlanoLimites;
  isLoading: boolean;
  /** Check if current plan includes a feature */
  temAcesso: (feature: keyof PlanoLimites) => boolean;
  /** Check if current plan meets the required plan level */
  temPlano: (requerido: CarreiraPlano) => boolean;
}

/** Fetch dynamic plan limits from carreira_planos_config table */
function useDynamicPlanLimits() {
  return useQuery({
    queryKey: ['carreira-planos-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carreira_planos_config')
        .select('plano, nome, preco, cor, icone, descricao, jornada_mes, carreira_mes, posts_dia, video_seg, video_max_mb, youtube, selo_elite, ver_views, prioridade_busca, destaque_listagem, stats_avancadas, liga_conexoes, curriculo_pdf');
      if (error) throw error;
      const map: Record<string, PlanoLimites> = {};
      (data || []).forEach((row: any) => {
        map[row.plano] = {
          jornada_mes: row.jornada_mes,
          carreira_mes: row.carreira_mes,
          posts_dia: row.posts_dia,
          video_seg: row.video_seg,
          video_max_mb: row.video_max_mb ?? 0,
          youtube: row.youtube,
          selo_elite: row.selo_elite,
          ver_views: row.ver_views,
          prioridade_busca: row.prioridade_busca,
          destaque_listagem: row.destaque_listagem,
          stats_avancadas: row.stats_avancadas,
          liga_conexoes: row.liga_conexoes,
          curriculo_pdf: row.curriculo_pdf,
        };
      });
      return map;
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useCarreiraPlano(criancaId: string | null): CarreiraPlanoResult {
  const { user } = useAuth();
  const { data: dynamicLimits } = useDynamicPlanLimits();

  const { data: plano, isLoading } = useQuery({
    queryKey: ['carreira-plano', user?.id, criancaId],
    queryFn: async (): Promise<CarreiraPlano> => {
      let userId = user?.id;
      if (!userId) {
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData.session?.user?.id;
      }

      if (!userId || !criancaId) return 'base';

      // Check for whitelist (legacy access = premium equivalent)
      const { data: whitelist } = await supabase
        .from('atividades_externas_whitelist')
        .select('id')
        .or(`user_id.eq.${userId}`)
        .eq('ativo', true)
        .limit(1);

      if (whitelist && whitelist.length > 0) return 'premium';

      // Check active subscription OR active trial
      const { data: assinatura } = await supabase
        .from('carreira_assinaturas')
        .select('plano, status, expira_em')
        .eq('user_id', userId)
        .eq('crianca_id', criancaId)
        .in('status', ['ativa', 'trial'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (assinatura && assinatura.length > 0) {
        const sub = assinatura[0] as any;
        // Trial: valid while expira_em is in the future
        if (sub.status === 'trial') {
          if (sub.expira_em && new Date(sub.expira_em) > new Date()) {
            return 'premium';
          }
          return 'base';
        }
        // Paid subscription: valid while expira_em is in the future
        if (!sub.expira_em || new Date(sub.expira_em) > new Date()) {
          return normalizePlano(sub.plano);
        }
      }

      return 'base';
    },
    enabled: !!criancaId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const planoAtual = plano || 'base';
  // Use dynamic limits from DB if available, fallback to static config
  const limites = dynamicLimits?.[planoAtual] || PLANOS[planoAtual].limites;

  return {
    plano: planoAtual,
    limites,
    isLoading,
    temAcesso: (feature: keyof PlanoLimites) => {
      const val = limites[feature];
      return typeof val === 'boolean' ? val : (val as number) > 0;
    },
    temPlano: (requerido: CarreiraPlano) => temAcessoAoPlano(planoAtual, requerido),
  };
}

/** Hook to check daily posts count for the current user */
export function usePostsDiaCount(autorId: string | undefined) {
  return useQuery({
    queryKey: ['posts-dia-count', autorId],
    queryFn: async () => {
      if (!autorId) return 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error } = await supabase
        .from('posts_atleta')
        .select('*', { count: 'exact', head: true })
        .eq('autor_id', autorId)
        .gte('created_at', today.toISOString());
      
      if (error) return 0;
      return count || 0;
    },
    enabled: !!autorId,
    staleTime: 30_000,
  });
}
