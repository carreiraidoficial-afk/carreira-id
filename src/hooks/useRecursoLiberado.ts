import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * O atleta tem acesso antecipado a este recurso em teste? (lista `carreira_recursos_liberados`, gerida pelo admin.)
 * Só consulta quando há atleta e quando `ativo` é verdadeiro (ex.: só para quem gerencia o perfil).
 */
export function useRecursoLiberado(recurso: string, criancaId: string | null | undefined, ativo = true): boolean {
  const { data } = useQuery({
    queryKey: ['recurso-liberado', recurso, criancaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('carreira_recursos_liberados')
        .select('crianca_id')
        .eq('recurso', recurso)
        .eq('crianca_id', criancaId!)
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    enabled: ativo && !!criancaId,
    staleTime: 5 * 60 * 1000,
  });
  return data === true;
}
