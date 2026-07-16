import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Extend ServiceWorkerRegistration to include pushManager
declare global {
  interface ServiceWorkerRegistration {
    pushManager: PushManager;
  }
}

const VAPID_PUBLIC_KEY = 'BFqOi5upK5aAWMuern7_QcNbsQz1JioSFYDdVyuIkC0Iu5HsSKqMlHi8WJxBMgNI_tn0vVHGUPfDwI3CF0wQxh8';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Nunca deixa uma promise pendurar pra sempre (ex: SW que nunca dispara 'activated'). */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tempo esgotado: ${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export interface PushSubscribeResult {
  ok: boolean;
  /** Motivo legível, pra mostrar ao usuário quando ok=false. */
  reason?: string;
}

export function usePushNotifications() {
  const { session } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  const getExistingPushRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const existing = registrations.find(r => r.active?.scriptURL?.includes('push-sw.js'));
    return existing ?? null;
  };

  const getPushRegistration = async (): Promise<ServiceWorkerRegistration> => {
    // Register dedicated push SW with a unique scope only after explicit user action.
    const existing = await getExistingPushRegistration();
    if (existing) return existing;
    return navigator.serviceWorker.register('/push-sw.js', { scope: '/push-handler' });
  };

  const checkExistingSubscription = async () => {
    try {
      const reg = await getExistingPushRegistration();
      if (!reg) {
        setIsSubscribed(false);
        return;
      }
      const subscription = await reg.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSubscribed(false);
    }
  };

  const subscribe = useCallback(async (): Promise<PushSubscribeResult> => {
    if (!isSupported) return { ok: false, reason: 'Este navegador/dispositivo não suporta notificações push.' };
    if (!session?.user?.id) return { ok: false, reason: 'Sessão não encontrada. Recarregue a página e tente novamente.' };

    // Se já foi negado antes, o navegador nunca mais vai perguntar sozinho de novo —
    // só reaparece se a pessoa liberar manualmente nas configurações do site/app.
    if (Notification.permission === 'denied') {
      return {
        ok: false,
        reason: 'As notificações foram bloqueadas antes. Vá nas configurações do navegador/app (ícone de cadeado ou Configurações > Notificações do site) e permita manualmente, depois tente de novo aqui.',
      };
    }

    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        return { ok: false, reason: 'Permissão de notificação não foi concedida.' };
      }

      const registration = await withTimeout(getPushRegistration(), 8000, 'registrar o service worker');

      // Wait for SW to become active (com timeout — nunca trava pra sempre)
      if (!registration.active) {
        await withTimeout(
          new Promise<void>((resolve) => {
            const sw = registration.installing || registration.waiting;
            if (sw) {
              sw.addEventListener('statechange', () => {
                if (sw.state === 'activated') resolve();
              });
              // já pode ter ativado entre o registro e este listener
              if (sw.state === 'activated') resolve();
            } else {
              resolve();
            }
          }),
          8000,
          'ativar o service worker',
        ).catch(() => { /* segue mesmo sem confirmar ativação — subscribe() abaixo vai falhar com erro claro se não estiver pronto */ });
      }

      // Unsubscribe existing if any
      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const json = subscription.toJSON();

      // Save to database
      const { error } = await supabase
        .from('carreira_push_subscriptions')
        .upsert({
          user_id: session.user.id,
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
        }, {
          onConflict: 'user_id,endpoint',
        });

      if (error) throw error;

      setIsSubscribed(true);
      return { ok: true };
    } catch (err: any) {
      console.error('Push subscription error:', err);
      return { ok: false, reason: err?.message || 'Erro inesperado ao ativar notificações.' };
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      const registration = await getExistingPushRegistration();
      if (!registration) {
        setIsSubscribed(false);
        return;
      }
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        await supabase
          .from('carreira_push_subscriptions')
          .delete()
          .eq('user_id', session.user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error('Push unsubscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
