import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_EMAIL = 'carreiraidoficial@gmail.com';

/** A Liga só aparece para os atletas depois que o admin a publica (Admin → Gamificação). O admin sempre a vê,
 * pra poder testar. Os pontos continuam sendo acumulados mesmo com a Liga oculta. */
export function useLigaVisivel() {
  const { data: publicada, isLoading: carregandoConfig } = useQuery({
    queryKey: ['carreira-config', 'liga_visivel'],
    queryFn: async () => {
      const { data } = await supabase.from('carreira_config' as any).select('valor').eq('chave', 'liga_visivel').maybeSingle();
      return (data as any)?.valor === true;
    },
    // Quem abre o app logo depois do lançamento não pode ficar preso num "oculta" guardado no cache de 24h.
    staleTime: 60 * 1000,
    refetchOnMount: true,
  });

  const { data: ehAdmin, isLoading: carregandoAdmin } = useQuery({
    queryKey: ['liga-eh-admin'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.email === ADMIN_EMAIL;
    },
    staleTime: Infinity,
  });

  return {
    /** Pode mostrar a Liga a quem está olhando (publicada, ou é o admin). */
    liberada: publicada === true || ehAdmin === true,
    /** O que o admin definiu, sem contar o acesso dele. */
    publicada: publicada === true,
    carregando: carregandoConfig || carregandoAdmin,
  };
}
