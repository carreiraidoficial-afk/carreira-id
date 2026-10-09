import { useState, useEffect } from 'react';
import { plataformaUserIds, conexaoComPlataforma } from '@/lib/perfil-plataforma';
import { useSuporteAlvo } from '@/hooks/useSuporteAlvo';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ConnectionsSection } from '@/components/carreira/ConnectionsSection';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';
import { NotificacoesBell } from '@/components/carreira/NotificacoesBell';
import { Loader2, Users, Heart, Wrench } from 'lucide-react';
import logoCarreira from '@/assets/logo-carreira-id-dark.png';
import conexoesBannerBg from '@/assets/torcida-pais-bg.jpg';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useCarreiraSession } from '@/hooks/useCarreiraSession';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { useCriancaAtiva, slugDoDono } from '@/hooks/useCriancaAtiva';

// Quem viu este perfil (like LinkedIn) -- enriquecido com fotos atuais.
// Movido de CarreiraPerfilPage.tsx pra cá: junto com conexões, sugestões e
// torcida, faz mais sentido "quem interagiu com meu perfil" morar num só
// lugar em vez de espalhado pela página do perfil.
function useProfileViews(perfilAtletaId?: string) {
  return useQuery({
    queryKey: ['profile-views', perfilAtletaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfil_visualizacoes')
        .select('*')
        .eq('perfil_atleta_id', perfilAtletaId!)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const viewerIds = [...new Set(data.map(v => v.viewer_user_id))];
      const { data: redeProfiles } = await supabase
        .from('perfis_rede')
        .select('user_id, foto_url, nome, tipo')
        .in('user_id', viewerIds);
      const { data: atletaProfiles } = await supabase
        .from('perfil_atleta')
        .select('user_id, foto_url, nome')
        .in('user_id', viewerIds);

      const redeMap = new Map((redeProfiles || []).map(p => [p.user_id, p]));
      const atletaMap = new Map((atletaProfiles || []).map(p => [p.user_id, p]));

      const seen = new Set<string>();
      const unique = data.filter(v => {
        if (seen.has(v.viewer_user_id)) return false;
        seen.add(v.viewer_user_id);
        return true;
      });

      return unique.map(view => {
        const rede = redeMap.get(view.viewer_user_id);
        const atleta = atletaMap.get(view.viewer_user_id);
        const resolvedTipo = atleta ? 'atleta' : (rede?.tipo === 'pai_responsavel' ? 'atleta' : rede?.tipo || view.viewer_tipo);
        return {
          ...view,
          viewer_foto_url: rede?.foto_url || atleta?.foto_url || view.viewer_foto_url,
          viewer_nome: rede?.nome || atleta?.nome || view.viewer_nome,
          viewer_tipo: resolvedTipo,
        };
      });
    },
    enabled: !!perfilAtletaId,
  });
}

function useConexoesTotal(userId: string | null, perfilAtletaId?: string | null) {
  return useQuery({
    queryKey: ['conexoes-total', userId, perfilAtletaId],
    queryFn: async () => {
      const { data } = await supabase
        .from('rede_conexoes')
        .select('solicitante_id, destinatario_id, solicitante_perfil_atleta_id, destinatario_perfil_atleta_id')
        .eq('status', 'aceita')
        .or(`solicitante_id.eq.${userId},destinatario_id.eq.${userId}`);
      const plataforma = await plataformaUserIds();
      const minhas = (data || []).filter((row) => {
        const souSolicitante = row.solicitante_id === userId;
        const meuLado = souSolicitante ? row.solicitante_perfil_atleta_id : row.destinatario_perfil_atleta_id;
        return (!meuLado || meuLado === perfilAtletaId) && !conexaoComPlataforma(row, userId!, plataforma);
      });
      return minhas.length;
    },
    enabled: !!userId,
  });
}

export default function CarreiraConexoesPage() {
  const { sessionUserId, loading } = useCarreiraSession();
  // Modo Suporte: tudo nesta tela passa a ser da conta-alvo, não do admin logado.
  const suporte = useSuporteAlvo();
  const currentUserId = suporte.ativo && suporte.alvo ? suporte.alvo.userId : sessionUserId;
  const navigate = useNavigate();
  const [mySlugRede, setMySlugRede] = useState<string | null>(null);
  const { theme } = useCarreiraTheme();
  // Um responsável pode ter mais de um atleta cadastrado (irmãos) -- usa a
  // criança ativa do seletor em vez de .maybeSingle() puro, que erroraria
  // com 2+ perfis pro mesmo user_id.
  const { perfilAtivo } = useCriancaAtiva(currentUserId);
  const mySlug = slugDoDono(perfilAtivo) || mySlugRede;
  const accentColor = perfilAtivo?.cor_destaque || '#3b82f6';
  const { data: conexoesTotal } = useConexoesTotal(currentUserId, perfilAtivo?.id);
  const torcedoresTotal = perfilAtivo?.followers_count || 0;

  useEffect(() => {
    if (!currentUserId) return;
    supabase.from('perfis_rede').select('slug').eq('user_id', currentUserId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data: pr }) => {
        setMySlugRede(pr?.slug || null);
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
    <div className="min-h-screen bg-background lg:pt-14" data-theme={theme}>
      {suporte.ativo && suporte.alvo && (
        <div className="container max-w-2xl px-4 pt-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <Wrench className="w-4 h-4 shrink-0 text-amber-600" />
            <p className="flex-1 text-foreground">
              <strong>Modo Suporte</strong> — conexões de <strong>{suporte.alvo.nome}</strong>.
            </p>
            {suporte.alvo.slug && (
              <Link to={carreiraPath(`/${suporte.alvo.slug}`)} className="text-xs font-medium underline shrink-0 text-amber-700">
                Perfil
              </Link>
            )}
            <button onClick={suporte.sair} className="text-xs font-medium underline shrink-0 text-amber-700">
              Sair
            </button>
          </div>
        </div>
      )}
      <header className="relative overflow-hidden">
        <img src={conexoesBannerBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accentColor}cc, #0a0f18e6)` }} />
        <div className="container max-w-2xl px-4 pt-4 pb-6 relative">
          <div className="flex items-center justify-between">
            <Link to={carreiraPath('/feed')} className="flex items-center gap-2 shrink-0">
              <img src={logoCarreira} alt="Carreira" className="h-8" />
            </Link>
            <NotificacoesBell />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold text-white">Conexões</h1>
          <p className="text-white/70 text-sm mt-1">Construa sua rede no esporte</p>
          <div className="flex items-center gap-3 mt-4">
            <div className="bg-black/30 rounded-xl px-4 py-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-white/80" />
              <div>
                <p className="text-white font-bold text-lg leading-tight">{conexoesTotal ?? 0}</p>
                <p className="text-white/70 text-[11px]">Conexões</p>
              </div>
            </div>
            <div className="bg-black/30 rounded-xl px-4 py-2 flex items-center gap-2">
              <Heart className="w-4 h-4 text-white/80" />
              <div>
                <p className="text-white font-bold text-lg leading-tight">{torcedoresTotal}</p>
                <p className="text-white/70 text-[11px]">Torcedores</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* "Quem viu este perfil" tirado da tela por enquanto -- estava
          atrapalhando o layout que a gente quer pra Conexões. Feature
          (useProfileViews acima, ProfileViewsSection) continua intacta,
          só não está plugada aqui. */}
      <main className="container max-w-2xl px-4 py-6 pb-24 space-y-6">
        <ConnectionsSection userId={currentUserId} currentUserId={currentUserId} perfilAtletaId={perfilAtivo?.id} />
      </main>

      <CarreiraBottomNav currentUserId={currentUserId} profileSlug={mySlug} />
    </div>
  );
}
