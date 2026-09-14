import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Marca uma dica de uso como clicada quando o usuário abre o app a partir
 * da notificação push (?dica=<key> na URL) -- é assim que sabemos quem
 * realmente abriu, não só quem recebeu.
 */
export function useTrackDicaClick() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dicaKey = params.get('dica');
    if (!dicaKey) return;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      await (supabase as any)
        .from('carreira_dicas_enviadas')
        .update({ clicado_em: new Date().toISOString() })
        .eq('user_id', session.user.id)
        .eq('dica_key', dicaKey)
        .is('clicado_em', null);
    })();

    // Remove o param da URL sem recarregar a página, pra não tentar marcar
    // de novo num F5 nem deixar o link sujo se a pessoa compartilhar.
    params.delete('dica');
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);
  }, []);
}
