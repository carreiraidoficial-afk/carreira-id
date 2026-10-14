import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const CHAVE = 'carreira_push_ctx_ate';
const ESPERA_MS = 24 * 60 * 60 * 1000;

/**
 * Único ouvinte do app. Quando alguém pede/aceita uma conexão, mostra "Quer ser avisado?" com botão Ativar
 * (o toque do botão é o gesto que o navegador exige para abrir o pedido de permissão). No máximo 1 vez por dia.
 */
export function PushContextPrompter() {
  const { needsPrompt, subscribe } = usePushNotifications();
  const precisa = useRef(false);
  const assinar = useRef(subscribe);
  precisa.current = needsPrompt;
  assinar.current = subscribe;

  useEffect(() => {
    const aoPedir = (e: Event) => {
      if (!precisa.current) return;
      try {
        if (Date.now() < Number(localStorage.getItem(CHAVE) || 0)) return;
        localStorage.setItem(CHAVE, String(Date.now() + ESPERA_MS));
      } catch { /* sem storage: mostra mesmo assim */ }
      const mensagem = (e as CustomEvent).detail?.mensagem || 'Quer ser avisado quando responderem?';
      toast(mensagem, {
        duration: 12000,
        action: {
          label: 'Ativar',
          onClick: async () => {
            const r = await assinar.current();
            if (r.ok) toast.success('Notificações ativadas!');
            else toast.error(r.reason || 'Não consegui ativar as notificações.');
          },
        },
      });
    };
    window.addEventListener('carreira:pedir-push', aoPedir);
    return () => window.removeEventListener('carreira:pedir-push', aoPedir);
  }, []);

  return null;
}
