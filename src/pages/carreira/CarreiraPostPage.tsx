import { useEffect, useState } from 'react';
import { CarreiraPageHeader } from '@/components/carreira/CarreiraPageHeader';
import { CarreiraThemeButton } from '@/components/carreira/CarreiraThemeToggle';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PostAtleta } from '@/hooks/useCarreiraData';
import { PostCard } from '@/components/carreira/PostCard';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';
import { Button } from '@/components/ui/button';
import { CarreiraLogo } from '@/components/carreira/CarreiraLogo';

import { COLUNAS_PERFIL_ATLETA, COLUNAS_PERFIL_REDE } from '@/lib/contato-perfil';
export default function CarreiraPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<PostAtleta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('posts_atleta')
        .select(`*, perfil:perfil_atleta(${COLUNAS_PERFIL_ATLETA}), perfil_rede:perfis_rede(${COLUNAS_PERFIL_REDE})` as const)
        .eq('id', postId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const p: any = {
          ...data,
          perfil: Array.isArray((data as any).perfil) ? (data as any).perfil[0] : (data as any).perfil,
          perfil_rede: Array.isArray((data as any).perfil_rede) ? (data as any).perfil_rede[0] : (data as any).perfil_rede,
        };
        setPost(p as PostAtleta);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [postId]);

  return (
    <div className="min-h-screen bg-background pb-20 lg:pt-14">
      <CarreiraPageHeader onBack={() => navigate(-1)} />

      <main className="max-w-2xl mx-auto px-3 py-4">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && !post && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Publicação não encontrada.</p>
            <Button asChild><Link to="/feed">Ir para o feed</Link></Button>
          </div>
        )}
        {post && <PostCard post={post} />}
      </main>

      <CarreiraBottomNav />
    </div>
  );
}
