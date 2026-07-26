import { Navigate, useNavigate } from 'react-router-dom';
import { CarreiraLayout } from '@/components/layout/CarreiraLayout';
import { CreatePerfilForm } from '@/components/carreira/CreatePerfilForm';
import { PerfilHeader } from '@/components/carreira/PerfilHeader';
import { CarreiraTimeline } from '@/components/carreira/CarreiraTimeline';
import { SeletorCrianca } from '@/components/carreira/SeletorCrianca';
import { useCarreiraPlano } from '@/hooks/useCarreiraPlano';
import { PLANOS } from '@/config/carreiraPlanos';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { Button } from '@/components/ui/button';
import { Loader2, Crown, Zap } from 'lucide-react';
import { TutorialAutoShow } from '@/components/carreira/TutorialAutoShow';
import { TutorialHelpButton } from '@/components/carreira/TutorialHelpButton';
import { useCarreiraSession } from '@/hooks/useCarreiraSession';
import { useCriancaAtiva } from '@/hooks/useCriancaAtiva';

export default function CarreiraLinkedinPage() {
  const { sessionUserId, loading: sessionLoading } = useCarreiraSession();
  const navigate = useNavigate();

  const { perfilAtivo: perfil, isLoading: perfilLoading, perfis, selecionarCrianca } = useCriancaAtiva(sessionUserId);

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
            {perfil && (
              <SeletorCrianca perfis={perfis} perfilAtivoId={perfil?.crianca_id || null} onSelecionar={selecionarCrianca} />
            )}
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
              borderColor: `${PLANOS.premium.cor}30`,
              backgroundColor: `${PLANOS.premium.cor}08`,
            }}
          >
            <div className="flex items-center gap-2 text-sm">
              <Crown className="w-4 h-4 text-violet-500" />
              <span>
                Comece agora seus <strong>7 dias grátis</strong> do Premium — depois R$ 12/mês
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
            {/* perfil só entra em `perfis` se for dono OU colaborador ativo --
                EditPerfilDialog (dentro de PerfilHeader) deve ficar restrito
                ao dono real; postar/jornada (CarreiraTimeline) vale pros dois. */}
            <PerfilHeader perfil={perfil} isOwner={!perfil.souColaborador} viewerPerfilAtletaId={perfil.id} />
            <CarreiraTimeline perfil={perfil} isOwner={true} />
          </div>
        ) : (
          <CreatePerfilForm />
        )}
      </div>
    </CarreiraLayout>
  );
}
