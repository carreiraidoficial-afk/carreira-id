import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PushNotificationPopup({ open, onOpenChange }: PushNotificationPopupProps) {
  const { isSupported, isSubscribed, isLoading, subscribe } = usePushNotifications();
  const shouldSkip = !isSupported || isSubscribed;

  // Nada a pedir aqui (sem suporte, ou ja inscrito) -- fecha sozinho via onOpenChange
  // em vez de so retornar null, senao quem chama (ex: navegacao pos-cadastro) nunca
  // e avisado e fica esperando um fechamento que nunca dispara.
  useEffect(() => {
    if (open && shouldSkip) onOpenChange(false);
  }, [open, shouldSkip, onOpenChange]);

  if (shouldSkip) return null;

  const handleAtivar = async () => {
    await subscribe();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border" style={{ backgroundColor: 'hsl(220 15% 10%)', borderColor: 'hsl(220 10% 20%)', color: 'hsl(0 0% 95%)' }}>
        <DialogTitle className="sr-only">Ativar notificações</DialogTitle>
        <DialogDescription className="sr-only">Receba avisos sobre a jornada esportiva do atleta</DialogDescription>

        <div className="text-center space-y-4 py-2">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ backgroundColor: 'hsl(25 95% 55% / 0.15)' }}>
            <Bell className="w-8 h-8" style={{ color: 'hsl(25 95% 55%)' }} />
          </div>

          <div>
            <h3 className="text-lg font-bold" style={{ color: 'hsl(0 0% 95%)' }}>
              Não perca nenhuma novidade
            </h3>
            <p className="text-sm mt-1" style={{ color: 'hsl(0 0% 55%)' }}>
              Ative as notificações para saber na hora sobre conexões, curtidas e confirmações de pagamento.
            </p>
          </div>

          <Button
            className="w-full gap-2 font-bold text-white"
            size="lg"
            style={{ backgroundColor: 'hsl(25 95% 55%)' }}
            onClick={handleAtivar}
            disabled={isLoading}
          >
            <Bell className="w-5 h-5" />
            Ativar Notificações
          </Button>

          <Button
            variant="ghost"
            className="w-full text-sm"
            style={{ color: 'hsl(0 0% 50%)' }}
            onClick={() => onOpenChange(false)}
          >
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
