import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DescobrirAtletasSection } from '@/components/carreira/DescobrirAtletasSection';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';
import logoCarreira from '@/assets/logo-carreira-id-dark.png';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { useCriancaAtiva } from '@/hooks/useCriancaAtiva';

export default function CarreiraDescobrirPage() {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileSlugRede, setProfileSlugRede] = useState<string | null>(null);
  const { theme } = useCarreiraTheme();
  // Um responsável pode ter mais de um atleta cadastrado (irmãos) -- usa a
  // criança ativa do seletor em vez de .maybeSingle() puro, que erroraria
  // com 2+ perfis pro mesmo user_id.
  const { perfilAtivo } = useCriancaAtiva(currentUserId);
  const profileSlug = perfilAtivo?.slug || profileSlugRede;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) {
        supabase.from('perfis_rede').select('slug').eq('user_id', uid)
          .order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data: pr }) => {
            setProfileSlugRede(pr?.slug || null);
          });
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-background" data-theme={theme}>
      <div className="h-1 w-full bg-[hsl(25_95%_55%)]" />
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container flex items-center h-14 lg:h-16 px-4 max-w-6xl gap-3">
          <button onClick={() => navigate(carreiraPath('/feed'))} className="flex items-center gap-2 text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <img src={logoCarreira} alt="Carreira" className="h-16 lg:h-20" />
          </button>
          <h1 className="text-sm font-semibold text-foreground">Descobrir Atletas</h1>
        </div>
      </header>

      <main className="container max-w-2xl px-4 py-6 pb-24">
        <DescobrirAtletasSection />
      </main>

      <CarreiraBottomNav currentUserId={currentUserId} profileSlug={profileSlug} />
    </div>
  );
}
