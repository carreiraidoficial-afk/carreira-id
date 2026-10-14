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
import { PushPromptBanner } from '@/components/carreira/PushPromptBanner';
import { CarreiraPageHeader } from '@/components/carreira/CarreiraPageHeader';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useCarreiraSession } from '@/hooks/useCarreiraSession';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { useCriancaAtiva, slugDoDono } from '@/hooks/useCriancaAtiva';

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
      <CarreiraPageHeader
        title="Conexões"
        tone="black"
        sticky={false}
        accentColor={accentColor}
        actions={<NotificacoesBell accentColor="#ffffff" />}
      >
        <div className="flex gap-2">
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-white">
            <Users className="h-4 w-4 text-white/70" />
            <span className="text-base font-bold leading-none">{conexoesTotal ?? 0}</span>
            <span className="text-xs text-white/70">Conexões</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-white">
            <Heart className="h-4 w-4 text-white/70" />
            <span className="text-base font-bold leading-none">{torcedoresTotal}</span>
            <span className="text-xs text-white/70">Torcedores</span>
          </div>
        </div>
      </CarreiraPageHeader>

      <main className="container max-w-2xl px-4 py-6 pb-24 space-y-6">
        <PushPromptBanner />
        <ConnectionsSection userId={currentUserId} currentUserId={currentUserId} perfilAtletaId={perfilAtivo?.id} />
      </main>

      <CarreiraBottomNav currentUserId={currentUserId} profileSlug={mySlug} />
    </div>
  );
}
