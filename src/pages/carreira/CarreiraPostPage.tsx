import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PostAtleta } from '@/hooks/useCarreiraData';
import { PostCard } from '@/components/carreira/PostCard';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';
import { Button } from '@/components/ui/button';
import logoCarreira from '@/assets/logo-carreira-id-dark.png';

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
        .select('*, perfil:perfil_atleta(*), perfil_rede:perfis_rede(*)')
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
      <header className="sticky top-0 lg:top-14 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-3 py-2 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Link to="/feed" className="flex items-center gap-2">
            <img src={logoCarreira} alt="Carreira ID" className="h-7" />
          </Link>
        </div>
      </header>

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
