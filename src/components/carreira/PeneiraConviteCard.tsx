import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarDays, MapPin, User, Check, X, Clock, EyeOff, Ban } from 'lucide-react';
import { format, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PeneiraConvite, useRespondConvitePeneira, usePeneiraPrivado } from '@/hooks/usePeneirasData';
import { ShieldCheck } from 'lucide-react';

interface Props {
  convite: PeneiraConvite;
  accentColor?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Check }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-200', icon: Clock },
  confirmado: { label: 'Confirmado', color: 'bg-green-500/10 text-green-700 border-green-200', icon: Check },
  recusado: { label: 'Recusado', color: 'bg-red-500/10 text-red-700 border-red-200', icon: X },
  descartado: { label: 'Oculto', color: 'bg-muted text-muted-foreground border-border', icon: EyeOff },
};

export function PeneiraConviteCard({ convite, accentColor }: Props) {
  const respond = useRespondConvitePeneira();
  const peneira = convite.peneira;
  // endereço e contato só chegam depois que o responsável confirma
  const { data: privado } = usePeneiraPrivado(peneira?.id ?? null, convite.status === 'confirmado');
  if (!peneira) return null;

  // Hide descartado convites
  if (convite.status === 'descartado') return null;

  // Hide if peneira was cancelled and already responded
  if (peneira.status === 'cancelada' && convite.status !== 'pendente') return null;

  // Hide confirmed/recusado events that are past the event date
  const eventDate = new Date(peneira.data_evento);
  const isPast = isBefore(eventDate, new Date());
  if (isPast && convite.status !== 'pendente') return null;

  const statusConfig = STATUS_CONFIG[convite.status] || STATUS_CONFIG.pendente;
  const StatusIcon = statusConfig.icon;
  const criador = peneira.criador_perfil_rede;
  const borderColor = accentColor || 'hsl(var(--primary))';

  const isCancelled = peneira.status === 'cancelada';

  return (
    <Card className="border-l-4" style={{ borderLeftColor: borderColor }}>
      <CardContent className="pt-4 space-y-3">
        {/* Banner */}
        {peneira.banner_url && (
          <img src={peneira.banner_url} alt={peneira.titulo} className="w-full h-28 object-cover rounded-md -mt-1" />
        )}

        {/* Cancelled notice */}
        {isCancelled && (
          <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 rounded-md px-3 py-2">
            <Ban className="w-3.5 h-3.5 shrink-0" />
            <span>Este evento foi cancelado pelo organizador.</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="w-4 h-4 shrink-0" style={{ color: borderColor }} />
              <h3 className="font-semibold text-sm line-clamp-2 text-foreground">{peneira.titulo}</h3>
            </div>
            {criador && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Avatar className="w-4 h-4">
                  {criador.foto_url && <AvatarImage src={criador.foto_url} />}
                  <AvatarFallback><User className="w-2 h-2" /></AvatarFallback>
                </Avatar>
                <span>{criador.nome}</span>
              </div>
            )}
          </div>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${statusConfig.color}`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Details */}
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3 h-3" />
            {format(eventDate, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            {peneira.local_nome}{peneira.cidade ? `, ${peneira.cidade}` : ''}{peneira.estado ? ` - ${peneira.estado}` : ''}
          </div>
        </div>

        {peneira.descricao && (
          <p className="text-xs text-muted-foreground line-clamp-3">{peneira.descricao}</p>
        )}

        {/* Categories & positions */}
        {(peneira.categorias?.length > 0 || peneira.posicoes?.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {peneira.categorias?.map((c) => (
              <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
            ))}
            {peneira.posicoes?.map((p) => (
              <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
            ))}
          </div>
        )}

        {/* Segurança: lembretes para o responsável */}
        {convite.status !== 'recusado' && !isCancelled && (
          <div className="flex gap-2 rounded-md bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-600" />
            <span>Leve um responsável e confirme quem é o organizador. O Carreira ID nunca pede pagamento para participar de peneira. Algo estranho? Avise a gente.</span>
          </div>
        )}

        {/* Endereço e contato (só depois de confirmar) */}
        {convite.status === 'confirmado' && privado && (privado.local_endereco || privado.contato_whatsapp || privado.contato_email) && (
          <div className="space-y-0.5 rounded-md border px-3 py-2 text-xs">
            {privado.local_endereco && <p><span className="text-muted-foreground">Endereço: </span>{privado.local_endereco}</p>}
            {privado.contato_whatsapp && <p><span className="text-muted-foreground">WhatsApp: </span>{privado.contato_whatsapp}</p>}
            {privado.contato_email && <p><span className="text-muted-foreground">E-mail: </span>{privado.contato_email}</p>}
          </div>
        )}

        {/* Actions for pending */}
        {convite.status === 'pendente' && !isCancelled && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => respond.mutate({ conviteId: convite.id, status: 'confirmado' })}
              disabled={respond.isPending}
            >
              <Check className="w-4 h-4" />
              Confirmar Presença
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => respond.mutate({ conviteId: convite.id, status: 'recusado' })}
              disabled={respond.isPending}
            >
              <X className="w-4 h-4" />
              Recusar
            </Button>
          </div>
        )}

        {/* Dismiss button for confirmed/recusado events */}
        {(convite.status === 'confirmado' || convite.status === 'recusado') && !isPast && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full gap-1.5 text-xs text-muted-foreground"
            onClick={() => respond.mutate({ conviteId: convite.id, status: 'descartado' })}
            disabled={respond.isPending}
          >
            <EyeOff className="w-3 h-3" />
            Ocultar do perfil
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
