import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarDays, MapPin, Users, User, Send, Eye, Pencil, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Peneira, useConvitesPeneira, useCancelPeneira } from '@/hooks/usePeneirasData';
import { PeneiraConvidarDialog } from './PeneiraConvidarDialog';
import { PeneiraConvitesListDialog } from './PeneiraConvitesListDialog';
import { PeneiraFormDialog } from './PeneiraFormDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  peneira: Peneira;
  isOwner?: boolean;
}

export function PeneiraCard({ peneira, isOwner }: Props) {
  const [convidarOpen, setConvidarOpen] = useState(false);
  const [convitesListOpen, setConvitesListOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { data: convites = [] } = useConvitesPeneira(isOwner ? peneira.id : null);
  const cancelPeneira = useCancelPeneira();

  const criador = peneira.criador_perfil_rede;
  const confirmados = convites.filter((c) => c.status === 'confirmado').length;
  const pendentes = convites.filter((c) => c.status === 'pendente').length;
  const recusados = convites.filter((c) => c.status === 'recusado').length;

  const statusLabel = peneira.status === 'aberta' ? 'Aberta' : peneira.status === 'cancelada' ? 'Cancelada' : peneira.status;
  const statusClass = peneira.status === 'aberta'
    ? 'bg-green-500/10 text-green-700 border-green-200'
    : peneira.status === 'cancelada'
      ? 'bg-red-500/10 text-red-700 border-red-200'
      : 'bg-muted text-muted-foreground';

  return (
    <>
      <Card className="overflow-hidden">
        {peneira.banner_url && (
          <img src={peneira.banner_url} alt={peneira.titulo} className="w-full h-32 object-cover" />
        )}
        <CardContent className={peneira.banner_url ? 'pt-3' : 'pt-4'}>
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-sm">{peneira.titulo}</h3>
                {criador && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <Avatar className="w-4 h-4">
                      {criador.foto_url && <AvatarImage src={criador.foto_url} />}
                      <AvatarFallback><User className="w-2 h-2" /></AvatarFallback>
                    </Avatar>
                    <span>{criador.nome}</span>
                  </div>
                )}
              </div>
              <Badge variant="outline" className={statusClass}>
                {statusLabel}
              </Badge>
            </div>

            {/* Details */}
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3 shrink-0" />
                {format(new Date(peneira.data_evento), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 shrink-0" />
                {peneira.local_nome}{peneira.cidade ? `, ${peneira.cidade}` : ''}{peneira.estado ? ` - ${peneira.estado}` : ''}
              </div>
              {peneira.vagas && (
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 shrink-0" />
                  {peneira.vagas} vagas
                </div>
              )}
            </div>

            {peneira.descricao && (
              <p className="text-xs text-muted-foreground line-clamp-2">{peneira.descricao}</p>
            )}

            {/* Tags */}
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

            {/* Convites summary for owner */}
            {isOwner && convites.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                <span className="text-green-600 font-medium">✓ {confirmados}</span>
                <span className="text-yellow-600 font-medium">⏳ {pendentes}</span>
                <span className="text-red-600 font-medium">✗ {recusados}</span>
                <span className="text-muted-foreground ml-auto">{convites.length} convites</span>
              </div>
            )}

            {/* Situação da análise (só o organizador vê) */}
            {isOwner && peneira.aprovacao_status && peneira.aprovacao_status !== 'aprovada' && (
              <div className={`rounded-md px-3 py-2 text-xs ${peneira.aprovacao_status === 'recusada' ? 'bg-red-500/10 text-red-700' : 'bg-amber-500/10 text-amber-700'}`}>
                {peneira.aprovacao_status === 'recusada'
                  ? `Recusada pelo Carreira ID${peneira.aprovacao_nota ? `: ${peneira.aprovacao_nota}` : '.'} Edite para enviar de novo.`
                  : 'Em análise pelo Carreira ID. Você poderá convidar atletas depois da aprovação.'}
              </div>
            )}

            {/* Owner actions */}
            {isOwner && peneira.status === 'aberta' && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 gap-1.5" disabled={peneira.aprovacao_status !== 'aprovada'} onClick={() => setConvidarOpen(true)}>
                    <Send className="w-3 h-3" /> Convidar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setConvitesListOpen(true)}>
                    <Eye className="w-3 h-3" /> Ver Convites
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setEditOpen(true)}>
                    <Pencil className="w-3 h-3" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
                    <XCircle className="w-3 h-3" /> Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Show convites button for cancelled/closed peneiras */}
            {isOwner && peneira.status !== 'aberta' && convites.length > 0 && (
              <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setConvitesListOpen(true)}>
                <Eye className="w-3 h-3" /> Ver Convites ({convites.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <PeneiraConvidarDialog open={convidarOpen} onOpenChange={setConvidarOpen} peneira={peneira} />
      <PeneiraConvitesListDialog open={convitesListOpen} onOpenChange={setConvitesListOpen} peneiraId={peneira.id} peneiraTitulo={peneira.titulo} />
      
      {isOwner && (
        <PeneiraFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          criadorId={peneira.criador_id}
          criadorPerfilRedeId={peneira.criador_perfil_rede_id || ''}
          editPeneira={peneira}
        />
      )}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Peneira</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar "{peneira.titulo}"? Todos os atletas convidados serão notificados do cancelamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelPeneira.mutate({ peneiraId: peneira.id, titulo: peneira.titulo })}
              disabled={cancelPeneira.isPending}
            >
              {cancelPeneira.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
