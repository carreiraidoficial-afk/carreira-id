import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CarreiraLayout } from '@/components/layout/CarreiraLayout';
import { CreatePerfilForm } from '@/components/carreira/CreatePerfilForm';
import { PerfilHeader } from '@/components/carreira/PerfilHeader';
import { CarreiraTimeline } from '@/components/carreira/CarreiraTimeline';
import { useCarreiraPlano } from '@/hooks/useCarreiraPlano';
import { PLANOS } from '@/config/carreiraPlanos';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { Button } from '@/components/ui/button';
import { Loader2, Crown, Zap } from 'lucide-react';
import { TutorialAutoShow } from '@/components/carreira/TutorialAutoShow';
import { TutorialHelpButton } from '@/components/carreira/TutorialHelpButton';
import { useCarreiraSession } from '@/hooks/useCarreiraSession';
import type { PerfilAtleta } from '@/hooks/useCarreiraData';

export default function CarreiraLinkedinPage() {
  const { sessionUserId, loading: sessionLoading } = useCarreiraSession();
  const navigate = useNavigate();

  const { data: perfil, isLoading: perfilLoading } = useQuery({
    queryKey: ['meu-perfil-atleta', sessionUserId],
    queryFn: async () => {
      if (!sessionUserId) return null;
      const { data, error } = await supabase
        .from('perfil_atleta')
        .select('*')
        .eq('user_id', sessionUserId)
        .maybeSingle();
      if (error) throw error;
      return data as PerfilAtleta | null;
    },
    enabled: !!sessionUserId,
  });

  const criancaId = perfil?.crianca_id || null;
  const { plano, isLoading: planoLoading } = useCarreiraPlano(criancaId);

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sessionUserId) {
    return <Navigate to="/auth" replace />;
  }

  const isLoading = perfilLoading;
  const planoInfo = PLANOS[plano];
  const showUpgradeBanner = plano === 'base' && perfil && !planoLoading;

  return (
    <CarreiraLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Minha Carreira</h1>
            <p className="text-muted-foreground">
              Sua vitrine esportiva pública
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TutorialHelpButton tipoPerfil="atleta_filho" />
          {perfil && !planoLoading && (
            <button
              onClick={() => navigate(carreiraPath('/planos'))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors hover:opacity-80"
              style={{ backgroundColor: `${planoInfo.cor}15`, color: planoInfo.cor }}
            >
              {planoInfo.icone} {planoInfo.nome}
            </button>
          )}
          </div>
        </div>

        {/* Tutorial auto-show para novos usuários */}
        {perfil && <TutorialAutoShow tipoPerfil="atleta_filho" />}

        {/* Upgrade banner */}
        {showUpgradeBanner && (
          <div
            className="flex items-center justify-between gap-3 p-3 rounded-lg border"
            style={{
              borderColor: `${PLANOS[plano === 'base' ? 'competidor' : 'elite'].cor}30`,
              backgroundColor: `${PLANOS[plano === 'base' ? 'competidor' : 'elite'].cor}08`,
            }}
          >
            <div className="flex items-center gap-2 text-sm">
              {plano === 'base' ? <Zap className="w-4 h-4 text-amber-500" /> : <Crown className="w-4 h-4 text-violet-500" />}
              <span>
                {plano === 'base'
                  ? 'Desbloqueie mais recursos com o plano Competidor'
                  : 'Maximize sua visibilidade com o plano Elite'}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(carreiraPath('/planos'))}
              className="shrink-0 text-xs"
            >
              Ver planos
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : perfil ? (
          <div className="space-y-6">
            <PerfilHeader perfil={perfil} isOwner={true} />
            <CarreiraTimeline perfil={perfil} isOwner={true} />
          </div>
        ) : (
          <CreatePerfilForm />
        )}
      </div>
    </CarreiraLayout>
  );
}
