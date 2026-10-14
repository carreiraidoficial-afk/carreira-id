import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const CHAVE = 'carreira_push_banner_ate';
const SONECA_DIAS = 7;

function emSoneca(): boolean {
  try { return Date.now() < Number(localStorage.getItem(CHAVE) || 0); } catch { return false; }
}

/**
 * Convite discreto para ativar as notificações (só aparece se o aparelho ainda não está recebendo push).
 * "Agora não" esconde por 7 dias. Pede a permissão só no clique, como o navegador exige.
 */
export function PushPromptBanner({ className }: { className?: string }) {
  const { needsPrompt, subscribe, isLoading } = usePushNotifications();
  const [escondido, setEscondido] = useState(emSoneca);

  if (!needsPrompt || escondido) return null;

  const dispensar = () => {
    try { localStorage.setItem(CHAVE, String(Date.now() + SONECA_DIAS * 86400_000)); } catch { /* sem storage: só some nesta visita */ }
    setEscondido(true);
  };

  const ativar = async () => {
    const r = await subscribe();
    if (r.ok) toast.success('Notificações ativadas! Você será avisado de conexões e novidades.');
    else toast.error(r.reason || 'Não consegui ativar as notificações.');
  };

  return (
    <div className={`flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 ${className ?? ''}`}>
      <Bell className="h-5 w-5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-xs text-foreground">
        <span className="font-semibold">Quer saber na hora?</span> Ative as notificações para ser avisado quando alguém pedir ou aceitar uma conexão.
      </p>
      <Button size="sm" className="h-8 shrink-0 px-3 text-xs" onClick={ativar} disabled={isLoading}>Ativar</Button>
      <button type="button" onClick={dispensar} aria-label="Agora não" className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
