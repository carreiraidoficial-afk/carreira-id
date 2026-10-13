import { useState, useEffect } from 'react';
import { CarreiraPageHeader } from '@/components/carreira/CarreiraPageHeader';
import { CarreiraThemeButton } from '@/components/carreira/CarreiraThemeToggle';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DescobrirAtletasSection } from '@/components/carreira/DescobrirAtletasSection';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';
import { CarreiraLogo } from '@/components/carreira/CarreiraLogo';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { useCriancaAtiva, slugDoDono } from '@/hooks/useCriancaAtiva';

export default function CarreiraDescobrirPage() {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileSlugRede, setProfileSlugRede] = useState<string | null>(null);
  const { theme } = useCarreiraTheme();
  // Um responsável pode ter mais de um atleta cadastrado (irmãos) -- usa a
  // criança ativa do seletor em vez de .maybeSingle() puro, que erroraria
  // com 2+ perfis pro mesmo user_id.
  const { perfilAtivo } = useCriancaAtiva(currentUserId);
  const profileSlug = slugDoDono(perfilAtivo) || profileSlugRede;

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
    <div className="min-h-screen bg-background lg:pt-14" data-theme={theme}>
      <div className="h-1 w-full bg-[hsl(25_95%_55%)]" />
      <CarreiraPageHeader title="Descobrir Atletas" onBack={() => navigate(carreiraPath('/feed'))} maxWidth="max-w-6xl" />

      <main className="container max-w-2xl px-4 py-6 pb-24">
        <DescobrirAtletasSection />
      </main>

      <CarreiraBottomNav currentUserId={currentUserId} profileSlug={profileSlug} />
    </div>
  );
}
