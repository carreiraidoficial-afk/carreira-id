import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CalendarDays, Plus, Loader2, ArrowLeft, RotateCcw } from 'lucide-react';
import { useMinhasPeneiras, useMeusConvitesPeneira, useCanCreatePeneira, useRespondConvitePeneira } from '@/hooks/usePeneirasData';
import { PeneiraFormDialog } from '@/components/carreira/PeneiraFormDialog';
import { PeneiraCard } from '@/components/carreira/PeneiraCard';
import { PeneiraConviteCard } from '@/components/carreira/PeneiraConviteCard';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import logoCarreira from '@/assets/logo-carreira-id-dark.png';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';

export default function CarreiraEventosPage() {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { theme } = useCarreiraTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) {
        navigate(carreiraPath('/cadastro'), { replace: true });
        return;
      }
      setCurrentUserId(session.user.id);
    });
  }, [navigate]);

  const { data: perfilRede } = useQuery({
    queryKey: ['eventos-perfil-rede', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return null;
      const { data } = await supabase
        .from('perfis_rede')
        .select('id, tipo, slug')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!currentUserId,
  });

  const canCreate = useCanCreatePeneira(perfilRede?.tipo || null);
  const { data: minhasPeneiras = [], isLoading: loadingPeneiras } = useMinhasPeneiras(canCreate ? currentUserId : null);
  const { data: meusConvites = [], isLoading: loadingConvites } = useMeusConvitesPeneira(currentUserId);

  const pendentes = meusConvites.filter((c) => c.status === 'pendente');
  const confirmados = meusConvites.filter((c) => c.status === 'confirmado');
  const respondidos = meusConvites.filter((c) => c.status === 'recusado');
  const descartados = meusConvites.filter((c) => c.status === 'descartado');

  const peneirasAbertas = minhasPeneiras.filter((p) => p.status === 'aberta');
  const peneirasEncerradas = minhasPeneiras.filter((p) => p.status !== 'aberta');

  if (!currentUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-theme={theme}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-theme={theme}>
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container flex items-center justify-between h-16 px-4">
          <button
            onClick={() => navigate(carreiraPath('/feed'))}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            <img src={logoCarreira} alt="Carreira" className="h-20" />
          </button>
          {canCreate && perfilRede?.id && (
            <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
              <Plus className="w-4 h-4" /> Nova Peneira
            </Button>
          )}
        </div>
      </header>

      <main className="container max-w-lg px-4 py-6 pb-24">
        <div className="flex items-center gap-2 mb-6">
          <CalendarDays className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Eventos & Peneiras</h1>
        </div>

        {canCreate ? (
          <Tabs defaultValue="minhas" className="space-y-4">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="minhas">Minhas Peneiras</TabsTrigger>
              <TabsTrigger value="convites">
                Convites {pendentes.length > 0 && `(${pendentes.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="minhas" className="space-y-4">
              {loadingPeneiras ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : peneirasAbertas.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Abertas</h3>
                  {peneirasAbertas.map((p) => (
                    <PeneiraCard key={p.id} peneira={p} isOwner />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma peneira criada ainda</p>
                  <Button size="sm" className="mt-4 gap-1.5" onClick={() => setFormOpen(true)}>
                    <Plus className="w-4 h-4" /> Criar Peneira
                  </Button>
                </div>
              )}
              {peneirasEncerradas.length > 0 && (
                <div className="space-y-3 mt-6">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Encerradas</h3>
                  {peneirasEncerradas.map((p) => (
                    <PeneiraCard key={p.id} peneira={p} isOwner />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="convites" className="space-y-4">
              <ConvitesContent
                pendentes={pendentes}
                confirmados={confirmados}
                respondidos={respondidos}
                descartados={descartados}
                loading={loadingConvites}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <ConvitesContent
            pendentes={pendentes}
            confirmados={confirmados}
            respondidos={respondidos}
            descartados={descartados}
            loading={loadingConvites}
          />
        )}
      </main>

      {canCreate && perfilRede?.id && (
        <PeneiraFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          criadorId={currentUserId}
          criadorPerfilRedeId={perfilRede.id}
        />
      )}

      <CarreiraBottomNav currentUserId={currentUserId} profileSlug={null} />
    </div>
  );
}

function DescartadoRecoverCard({ convite }: { convite: any }) {
  const respond = useRespondConvitePeneira();
  const peneira = convite.peneira;
  if (!peneira) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-foreground">{peneira.titulo}</p>
        <p className="text-xs text-muted-foreground">{peneira.local_nome}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="gap-1 shrink-0"
        onClick={() => respond.mutate({ conviteId: convite.id, status: 'confirmado' })}
        disabled={respond.isPending}
      >
        <RotateCcw className="w-3 h-3" />
        Restaurar
      </Button>
    </div>
  );
}

function ConvitesContent({
  pendentes,
  confirmados,
  respondidos,
  descartados,
  loading,
}: {
  pendentes: any[];
  confirmados: any[];
  respondidos: any[];
  descartados: any[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasAny = pendentes.length > 0 || confirmados.length > 0 || respondidos.length > 0 || descartados.length > 0;

  if (!hasAny) {
    return (
      <div className="text-center py-12">
        <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum convite recebido ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendentes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pendentes</h3>
          {pendentes.map((c) => (
            <PeneiraConviteCard key={c.id} convite={c} />
          ))}
        </div>
      )}
      {confirmados.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirmados</h3>
          {confirmados.map((c) => (
            <PeneiraConviteCard key={c.id} convite={c} />
          ))}
        </div>
      )}
      {respondidos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recusados</h3>
          {respondidos.map((c) => (
            <PeneiraConviteCard key={c.id} convite={c} />
          ))}
        </div>
      )}
      {descartados.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ocultos</h3>
          {descartados.map((c) => (
            <DescartadoRecoverCard key={c.id} convite={c} />
          ))}
        </div>
      )}
    </div>
  );
}
