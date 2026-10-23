import { CarreiraLogo } from '@/components/carreira/CarreiraLogo';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isCarreiraDomain } from '@/hooks/useCarreiraBasePath';
import logoCarreiraId from '@/assets/logo-carreira-id-dark.png';
import logoAtletaId from '@/assets/logo-atleta-id.png';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { useSEO } from '@/hooks/useSEO';
import SwotFamiliaFlow from '@/components/carreira/swot/SwotFamiliaFlow';

export default function SwotFamiliaPage() {
  const navigate = useNavigate();
  const isCarreira = isCarreiraDomain();
  const logo = isCarreira ? logoCarreiraId : logoAtletaId;
  const brand = isCarreira ? 'Carreira ID' : 'Atleta ID';
  const { theme } = useCarreiraTheme();

  useSEO({
    title: `SWOT em Família — ${brand}`,
    description: 'Instrumento de diálogo entre atletas de base e seus responsáveis: respondam separadamente, comparem e definam juntos o próximo foco.',
    path: '/swot-familia',
  });

  return (
    <div className="min-h-screen bg-background" data-theme={theme}>
      <div className="h-1 w-full bg-[hsl(25_95%_55%)]" />
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container flex items-center h-14 px-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {isCarreira ? <CarreiraLogo className="h-10" /> : <img src={logo} alt={brand} className="h-10" />}
          </button>
        </div>
      </header>

      <main className="container max-w-2xl px-4 py-8">
        <SwotFamiliaFlow />
      </main>
    </div>
  );
}
