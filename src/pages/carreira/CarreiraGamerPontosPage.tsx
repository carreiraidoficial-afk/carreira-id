import { Link, Navigate, useNavigate } from 'react-router-dom';
import { TabelaPontos } from '@/components/carreira/TabelaPontos';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';
import { CarreiraThemeToggle } from '@/components/carreira/CarreiraThemeToggle';
import { Card } from '@/components/ui/card';
import { ArrowLeft, TableProperties, Loader2 } from 'lucide-react';
import logoCarreira from '@/assets/logo-carreira-id-dark.png';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { useCarreiraSession } from '@/hooks/useCarreiraSession';
import { useCriancaAtiva } from '@/hooks/useCriancaAtiva';

export default function CarreiraGamerPontosPage() {
  const { sessionUserId: currentUserId, loading: sessionLoading } = useCarreiraSession();
  const navigate = useNavigate();
  const { theme: carreiraTheme, isDarkTheme, setDarkTheme } = useCarreiraTheme();

  // Um responsável pode ter mais de um atleta cadastrado (irmãos) -- usa a
  // criança "ativa" do seletor em vez de sempre pegar a mais antiga.
  const { perfilAtivo } = useCriancaAtiva(currentUserId);
  const accentColor = perfilAtivo?.cor_destaque || '#3b82f6';

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-theme={carreiraTheme}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUserId) {
    return <Navigate to={carreiraPath('/cadastro')} replace />;
  }

  return (
    <div className="min-h-screen bg-background" data-theme={carreiraTheme}>
      <div className="h-[2px] w-full" style={{ backgroundColor: accentColor }} />
      <header
        className={`sticky top-0 z-50 ${isDarkTheme ? 'bg-[hsl(0_0%_0%/0.97)]' : 'bg-background/95 backdrop-blur-sm'}`}
        style={{ borderBottom: `2px solid ${accentColor}50` }}
      >
        <div className="container flex items-center h-14 px-4 max-w-2xl">
          <button onClick={() => navigate(carreiraPath('/liga'))} className="mr-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <Link to={carreiraPath('/feed')} className="flex items-center gap-2 shrink-0">
            <img src={logoCarreira} alt="Carreira" className="h-16 lg:h-20" />
          </Link>
          <h1 className="ml-4 text-lg font-semibold text-foreground">Tabela de Pontos da Liga</h1>
          <CarreiraThemeToggle
            className="ml-auto"
            isDarkTheme={isDarkTheme}
            onCheckedChange={setDarkTheme}
            compact
          />
        </div>
      </header>

      <main className="container max-w-2xl px-4 py-6 pb-24">
        <Card className="p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TableProperties className="w-4 h-4" style={{ color: accentColor }} />
            Tabela de Pontos
          </h3>
          <TabelaPontos accentColor={accentColor} />
        </Card>
      </main>

      <CarreiraBottomNav currentUserId={currentUserId} profileSlug={perfilData?.slug || null} />
    </div>
  );
}
