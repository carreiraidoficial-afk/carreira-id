import { Link } from 'react-router-dom';
import { CarreiraPageHeader } from '@/components/carreira/CarreiraPageHeader';
import { CarreiraThemeButton } from '@/components/carreira/CarreiraThemeToggle';
import { Loader2, ArrowLeft } from 'lucide-react';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';
import { CarreiraTimeline } from '@/components/carreira/CarreiraTimeline';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useCarreiraSession } from '@/hooks/useCarreiraSession';
import { useCriancaAtiva, slugDoDono } from '@/hooks/useCriancaAtiva';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { useSEO } from '@/hooks/useSEO';
import { CarreiraLogo } from '@/components/carreira/CarreiraLogo';

/**
 * Atalho dedicado pro currículo esportivo (Jornada, Publicações,
 * Estatísticas, Premiações, Experiência, Atividades Extras), fora da tela
 * de "Meu Perfil" -- pra quem só quer atualizar um dado não precisar passar
 * pela bio/foto. Fase 1: só ajuda o responsável logado navegando dentro do
 * app (o link público do perfil continua mostrando tudo junto por enquanto).
 */
export default function CarreiraCurriculoPage() {
  useSEO({ title: 'Currículo — Carreira ID', description: 'Jornada esportiva, estatísticas e premiações.', noindex: true });
  const { theme } = useCarreiraTheme();
  const { sessionUserId, loading: sessionLoading } = useCarreiraSession();
  const { perfilAtivo: meuPerfil, isLoading: perfilLoading } = useCriancaAtiva(sessionUserId);

  if (sessionLoading || perfilLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-theme={theme}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 lg:pt-14" data-theme={theme}>
      <CarreiraPageHeader title="Currículo" />

      <main className="container max-w-2xl px-4 py-4">
        {meuPerfil ? (
          <CarreiraTimeline perfil={meuPerfil} isOwner podeExcluir layout="grid" />
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">Você ainda não tem um perfil de atleta.</p>
            <Link to={carreiraPath('/cadastro')} className="text-sm text-primary hover:underline mt-2 inline-block">
              Criar perfil de atleta
            </Link>
          </div>
        )}
      </main>

      <CarreiraBottomNav currentUserId={sessionUserId} profileSlug={slugDoDono(meuPerfil)} />
    </div>
  );
}
