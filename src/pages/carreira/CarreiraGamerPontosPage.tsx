import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CarreiraPageHeader } from '@/components/carreira/CarreiraPageHeader';
import { TabelaPontos } from '@/components/carreira/TabelaPontos';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';
import { CarreiraThemeToggle } from '@/components/carreira/CarreiraThemeToggle';
import { Card } from '@/components/ui/card';
import { ArrowLeft, TableProperties, Loader2 } from 'lucide-react';
import { CarreiraLogo } from '@/components/carreira/CarreiraLogo';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { useCarreiraSession } from '@/hooks/useCarreiraSession';
import { useCriancaAtiva } from '@/hooks/useCriancaAtiva';
import { useLigaVisivel } from '@/hooks/useLigaVisivel';

export default function CarreiraGamerPontosPage() {
  const { sessionUserId: currentUserId, loading: sessionLoading } = useCarreiraSession();
  const navigate = useNavigate();
  const { theme: carreiraTheme, isDarkTheme, setDarkTheme } = useCarreiraTheme();

  // Um responsável pode ter mais de um atleta cadastrado (irmãos) -- usa a
  // criança "ativa" do seletor em vez de sempre pegar a mais antiga.
  const { perfilAtivo } = useCriancaAtiva(currentUserId);
  const accentColor = perfilAtivo?.cor_destaque || '#3b82f6';
  const { liberada: ligaLiberada, carregando: ligaCarregando } = useLigaVisivel();

  if (sessionLoading || ligaCarregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-theme={carreiraTheme}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUserId) {
    return <Navigate to={carreiraPath('/cadastro')} replace />;
  }

  if (!ligaLiberada) {
    return <Navigate to={carreiraPath('/feed')} replace />;
  }

  return (
    <div className="min-h-screen bg-background lg:pt-14" data-theme={carreiraTheme}>
      <div className="h-[2px] w-full" style={{ backgroundColor: accentColor }} />
      <CarreiraPageHeader
        title="Tabela de Pontos da Liga"
        onBack={() => navigate(carreiraPath('/liga'))}
        accentColor={accentColor}
        solidDark
        isDarkTheme={isDarkTheme}
      />

      <main className="container max-w-2xl px-4 py-6 pb-24">
        <Card className="p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TableProperties className="w-4 h-4" style={{ color: accentColor }} />
            Tabela de Pontos
          </h3>
          <TabelaPontos accentColor={accentColor} />
        </Card>
      </main>

      <CarreiraBottomNav currentUserId={currentUserId} profileSlug={perfilAtivo?.slug || null} />
    </div>
  );
}
