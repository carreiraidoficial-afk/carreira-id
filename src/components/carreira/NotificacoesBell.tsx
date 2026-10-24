import { useState, useEffect } from 'react';
import { Bell, BellRing, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useMyCarreiraComunicados, useMarkComunicadoRead, useDismissComunicado, useUnreadCarreiraComunicados } from '@/hooks/useCarreiraComunicadosData';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useBadgeNotification } from '@/hooks/useBadgeNotification';
import { useCarreiraPushNotifications } from '@/hooks/useCarreiraPushNotifications';
import { toast } from 'sonner';

const TIPO_ICONS: Record<string, string> = {
  informativo: '📘',
  importante: '⚠️',
  urgente: '🚨',
};

export function NotificacoesBell({ accentColor }: { accentColor?: string }) {
  const { data: comunicados = [], isFetched } = useMyCarreiraComunicados();
  const { unreadCount } = useUnreadCarreiraComunicados();
  const markRead = useMarkComunicadoRead();
  const dismiss = useDismissComunicado();
  const [userId, setUserId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const { isSupported, permission, isSubscribed, isLoading: pushLoading, subscribe } = useCarreiraPushNotifications();

  useBadgeNotification(unreadCount);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  const handleMarkRead = (comunicadoId: string) => {
    if (!userId) return;
    markRead.mutate({ comunicadoId, userId });
  };

  // Excluir só tira da lista desta pessoa; quem não excluir continua vendo o aviso (já lido).
  const handleDismiss = (comunicadoId: string) => {
    if (!userId) return;
    dismiss.mutate(
      { comunicadoId, userId },
      { onSuccess: () => toast.success('Aviso removido da sua lista'), onError: () => toast.error('Não foi possível remover agora') },
    );
  };

  const handleOpenComunicado = (c: any) => {
    if (!c.lido) handleMarkRead(c.id);
    setSelected(c);
    setPopoverOpen(false);
  };

  // Toque no push de comunicado: o link traz ?aviso=<id>; abre o aviso direto (e marca como lido) e limpa o endereço.
  useEffect(() => {
    if (!userId || !isFetched) return;
    const params = new URLSearchParams(window.location.search);
    const avisoId = params.get('aviso');
    if (!avisoId) return;
    params.delete('aviso');
    const resto = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (resto ? `?${resto}` : '') + window.location.hash);
    const alvo = comunicados.find((c: any) => c.id === avisoId);
    if (alvo) handleOpenComunicado(alvo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isFetched, comunicados]);

  const handleEnablePush = async () => {
    const result = await subscribe();
    if (result) {
      toast.success('Notificações push ativadas!');
    } else if (permission === 'denied') {
      toast.error('Notificações bloqueadas pelo navegador. Verifique as configurações.');
    }
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-8 w-8">
            <Bell className="w-4 h-4" style={{ color: accentColor }} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 max-h-96 overflow-y-auto" align="end">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Notificações</h3>
            {isSupported && !isSubscribed && permission !== 'denied' && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] gap-1"
                onClick={handleEnablePush}
                disabled={pushLoading}
              >
                <BellRing className="w-3 h-3" />
                {pushLoading ? 'Ativando...' : 'Ativar Push'}
              </Button>
            )}
            {isSubscribed && (
              <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">
                <BellRing className="w-2.5 h-2.5 mr-0.5" /> Push ativo
              </Badge>
            )}
          </div>
          {comunicados.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y">
              {comunicados.slice(0, 20).map((c: any) => (
                <div
                  key={c.id}
                  className={`p-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors ${!c.lido ? 'bg-primary/5' : ''}`}
                  onClick={() => handleOpenComunicado(c)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5">{TIPO_ICONS[c.tipo] || '📢'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-semibold truncate ${!c.lido ? 'text-foreground' : 'text-muted-foreground'}`}>{c.titulo}</p>
                        {!c.lido && <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{c.mensagem}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(c.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      title="Excluir da minha lista"
                      aria-label="Excluir da minha lista"
                      onClick={(e) => { e.stopPropagation(); handleDismiss(c.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-left">
                  <span className="text-xl">{TIPO_ICONS[selected.tipo] || '📢'}</span>
                  <span className="flex-1">{selected.titulo}</span>
                </DialogTitle>
                <DialogDescription className="text-left">
                  {format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </DialogDescription>
              </DialogHeader>
              <div className="text-sm text-foreground whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto">
                {selected.mensagem}
              </div>
              {selected.link_url && (
                <Button
                  asChild
                  className="w-full"
                  style={accentColor ? { backgroundColor: accentColor } : undefined}
                >
                  <a href={selected.link_url} target="_blank" rel="noopener noreferrer">
                    Abrir link
                  </a>
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelected(null)}>Manter na lista</Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => { handleDismiss(selected.id); setSelected(null); }}
                >
                  <Trash2 className="w-4 h-4" /> Excluir
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
