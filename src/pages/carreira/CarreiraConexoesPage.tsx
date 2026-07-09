import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ConnectionsSection } from '@/components/carreira/ConnectionsSection';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';
import { Loader2 } from 'lucide-react';
import logoCarreira from '@/assets/logo-carreira-id-dark.png';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useCarreiraSession } from '@/hooks/useCarreiraSession';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';

export default function CarreiraConexoesPage() {
  const { sessionUserId: currentUserId, loading } = useCarreiraSession();
  const [mySlug, setMySlug] = useState<string | null>(null);
  const { theme } = useCarreiraTheme();

  useEffect(() => {
    if (!currentUserId) return;
    supabase.from('perfil_atleta').select('slug').eq('user_id', currentUserId).maybeSingle().then(({ data: pa }) => {
      if (pa?.slug) { setMySlug(pa.slug); return; }
      supabase.from('perfis_rede').select('slug').eq('user_id', currentUserId).maybeSingle().then(({ data: pr }) => {
        setMySlug(pr?.slug || null);
      });
    });
  }, [currentUserId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-theme={theme}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUserId) {
    return <Navigate to={carreiraPath('/cadastro')} replace />;
  }

  return (
    <div className="min-h-screen bg-background" data-theme={theme}>
      <div className="h-1 w-full bg-[hsl(25_95%_55%)]" />
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container flex items-center h-14 px-4 max-w-2xl">
          <Link to={carreiraPath('/feed')} className="flex items-center gap-2 shrink-0">
            <img src={logoCarreira} alt="Carreira" className="h-16 lg:h-20" />
          </Link>
          <h1 className="ml-4 text-lg font-semibold text-foreground">Conexões</h1>
        </div>
      </header>

      <main className="container max-w-2xl px-4 py-6 pb-24 space-y-6">
        <ConnectionsSection userId={currentUserId} currentUserId={currentUserId} />
      </main>

      <CarreiraBottomNav currentUserId={currentUserId} profileSlug={mySlug} />
    </div>
  );
}
