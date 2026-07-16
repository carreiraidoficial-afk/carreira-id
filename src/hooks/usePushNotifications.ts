import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Extend ServiceWorkerRegistration to include pushManager
declare global {
  interface ServiceWorkerRegistration {
    pushManager: PushManager;
  }
}

const VAPID_PUBLIC_KEY = 'BLoafPK8AxJaESg-2_XkHa8TZC-mOs3MRWMxAwzQCbanvIu9JkpPqYT-AqXjkrphPfMBPJW09Ydd9D3_LqWw0Js';

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

function isSameApplicationServerKey(sub: PushSubscription): boolean {
  const current = sub.options?.applicationServerKey;
  if (!current) return false;
  const currentBytes = new Uint8Array(current as ArrayBuffer);
  const expectedBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  if (currentBytes.length !== expectedBytes.length) return false;
  for (let i = 0; i < currentBytes.length; i++) {
    if (currentBytes[i] !== expectedBytes[i]) return false;
  }
  return true;
}

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
  reason?: string;
}

// Compartilhado entre todas as instancias do hook (varios componentes podem
// montar usePushNotifications ao mesmo tempo, ex: EditPerfilDialog e
// PushNotificationPopup) para nao disparar doSubscribe() em paralelo em cada
// uma delas -- isso criava assinaturas/linhas duplicadas na tabela.
let reconcileLock: Promise<void> | null = null;

export function usePushNotifications() {
  const { session } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [optOut, setOptOut] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const userId = session?.user?.id;

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (supported) setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const run = async () => {
      const { data } = await supabase.from('profiles').select('push_optout').eq('user_id', userId).maybeSingle();
      if (cancelled) return;
      const wantsPush = !(data?.push_optout ?? false);
      setOptOut(data?.push_optout ?? false);

      if (wantsPush && isSupported && Notification.permission === 'granted') {
        try {
          const reg = await getExistingPushRegistration();
          const existingSub = reg ? await reg.pushManager.getSubscription() : null;
          // Resubscreve se nao existe assinatura ainda, ou se a existente foi
          // criada com uma chave VAPID antiga (ficaria travada em 403 pra sempre).
          if (!existingSub || !isSameApplicationServerKey(existingSub)) {
            await doSubscribe(userId);
          }
        } catch { /* silencioso: tentativa de reconciliacao em segundo plano */ }
      }
    };

    // Encadeia (nao paralelo) com qualquer reconciliacao de outra instancia do
    // hook que ja esteja em andamento, pra nunca ter dois doSubscribe() rodando
    // ao mesmo tempo pro mesmo usuario.
    reconcileLock = reconcileLock ? reconcileLock.then(run, run) : run();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isSupported]);

  const getExistingPushRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const existing = registrations.find(r => (r.active || r.waiting || r.installing)?.scriptURL?.includes('push-sw.js'));
    return existing ?? null;
  };

  const getPushRegistration = async (): Promise<ServiceWorkerRegistration> => {
    const existing = await getExistingPushRegistration();
    if (existing) return existing;
    return navigator.serviceWorker.register('/push-sw.js', { scope: '/push-handler' });
  };

  const doSubscribe = async (uid: string): Promise<PushSubscribeResult> => {
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') {
      return { ok: false, reason: 'Permissão de notificação não foi concedida.' };
    }

    const registration = await withTimeout(getPushRegistration(), 8000, 'registrar o service worker');

    if (!registration.active) {
      await withTimeout(
        new Promise<void>((resolve) => {
          const sw = registration.installing || registration.waiting;
          if (sw) {
            sw.addEventListener('statechange', () => {
              if (sw.state === 'activated') resolve();
            });
            if (sw.state === 'activated') resolve();
          } else {
            resolve();
          }
        }),
        8000,
        'ativar o service worker',
      ).catch(() => { /* segue mesmo sem confirmar ativacao */ });
    }

    let subscription = await registration.pushManager.getSubscription();
    if (subscription && !isSameApplicationServerKey(subscription)) {
      // Assinatura antiga, criada com uma chave VAPID diferente da atual --
      // o push service vai rejeitar qualquer envio com 403, entao recria.
      await subscription.unsubscribe();
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const json = subscription.toJSON();

    const { error } = await supabase
      .from('carreira_push_subscriptions')
      .upsert({
        user_id: uid,
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      }, {
        onConflict: 'user_id,endpoint',
      });

    if (error) throw error;

    await supabase.from('profiles').update({ push_optout: false }).eq('user_id', uid);
    return { ok: true };
  };

  const subscribe = useCallback(async (): Promise<PushSubscribeResult> => {
    if (!isSupported) return { ok: false, reason: 'Este navegador/dispositivo não suporta notificações push.' };
    if (!userId) return { ok: false, reason: 'Sessão não encontrada. Recarregue a página e tente novamente.' };

    if (Notification.permission === 'denied') {
      return {
        ok: false,
        reason: 'As notificações foram bloqueadas antes. Vá nas configurações do navegador/app (ícone de cadeado ou Configurações > Notificações do site) e permita manualmente, depois tente de novo aqui.',
      };
    }

    setIsLoading(true);
    try {
      const result = await doSubscribe(userId);
      if (result.ok) setOptOut(false);
      return result;
    } catch (err: any) {
      console.error('Push subscription error:', err);
      return { ok: false, reason: err?.message || 'Erro inesperado ao ativar notificações.' };
    } finally {
      setIsLoading(false);
    }
  }, [userId, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      await supabase.from('profiles').update({ push_optout: true }).eq('user_id', userId);
      setOptOut(true);

      const registration = await getExistingPushRegistration();
      if (!registration) return;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await supabase
          .from('carreira_push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', subscription.endpoint);
      }
    } catch (err) {
      console.error('Push unsubscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return {
    isSupported,
    permission,
    isSubscribed: optOut !== true,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
