import { useParams, Link, useNavigate } from 'react-router-dom';
import { useIsFollowing, useToggleFollow, useEscolinhasCarreira, usePostsRede } from '@/hooks/useCarreiraData';

import { PerfilHeader } from '@/components/carreira/PerfilHeader';
import { CarreiraTimeline } from '@/components/carreira/CarreiraTimeline';
import { ConexoesCount } from '@/components/carreira/ConexoesCount';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';
import { PerfilLayout } from '@/components/carreira/perfis/PerfilLayout';
import { DadosEspecificos } from '@/components/carreira/perfis/DadosEspecificos';
import { CreatePostForm } from '@/components/carreira/CreatePostForm';
import { PostCard } from '@/components/carreira/PostCard';
import { EditPerfilRedeDialog } from '@/components/carreira/EditPerfilRedeDialog';
import { EditPerfilDialog } from '@/components/carreira/EditPerfilDialog';
// EditContaDialog removed — unified into EditPerfilRedeDialog
import { ConectarButton } from '@/components/carreira/ConectarButton';
import { MigrarPerfilBanner } from '@/components/carreira/MigrarPerfilBanner';
import { GamificacaoHeroCard } from '@/components/carreira/GamificacaoHeroCard';
import { FansSection } from '@/components/carreira/FansSection';
import { AssinaturaExpiryReminder } from '@/components/carreira/AssinaturaExpiryReminder';
import { NotificacoesBell } from '@/components/carreira/NotificacoesBell';
import { CarreiraPushAutoSubscribe } from '@/components/carreira/CarreiraPushAutoSubscribe';
import { TutorialAutoShow } from '@/components/carreira/TutorialAutoShow';
import { CarreiraThemeToggle } from '@/components/carreira/CarreiraThemeToggle';
import { PeneirasSection } from '@/components/carreira/PeneirasSection';

import { DescobrirAtletasSection } from '@/components/carreira/DescobrirAtletasSection';
import { CompartilharPerfilDialog } from '@/components/carreira/CompartilharPerfilDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, UserX, MapPin, Trophy, Share2, User, UserPlus, UserCheck, Users, Copy, Check, Search, School, X, LogOut, Pencil, Instagram, Globe, Phone, Eye, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSEO } from '@/hooks/useSEO';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import logoCarreira from '@/assets/logo-carreira-id-dark.png';
import { carreiraPath, isCarreiraDomain } from '@/hooks/useCarreiraBasePath';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { useCarreiraRanking } from '@/hooks/useCarreiraRanking';
import { useAnonymousGate } from '@/hooks/useAnonymousGate';
import { LockedSection } from '@/components/carreira/AnonymousFeedCTA';

const TYPE_LABELS: Record<string, string> = {
  professor: 'Professor',
  tecnico: 'Técnico',
  dono_escola: 'Escola de Esportes',
  preparador_fisico: 'Preparador Físico',
  empresario: 'Empresário',
  influenciador: 'Influenciador',
  pai_responsavel: 'Atleta',
  scout: 'Scout',
  agente_clube: 'Agente de Clube',
  fotografo: 'Fotógrafo',
  torcedor: 'Torcedor',
};

function useSuggestionsForProfile(userId?: string | null) {
  return useQuery({
    queryKey: ['profile-suggestions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data: existing } = await supabase
        .from('rede_conexoes')
        .select('solicitante_id, destinatario_id')
        .or(`solicitante_id.eq.${userId},destinatario_id.eq.${userId}`);
      const connectedIds = new Set(
        (existing || []).flatMap(c => [c.solicitante_id, c.destinatario_id])
      );
      connectedIds.add(userId);

      // Get suggestions from both perfis_rede and perfil_atleta
      const { data: redeData } = await supabase
        .from('perfis_rede')
        .select('id, user_id, nome, tipo, foto_url')
        .limit(30);
      const { data: atletaData } = await supabase
        .from('perfil_atleta')
        .select('id, user_id, nome, foto_url, slug, modalidade')
        .eq('is_public', true)
        .limit(20);

      const redeProfiles = (redeData || []).filter(p => !connectedIds.has(p.user_id)).map(p => ({ ...p, source: 'rede' as const }));
      const atletaProfiles = (atletaData || []).filter(p => !connectedIds.has(p.user_id)).map(p => ({ ...p, tipo: 'Atleta', source: 'atleta' as const }));

      // Merge and deduplicate by user_id
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const p of [...redeProfiles, ...atletaProfiles]) {
        if (!seen.has(p.user_id)) {
          seen.add(p.user_id);
          merged.push(p);
        }
      }
      return merged.slice(0, 5);
    },
    enabled: !!userId,
  });
}

function useConnectionsList(userId?: string) {
  return useQuery({
    queryKey: ['profile-connections-list', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('rede_conexoes')
        .select('solicitante_id, destinatario_id')
        .or(`solicitante_id.eq.${userId},destinatario_id.eq.${userId}`)
        .eq('status', 'aceita');
      if (error) throw error;
      const connectedUserIds = (data || []).map(c =>
        c.solicitante_id === userId ? c.destinatario_id : c.solicitante_id
      );
      if (connectedUserIds.length === 0) return [];

      // Query both tables
      const { data: redeProfiles } = await supabase
        .from('perfis_rede')
        .select('id, user_id, nome, tipo, foto_url')
        .in('user_id', connectedUserIds);
      const { data: atletaProfiles } = await supabase
        .from('perfil_atleta')
        .select('id, user_id, nome, foto_url, slug')
        .eq('is_public', true)
        .in('user_id', connectedUserIds);

      const seen = new Set<string>();
      const merged: any[] = [];
      for (const p of (redeProfiles || [])) {
        if (!seen.has(p.user_id)) { seen.add(p.user_id); merged.push(p); }
      }
      for (const p of (atletaProfiles || [])) {
        if (!seen.has(p.user_id)) { seen.add(p.user_id); merged.push({ ...p, tipo: 'Atleta' }); }
      }
      return merged;
    },
    enabled: !!userId,
  });
}

// Search hook for people across the network
function useSearchPeople(query: string) {
  return useQuery({
    queryKey: ['search-people', query],
    queryFn: async () => {
      if (!query || query.length < 2) return { rede: [] as any[], atletas: [] as any[] };
      const searchTerm = `%${query}%`;
      
      // Search in perfil_atleta
      const { data: atletaResults } = await supabase
        .from('perfil_atleta')
        .select('id, user_id, nome, foto_url, slug, modalidade, categoria')
        .eq('is_public', true)
        .ilike('nome', searchTerm)
        .limit(10);

      // Collect user_ids already covered by athlete profiles to avoid duplicates
      const atletaUserIds = new Set((atletaResults || []).map((a: any) => a.user_id));

      // Search in perfis_rede by name
      const { data: redeByName } = await supabase
        .from('perfis_rede')
        .select('id, user_id, nome, tipo, foto_url, slug, dados_perfil')
        .ilike('nome', searchTerm)
        .limit(15);

      // Also fetch dono_escola profiles broadly to match escola name client-side
      const { data: redeEscolas } = await supabase
        .from('perfis_rede')
        .select('id, user_id, nome, tipo, foto_url, slug, dados_perfil')
        .eq('tipo', 'dono_escola')
        .limit(50);

      // Merge and deduplicate
      const redeMap = new Map<string, any>();
      (redeByName || []).forEach((r: any) => redeMap.set(r.id, r));

      // Client-side filter escola names
      const lowerQuery = query.toLowerCase();
      (redeEscolas || []).forEach((r: any) => {
        if (redeMap.has(r.id)) return;
        const nomeEscola = r.dados_perfil?.nome_escola || '';
        if (nomeEscola.toLowerCase().includes(lowerQuery)) {
          redeMap.set(r.id, r);
        }
      });

      // Filter out rede profiles that already have an athlete profile (same user_id)
      const filteredRede = Array.from(redeMap.values()).filter((r: any) => !atletaUserIds.has(r.user_id)).slice(0, 10);

      return {
        rede: filteredRede,
        atletas: atletaResults || [],
      };
    },
    enabled: query.length >= 2,
  });
}

// Unified profile type that works for both perfil_atleta and perfis_rede
type UnifiedProfile = {
  type: 'atleta' | 'rede';
  // Common fields
  id: string;
  user_id: string;
  slug: string;
  nome: string;
  foto_url: string | null;
  bio: string | null;
  // Atleta-specific
  banner_url?: string | null;
  modalidade?: string;
  modalidades?: string[] | null;
  categoria?: string | null;
  cidade?: string | null;
  estado?: string | null;
  instagram_url?: string | null;
  cor_destaque?: string | null;
  is_public?: boolean;
  crianca_id?: string | null;
  followers_count?: number;
  conexoes_count?: number;
  created_at?: string;
  updated_at?: string;
  // Rede-specific
  tipo?: string;
  instagram?: string | null;
  site?: string | null;
  telefone_whatsapp?: string | null;
  whatsapp_publico?: boolean;
  dados_perfil?: Record<string, any> | null;
  // Theme
  tema?: string | null;
};

function useProfileBySlug(slug: string) {
  return useQuery({
    queryKey: ['carreira-profile-by-slug', slug],
    queryFn: async () => {
      if (!slug) return null;

      // Get current user to allow owners to see their own private profiles
      const { data: { session } } = await supabase.auth.getSession();
      const currentUid = session?.user?.id ?? null;

      // 1. Try perfil_atleta — public profiles first
      const { data: atletaData, error: atletaError } = await supabase
        .from('perfil_atleta')
        .select('*')
        .eq('slug', slug)
        .eq('is_public', true)
        .maybeSingle();
      if (atletaError && atletaError.code !== 'PGRST116') throw atletaError;
      if (atletaData) return { type: 'atleta' as const, ...atletaData } as UnifiedProfile;

      // 1b. If not found as public, try without is_public filter for the owner
      if (currentUid) {
        const { data: ownAtleta, error: ownError } = await supabase
          .from('perfil_atleta')
          .select('*')
          .eq('slug', slug)
          .eq('user_id', currentUid)
          .maybeSingle();
        if (ownError && ownError.code !== 'PGRST116') throw ownError;
        if (ownAtleta) return { type: 'atleta' as const, ...ownAtleta } as UnifiedProfile;
      }

      // 2. Try perfis_rede
      const { data: redeData, error: redeError } = await supabase
        .from('perfis_rede')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (redeError && redeError.code !== 'PGRST116') throw redeError;
      if (redeData) {
        // If this is a pai_responsavel rede profile, prefer the user's perfil_atleta when it exists.
        // perfil_atleta is the source of truth (jornada, histórico, etc.); perfis_rede pai_responsavel
        // is a legacy duplicate that breaks the timeline.
        if ((redeData as any).tipo === 'pai_responsavel' && (redeData as any).user_id) {
          const { data: atletaDoUser } = await supabase
            .from('perfil_atleta')
            .select('*')
            .eq('user_id', (redeData as any).user_id)
            .maybeSingle();
          if (atletaDoUser) return { type: 'atleta' as const, ...atletaDoUser } as UnifiedProfile;
        }
        return { type: 'rede' as const, ...redeData } as UnifiedProfile;
      }

      return null;

    },
    enabled: !!slug,
  });
}

export default function CarreiraPerfilPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: perfil, isLoading, error } = useProfileBySlug(slug || '');

  useSEO({
    title: perfil
      ? (perfil.type === 'atleta'
          ? `${perfil.nome}${(perfil as any).modalidade ? ` - ${(perfil as any).modalidade}` : ''} | CARREIRA ID`
          : `${perfil.nome} | CARREIRA ID`)
      : 'Perfil de Atleta | CARREIRA ID',
    description: perfil
      ? (perfil.type === 'atleta'
          ? [
              (perfil as any).modalidade,
              [(perfil as any).cidade, (perfil as any).estado].filter(Boolean).join('/'),
              (perfil as any).bio,
            ].filter(Boolean).join(' — ') || `Perfil esportivo de ${perfil.nome} no CARREIRA ID.`
          : ((perfil as any).bio || `Perfil de ${perfil.nome} na rede CARREIRA ID.`))
      : 'Veja a trajetória esportiva documentada no CARREIRA ID.',
    path: perfil?.slug ? `/${perfil.slug}` : undefined,
    image: (perfil as any)?.foto_url || undefined,
    type: 'profile',
    noindex: perfil ? (perfil as any).is_public === false : false,
    jsonLd: perfil ? {
      '@type': 'Person',
      name: perfil.nome,
      url: `https://carreiraid.com.br/${perfil.slug}`,
      image: (perfil as any).foto_url || undefined,
      description: perfil.type === 'atleta' ? (perfil as any).modalidade : undefined,
      address: (perfil as any).cidade ? {
        '@type': 'PostalAddress',
        addressLocality: (perfil as any).cidade,
        addressRegion: (perfil as any).estado,
        addressCountry: 'BR',
      } : undefined,
    } : undefined,
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { theme: carreiraTheme, isDarkTheme, setDarkTheme } = useCarreiraTheme();
  const isOwner = !!(currentUserId && perfil && currentUserId === perfil.user_id);
  const isAnonymous = !currentUserId;
  const { trackProfileView, requireAuth } = useAnonymousGate();
  const [mySlug, setMySlug] = useState<string | null>(null);

  // Track profile view for anonymous visitors (drives gating after N profiles)
  useEffect(() => {
    if (isAnonymous && perfil?.slug) trackProfileView(perfil.slug);
  }, [isAnonymous, perfil?.slug, trackProfileView]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) {
        // Fetch my slug for bottom nav
        const { data: pa } = await supabase.from('perfil_atleta').select('slug').eq('user_id', uid).maybeSingle();
        const { data: pr } = await supabase.from('perfis_rede').select('slug').eq('user_id', uid).maybeSingle();
        setMySlug(pa?.slug || pr?.slug || null);
      }
    });
  }, []);

  const { data: suggestions } = useSuggestionsForProfile(currentUserId);
  const { data: connections } = useConnectionsList(perfil?.user_id);
  const { data: escolinhas } = useEscolinhasCarreira(perfil?.type === 'atleta' ? perfil?.crianca_id : undefined);
  const { data: searchResults } = useSearchPeople(searchQuery);
  const { data: ligaRanking } = useCarreiraRanking(20);

  // Track profile view (like LinkedIn) — only for non-owner visits on atleta profiles
  useEffect(() => {
    if (!currentUserId || !perfil || isOwner || perfil.type !== 'atleta') return;
    const trackView = async () => {
      // Get viewer info from both tables, prioritizing perfis_rede for identity
      const { data: viewerRede } = await supabase
        .from('perfis_rede')
        .select('tipo, nome, foto_url')
        .eq('user_id', currentUserId)
        .maybeSingle();
      const { data: viewerAtleta } = await supabase
        .from('perfil_atleta')
        .select('nome, foto_url')
        .eq('user_id', currentUserId)
        .maybeSingle();
      
      const viewerFoto = viewerRede?.foto_url || viewerAtleta?.foto_url || null;
      const viewerNome = viewerRede?.nome || viewerAtleta?.nome || null;
      
      const resolvedViewerTipo = viewerAtleta ? 'atleta' : (viewerRede?.tipo === 'pai_responsavel' ? 'atleta' : viewerRede?.tipo || null);
      
      await supabase.from('perfil_visualizacoes').upsert({
        perfil_atleta_id: perfil.id,
        viewer_user_id: currentUserId,
        viewer_tipo: resolvedViewerTipo,
        viewer_nome: viewerNome,
        viewer_foto_url: viewerFoto,
        viewed_date: new Date().toISOString().split('T')[0],
      }, { onConflict: 'perfil_atleta_id,viewer_user_id,viewed_date' });
    };
    trackView();
  }, [currentUserId, perfil?.id, isOwner]);

  const { data: criancaSidebar } = useQuery({
    queryKey: ['crianca-nascimento', perfil?.crianca_id],
    queryFn: async () => {
      const { data } = await supabase.from('criancas').select('data_nascimento').eq('id', perfil!.crianca_id!).single();
      return data;
    },
    enabled: !!perfil?.crianca_id,
  });

  // Pending connection requests (only for own profile)
  const { data: pendingRequests } = useQuery({
    queryKey: ['pending-connection-requests-sidebar', currentUserId],
    queryFn: async () => {
      if (!currentUserId || !isOwner) return [];
      const { data, error } = await supabase
        .from('rede_conexoes')
        .select('id, solicitante_id')
        .eq('destinatario_id', currentUserId)
        .eq('status', 'pendente');
      if (error) throw error;
      if (!data || data.length === 0) return [];
      const senderIds = data.map(r => r.solicitante_id);
      const { data: redeP } = await supabase.from('perfis_rede').select('id, user_id, nome, tipo, foto_url').in('user_id', senderIds);
      const { data: atletaP } = await supabase.from('perfil_atleta').select('id, user_id, nome, foto_url, slug').eq('is_public', true).in('user_id', senderIds);
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const p of (redeP || [])) { if (!seen.has(p.user_id)) { seen.add(p.user_id); merged.push(p); } }
      for (const p of (atletaP || [])) { if (!seen.has(p.user_id)) { seen.add(p.user_id); merged.push({ ...p, tipo: 'Atleta' }); } }
      return merged.map(p => ({ ...p, connectionId: data.find(r => r.solicitante_id === p.user_id)?.id }));
    },
    enabled: !!currentUserId && isOwner,
  });

  // Profile views (who viewed my profile - like LinkedIn) — enriched with fresh photos
  const { data: profileViews } = useQuery({
    queryKey: ['profile-views', perfil?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfil_visualizacoes')
        .select('*')
        .eq('perfil_atleta_id', perfil!.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Enrich with fresh photos from perfis_rede and perfil_atleta
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

      // Deduplicate by viewer_user_id (keep most recent)
      const seen = new Set<string>();
      const unique = data.filter(v => {
        if (seen.has(v.viewer_user_id)) return false;
        seen.add(v.viewer_user_id);
        return true;
      });

      return unique.map(view => {
        const rede = redeMap.get(view.viewer_user_id);
        const atleta = atletaMap.get(view.viewer_user_id);
        // If user has perfil_atleta, show as "Atleta"; otherwise use rede tipo
        const resolvedTipo = atleta ? 'atleta' : (rede?.tipo === 'pai_responsavel' ? 'atleta' : rede?.tipo || view.viewer_tipo);
        return {
          ...view,
          viewer_foto_url: rede?.foto_url || atleta?.foto_url || view.viewer_foto_url,
          viewer_nome: rede?.nome || atleta?.nome || view.viewer_nome,
          viewer_tipo: resolvedTipo,
        };
      });
    },
    enabled: !!perfil?.id && perfil?.type === 'atleta',
  });

  const handleAcceptRequest = async (connectionId: string) => {
    const { error } = await supabase.from('rede_conexoes').update({ status: 'aceita' } as any).eq('id', connectionId);
    if (error) toast.error('Erro ao aceitar');
    else {
      toast.success('Conexão aceita!');
      queryClient.invalidateQueries({ queryKey: ['pending-connection-requests-sidebar'] });
      queryClient.invalidateQueries({ queryKey: ['profile-connections-list'] });
      queryClient.invalidateQueries({ queryKey: ['conexao-status'] });
      queryClient.invalidateQueries({ queryKey: ['connections-count'] });
      queryClient.invalidateQueries({ queryKey: ['user-connections'] });
      queryClient.invalidateQueries({ queryKey: ['my-connections-accepted'] });
      queryClient.invalidateQueries({ queryKey: ['conexoes-count'] });
      queryClient.invalidateQueries({ queryKey: ['pending-connections-count'] });
    }
  };

  const handleRejectRequest = async (connectionId: string) => {
    const { error } = await supabase.from('rede_conexoes').delete().eq('id', connectionId);
    if (error) toast.error('Erro ao recusar');
    else {
      toast.success('Solicitação recusada');
      queryClient.invalidateQueries({ queryKey: ['pending-connection-requests-sidebar'] });
    }
  };

  const queryClient = useQueryClient();
  const handleConnect = async (targetUserId: string) => {
    if (!currentUserId) return;
    setConnectingId(targetUserId);
    try {
      const { error } = await supabase.from('rede_conexoes').insert({
        solicitante_id: currentUserId,
        destinatario_id: targetUserId,
        status: 'pendente',
      } as any);
      if (error) throw error;
      toast.success('Solicitação enviada!');
      queryClient.invalidateQueries({ queryKey: ['profile-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['connection-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['conexao-status'] });
      queryClient.invalidateQueries({ queryKey: ['profile-connections-list'] });
    } catch {
      toast.error('Erro ao conectar');
    }
    setConnectingId(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-theme={carreiraTheme}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !perfil) {
    return (
      <div className="min-h-screen bg-background" data-theme={carreiraTheme}>
        <div className="container py-20 text-center">
          <UserX className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Perfil não encontrado</h1>
          <p className="text-muted-foreground mb-6">
            Este perfil não existe ou não está disponível publicamente.
          </p>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao início
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const accentColor = perfil.type === 'rede'
    ? ((perfil.dados_perfil as any)?.cor_destaque || '#3b82f6')
    : (perfil.cor_destaque || '#3b82f6');
  const modalidades = perfil.type === 'atleta'
    ? (perfil.modalidades?.length ? perfil.modalidades : [perfil.modalidade || 'Futebol'])
    : [];
  const isRedeProfile = perfil.type === 'rede';
  const isDonoEscolaProfile = isRedeProfile && perfil.tipo === 'dono_escola';
  const displayProfileName = isDonoEscolaProfile
    ? (String(perfil.dados_perfil?.nome_escola || perfil.nome || '').trim() || perfil.nome)
    : perfil.nome;
  const modalidadesRede = isDonoEscolaProfile && Array.isArray(perfil.dados_perfil?.modalidades)
    ? perfil.dados_perfil.modalidades.filter((item: any): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const unidadesPerfil = isDonoEscolaProfile && Array.isArray(perfil.dados_perfil?.unidades)
    ? perfil.dados_perfil.unidades
    : [];
  const schoolUnitsForConnection = isDonoEscolaProfile
    ? [
        {
          nome: displayProfileName,
          bairro: perfil.dados_perfil?.localizacao || '',
          endereco: perfil.dados_perfil?.endereco || '',
        },
        ...unidadesPerfil.map((u: any, idx: number) => ({
          nome: String(u?.nome || `Unidade ${idx + 1}`).trim(),
          bairro: u?.bairro || '',
          endereco: u?.endereco || '',
        })),
      ].filter((u, idx, arr) =>
        !!u.nome && arr.findIndex(other => other.nome.toLowerCase() === u.nome.toLowerCase()) === idx
      )
    : [];
  const instagramHandle = isRedeProfile
    ? (perfil.instagram || perfil.dados_perfil?.arroba || '').replace(/^@+/, '').trim()
    : '';
  const siteUrl = isRedeProfile
    ? (perfil.site || perfil.dados_perfil?.site || perfil.dados_perfil?.portfolio || '').trim()
    : '';
  const whatsappDigits = isRedeProfile
    ? String(perfil.telefone_whatsapp || '').replace(/\D/g, '')
    : '';
  const whatsappIntl = whatsappDigits
    ? (whatsappDigits.startsWith('55') ? whatsappDigits : `55${whatsappDigits}`)
    : '';

  const formatWhatsAppDisplay = (digits: string) => {
    if (!digits) return '';
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  };

  const sidebarCategoria = criancaSidebar?.data_nascimento
    ? (() => { const age = new Date().getFullYear() - new Date(criancaSidebar.data_nascimento).getFullYear(); return `Sub ${age}`; })()
    : perfil.categoria;
  const rankingDoPerfil = perfil.type === 'atleta'
    ? ligaRanking?.find((entry) => entry.user_id === perfil.user_id)
    : null;
  const topRanking = (ligaRanking || []).slice(0, 5);

  return (
    <div className="min-h-screen bg-background" data-theme={carreiraTheme}>
      {/* Auto-subscribe to push notifications for logged-in users */}
      {isOwner && <CarreiraPushAutoSubscribe />}
      {/* Accent top bar */}
      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

      {/* Header */}
      <header
        className={`sticky top-0 z-50 backdrop-blur-sm shadow-sm border-b ${isDarkTheme ? 'bg-[hsl(0_0%_0%/0.97)]' : 'bg-background/95'}`}
        style={{ borderColor: `${accentColor}40` }}
      >
        {/* Row 1: Logo + Search (desktop inline) + Actions */}
        <div className="container flex items-center justify-between h-14 lg:h-16 px-4 max-w-6xl">
          <Link to={carreiraPath('/feed')} className="flex items-center gap-2 shrink-0">
            <img src={logoCarreira} alt="Carreira" className="h-16 lg:h-20" />
          </Link>

          {/* Search bar — desktop inline */}
          <div className="hidden lg:block flex-1 max-w-xs mx-auto relative">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar pessoas na rede..."
                className="pl-9 pr-8 h-9 text-sm text-foreground placeholder:text-muted-foreground"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
              />
              {searchQuery && (
                <button className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10" onClick={() => { setSearchQuery(''); setSearchOpen(false); }}>
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUserId && (
              <>
                <NotificacoesBell accentColor={accentColor} />
                <CarreiraThemeToggle
                  isDarkTheme={isDarkTheme}
                  onCheckedChange={setDarkTheme}
                  compact
                  className="hidden sm:flex"
                />
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-8 text-xs"
                    style={{ borderColor: `${accentColor}50`, color: accentColor }}
                    onClick={async () => {
                  if (mySlug) {
                    navigate(carreiraPath(`/${mySlug}`));
                  } else {
                    const { data: pa } = await supabase.from('perfil_atleta').select('slug').eq('user_id', currentUserId!).maybeSingle();
                    const { data: pr } = await supabase.from('perfis_rede').select('slug').eq('user_id', currentUserId!).maybeSingle();
                    const foundSlug = pa?.slug || pr?.slug;
                    if (foundSlug) navigate(carreiraPath(`/${foundSlug}`));
                    else navigate(carreiraPath(`/perfil/${currentUserId}`));
                  }
                  }}>
                    Meu Perfil
                  </Button>
                  {isOwner && (
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1" style={{ borderColor: `${accentColor}50`, color: accentColor }} onClick={() => setEditDialogOpen(true)}>
                      <Pencil className="w-3 h-3" />
                      <span className="hidden sm:inline">Editar Perfil</span>
                      <span className="sm:hidden">Editar</span>
                    </Button>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="text-muted-foreground hidden sm:flex h-8 text-xs" onClick={async () => {
                  await supabase.auth.signOut();
                  toast.success('Você saiu da sua conta');
                  if (isCarreiraDomain()) {
                    navigate(carreiraPath('/'), { replace: true });
                  } else {
                    navigate('/auth', { replace: true });
                  }
                }}>
                  <LogOut className="w-4 h-4 mr-1" />
                  <span className="hidden md:inline">Sair</span>
                </Button>
              </>
            )}
            {isAnonymous && (
              <>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate('/auth')}>
                  Entrar
                </Button>
                <Button size="sm" className="h-8 text-xs" style={{ backgroundColor: accentColor }} onClick={() => navigate('/cadastro?from=perfil_header')}>
                  <UserPlus className="w-4 h-4 mr-1" />
                  Criar conta
                </Button>
              </>
            )}
          </div>
        </div>
        {/* Row 2: Search bar + theme toggle — mobile only */}
        <div className="lg:hidden container px-4 pb-2 max-w-6xl flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar pessoas na rede..."
              className="pl-9 pr-8 h-9 text-sm w-full text-foreground placeholder:text-muted-foreground"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
            />
            {searchQuery && (
              <button className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10" onClick={() => { setSearchQuery(''); setSearchOpen(false); }}>
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <CarreiraThemeToggle
            isDarkTheme={isDarkTheme}
            onCheckedChange={setDarkTheme}
            compact
          />
        </div>
      </header>

      {/* Search overlay + results — OUTSIDE header to fix z-index stacking */}
      {searchOpen && <div className="fixed inset-0 z-[55]" onClick={() => setSearchOpen(false)} />}
      {searchOpen && searchQuery.length >= 2 && searchResults && (
        <div className="sticky top-[7.5rem] lg:top-16 z-[60] container max-w-6xl px-4">
          <div className="lg:max-w-sm lg:mx-auto relative">
            <Card className="absolute top-0 left-0 right-0 max-h-80 overflow-y-auto p-2 shadow-lg">
              {searchResults.atletas.length === 0 && searchResults.rede.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum resultado encontrado</p>
              ) : (
                <>
                  {searchResults.atletas.map((a) => (
                    <div key={`a-${a.id}`} className="flex items-center gap-3 p-2.5 hover:bg-muted/50 rounded-lg cursor-pointer"
                      onClick={() => { navigate(carreiraPath(`/${a.slug}`)); setSearchOpen(false); setSearchQuery(''); }}>
                      {a.foto_url ? <img src={a.foto_url} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">{a.nome?.[0]}</div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{a.nome}</p>
                        <p className="text-xs text-muted-foreground">{a.modalidade}{a.categoria ? ` • ${a.categoria}` : ''} • Atleta</p>
                      </div>
                    </div>
                  ))}
                  {searchResults.rede.map((r) => {
                    const isDono = r.tipo === 'dono_escola';
                    const nomeEscola = isDono ? (r.dados_perfil?.nome_escola || r.nome) : r.nome;
                    const modalidades = isDono && Array.isArray(r.dados_perfil?.modalidades) ? r.dados_perfil.modalidades : [];
                    return (
                    <div key={`r-${r.id}`} className="flex items-center gap-3 p-2.5 hover:bg-muted/50 rounded-lg cursor-pointer"
                      onClick={() => { navigate(carreiraPath(`/${r.slug || `perfil/${r.user_id}`}`)); setSearchOpen(false); setSearchQuery(''); }}>
                      {r.foto_url ? <img src={r.foto_url} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">{(isDono ? nomeEscola : r.nome)?.[0]}</div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{nomeEscola}</p>
                        <p className="text-xs text-muted-foreground">
                          {isDono ? 'Escola de Esportes' : (TYPE_LABELS[r.tipo] || r.tipo)}
                          {isDono && modalidades.length > 0 ? ` • ${modalidades.join(', ')}` : ''}
                        </p>
                      </div>
                    </div>
                    );
                  })}
                </>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Main Content — 3 columns on desktop */}
      <main className="container max-w-6xl px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-6">
          
          {/* Left Sidebar — Athlete Card */}
          <aside className="hidden lg:block space-y-4">
            <Card className="text-center overflow-hidden" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
              {/* Banner */}
              {perfil.banner_url && (
                <div className="h-20 w-full overflow-hidden">
                  <img src={perfil.banner_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className={`p-4 ${perfil.banner_url ? '-mt-8' : ''}`}>
              {/* Avatar */}
              <Avatar 
                className="w-20 h-20 mx-auto mb-3 ring-2 ring-offset-2 ring-offset-background"
                style={{ '--tw-ring-color': accentColor } as any}
              >
                {perfil.foto_url ? (
                  <AvatarImage src={perfil.foto_url} alt={displayProfileName} className="object-cover" />
                ) : null}
                <AvatarFallback className="text-xl"><User className="w-8 h-8" /></AvatarFallback>
              </Avatar>

              <h2 className="font-bold text-foreground text-sm" style={perfil.banner_url ? { textShadow: '0 1px 4px rgba(0,0,0,0.7), 0 0px 2px rgba(0,0,0,0.5)' } : undefined}>{displayProfileName}</h2>
              
              {/* Athlete subtitle: "Atleta Sub X" + managed by guardian */}
              {!isRedeProfile && sidebarCategoria && (
                <p className="text-xs font-medium mt-0.5" style={{ color: accentColor }}>
                  Atleta {sidebarCategoria}
                </p>
              )}
              {!isRedeProfile && perfil.crianca_id && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Perfil administrado pelo responsável
                </p>
              )}

              {/* Modalities (athlete only) */}
              {modalidades.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1 mt-1.5">
                {modalidades.map((mod, idx) => (
                  <Badge key={idx} variant="secondary" className="text-[10px] gap-0.5"
                    style={{ backgroundColor: `${accentColor}18`, color: accentColor, borderColor: `${accentColor}30` }}>
                    <Trophy className="w-2.5 h-2.5" />{mod}
                  </Badge>
                ))}
              </div>
              )}

              {/* Type label (rede only) */}
              {isRedeProfile && perfil.tipo && (
                <p className="text-xs text-muted-foreground mt-1">{TYPE_LABELS[perfil.tipo] || perfil.tipo}</p>
              )}

              {/* Modalidades tags for escola profile */}
              {isDonoEscolaProfile && modalidadesRede.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1 mt-1.5">
                  {modalidadesRede.map((mod: string) => (
                    <Badge key={mod} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {mod}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Location */}
              {(perfil.cidade || perfil.estado) && (
                <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mt-2">
                  <MapPin className="w-3 h-3" />
                  <span>{[perfil.cidade, perfil.estado].filter(Boolean).join(', ')}</span>
                </div>
              )}

              {/* Bio */}
              {perfil.bio && (
                <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line line-clamp-4">{perfil.bio}</p>
              )}

              {/* Contact links for network profiles */}
              {!isAnonymous && isRedeProfile && (instagramHandle || siteUrl || (perfil.whatsapp_publico && whatsappDigits)) && (
                <div className="mt-3 flex flex-col gap-1.5 text-xs border-t border-border pt-3">
                  {instagramHandle && (
                    <a
                      href={`https://instagram.com/${instagramHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Instagram className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">@{instagramHandle}</span>
                    </a>
                  )}
                  {siteUrl && (
                    <a
                      href={siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{siteUrl.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {perfil.whatsapp_publico && whatsappIntl && (
                    <a
                      href={`https://wa.me/${whatsappIntl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{formatWhatsAppDisplay(whatsappDigits)}</span>
                    </a>
                  )}
                </div>
              )}

              {isAnonymous && isRedeProfile && (instagramHandle || siteUrl || (perfil.whatsapp_publico && whatsappDigits)) && (
                <div className="mt-3 border-t border-border pt-3">
                  <button
                    onClick={() => requireAuth('contact')}
                    className="text-xs text-primary hover:underline"
                  >
                    🔒 Cadastre-se para ver contatos
                  </button>
                </div>
              )}

              {/* Followers & Connections */}
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{perfil.followers_count || 0}</span> seguidores
                </div>
                <ConexoesCount userId={perfil.user_id} />
              </div>

              {/* Actions */}
              <div className="mt-3 space-y-2">
                {isAnonymous && !isOwner && (
                  <>
                    <Button size="sm" className="w-full text-xs h-8" style={{ backgroundColor: accentColor }} onClick={() => requireAuth('connect')}>
                      <UserPlus className="w-3.5 h-3.5 mr-1" />Conectar
                    </Button>
                    <Button size="sm" variant="outline" className="w-full text-xs h-8" style={{ borderColor: `${accentColor}50`, color: accentColor }} onClick={() => requireAuth('follow')}>
                      <UserPlus className="w-3.5 h-3.5 mr-1" />Seguir
                    </Button>
                  </>
                )}

                {!isOwner && currentUserId && !isDonoEscolaProfile && (
                  <ConectarButton targetUserId={perfil.user_id} currentUserId={currentUserId} accentColor={accentColor} />
                )}

                {!isOwner && currentUserId && isDonoEscolaProfile && schoolUnitsForConnection.length > 0 && (
                  <div className="space-y-1.5">
                    {schoolUnitsForConnection.map((unidade, idx) => (
                      <div key={`${unidade.nome}-${idx}`} className="rounded-md border border-border/70 bg-muted/20 p-2">
                        <div className="mb-1 min-w-0 text-left">
                          <p className="text-[11px] font-medium text-foreground truncate">{unidade.nome}</p>
                          {(unidade.bairro || unidade.endereco) && (
                            <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5 shrink-0" />
                              {[unidade.bairro, unidade.endereco].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                        <ConectarButton
                          targetUserId={perfil.user_id}
                          currentUserId={currentUserId}
                          accentColor={accentColor}
                          unidadeNome={unidade.nome}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {!isAnonymous && (
                  <FollowButton perfil={perfil} currentUserId={currentUserId} isOwner={isOwner} />
                )}
                <ShareButton slug={perfil.slug} nome={displayProfileName} accentColor={accentColor} ownerUserId={perfil.user_id} />
              </div>
              </div>
            </Card>

            {/* Escolinhas vinculadas */}
            {escolinhas && escolinhas.length > 0 && (
              <Card className="p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
                <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5" />
                  Escolinhas ({escolinhas.length})
                </h3>
                <div className="space-y-2">
                  {escolinhas.map((esc) => (
                    <div key={esc.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1 -mx-1 transition-colors"
                      onClick={() => esc.slug ? navigate(`/escola/${esc.slug}`) : undefined}>
                      {esc.logo_url ? (
                        <img src={esc.logo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                          {esc.nome?.[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{esc.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{esc.ativo ? 'Ativo' : 'Inativo'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}


            {/* Gamificação — desktop only, athletes only (not scouts/técnicos) */}
            {isOwner && perfil.type === 'atleta' && (
              <GamificacaoHeroCard accentColor={accentColor} />
            )}

          </aside>

          {/* Center — Profile Header (mobile only) + Timeline */}
          <div className="space-y-4">
            {/* Tutorial auto-show for profile owners */}
            {isOwner && <TutorialAutoShow tipoPerfil={perfil.tipo || (perfil.type === 'atleta' ? 'atleta_filho' : undefined)} />}
            {/* Migration banner for pai_responsavel profiles */}
            {isOwner && isRedeProfile && perfil.tipo === 'pai_responsavel' && (
              <MigrarPerfilBanner
                userId={perfil.user_id}
                perfilNome={perfil.nome}
                onMigrated={async () => {
                  // Delete the old perfis_rede profile after migration
                  await supabase
                    .from('perfis_rede')
                    .delete()
                    .eq('user_id', perfil.user_id);

                  const { data } = await supabase
                    .from('perfil_atleta')
                    .select('slug')
                    .eq('user_id', perfil.user_id)
                    .maybeSingle();
                  
                  if (data?.slug) {
                    navigate(carreiraPath(`/${data.slug}`), { replace: true });
                  } else {
                    window.location.reload();
                  }
                }}
              />
            )}
            {/* Expiry reminder for PIX subscriptions */}
            {perfil.type === 'atleta' && isOwner && perfil.crianca_id && (
              <AssinaturaExpiryReminder criancaId={perfil.crianca_id} />
            )}
            {/* Mobile-only: full PerfilHeader */}
            {perfil.type === 'atleta' && (
              <div className="lg:hidden">
                <PerfilHeader perfil={perfil as any} isOwner={isOwner} />
              </div>
            )}
            {perfil.type === 'rede' && (
              <div className="lg:hidden">
                <PerfilLayout
                  perfil={{
                    id: perfil.id,
                    user_id: perfil.user_id,
                    nome: perfil.nome,
                    tipo: perfil.tipo || '',
                    foto_url: perfil.foto_url,
                    bio: perfil.bio,
                    instagram: perfil.instagram || null,
                    dados_perfil: perfil.dados_perfil || null,
                    site: perfil.site || null,
                    telefone_whatsapp: perfil.telefone_whatsapp || null,
                    whatsapp_publico: perfil.whatsapp_publico ?? false,
                  }}
                  isOwnProfile={isOwner}
                  currentUserId={currentUserId}
                  accentColor={accentColor}
                  onEditProfile={isOwner ? () => setEditDialogOpen(true) : undefined}
                />
              </div>
            )}
            {/* Dados Específicos do perfil rede */}
            {perfil.type === 'rede' && (
              <DadosEspecificos
                tipo={perfil.tipo as any}
                dados={perfil.dados_perfil as Record<string, any> | null}
              />
            )}

            {/* Descobrir Atletas — scouting profiles on desktop */}
            {isOwner && perfil.type === 'rede' && (() => {
              const SCOUTING_TYPES = ['tecnico', 'scout', 'agente_clube', 'escola_esportes', 'empresario', 'torcedor'];
              return SCOUTING_TYPES.includes(perfil.tipo || '');
            })() && (
              <Card className="p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
                <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                  <Search className="w-4 h-4" style={{ color: accentColor }} />
                  {perfil.tipo === 'torcedor' ? 'Buscar Atletas' : 'Descobrir Atletas'}
                </h3>
                <DescobrirAtletasSection />
              </Card>
            )}

            {/* Peneiras Section */}
            {isOwner && currentUserId && (
              <PeneirasSection
                userId={currentUserId}
                perfilRedeId={perfil.type === 'rede' ? perfil.id : undefined}
                perfilRedeTipo={perfil.type === 'rede' ? perfil.tipo : undefined}
                accentColor={accentColor}
              />
            )}

            {/* Quem viu este perfil — public, below profile header */}
            {perfil.type === 'atleta' && profileViews && profileViews.length > 0 && (
              <ProfileViewsSection views={profileViews} accentColor={accentColor} navigate={navigate} />
            )}

            {/* Fãs / Torcida — below profile views */}
            {perfil.type === 'atleta' && (
              <FansSection perfilAtletaId={perfil.id} accentColor={accentColor} />
            )}

            {isOwner && pendingRequests && pendingRequests.length > 0 && (
              <div className="lg:hidden">
                <Card className="p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
                   <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                     Solicitações de conexão ({pendingRequests.length})
                  </h3>
                  <div className="space-y-3">
                    {pendingRequests.map((person: any) => (
                      <div key={person.id} className="flex items-center gap-2">
                        {person.foto_url ? (
                          <img src={person.foto_url} alt="" className="w-9 h-9 rounded-full object-cover cursor-pointer"
                            onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))} />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground cursor-pointer"
                            onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))}>
                            {person.nome?.[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{person.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{TYPE_LABELS[person.tipo] || person.tipo}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" className="h-7 text-[10px] px-2 text-white border-0" style={{ backgroundColor: accentColor }} onClick={() => person.connectionId && handleAcceptRequest(person.connectionId)}>
                            <Check className="w-3 h-3 mr-0.5" /> Aceitar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] px-1.5" onClick={() => person.connectionId && handleRejectRequest(person.connectionId)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            
            {perfil.type === 'atleta' ? (
              <CarreiraTimeline perfil={perfil as any} isOwner={isOwner} />
            ) : (
              <RedeTimelineInline perfilId={perfil.id} isOwner={isOwner} perfilNome={perfil.nome} perfilFoto={perfil.foto_url} accentColor={accentColor} />
            )}
          </div>

          {/* Right Sidebar — Pending Requests + Suggestions + Connections */}
          <aside className="hidden lg:block space-y-4">
            {perfil.type === 'atleta' && topRanking.length > 0 && (
              <Card className="p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4" style={{ color: accentColor }} />
                  Ranking da Liga
                </h3>

                {rankingDoPerfil && (
                  <div className="mb-3 rounded-lg border border-border bg-muted/30 p-2">
                    <p className="text-[11px] text-muted-foreground">Posição deste atleta</p>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      #{rankingDoPerfil.position}
                      <span className="text-xs text-muted-foreground">{rankingDoPerfil.nome}</span>
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  {topRanking.map((player) => (
                    <button
                      key={player.user_id}
                      onClick={() => player.slug && navigate(carreiraPath(`/${player.slug}`))}
                      className="w-full flex items-center gap-2 rounded-md p-1.5 hover:bg-muted/40 text-left"
                    >
                      <span className="w-6 text-[11px] font-bold text-muted-foreground">#{player.position}</span>
                      <Avatar className="w-7 h-7">
                        {player.foto_url ? <AvatarImage src={player.foto_url} className="object-cover" /> : null}
                        <AvatarFallback className="text-[9px]"><User className="w-3 h-3" /></AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{player.nome}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: accentColor }}>
                        <Zap className="w-3 h-3" />
                        {player.pontos.toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full text-xs"
                  onClick={() => navigate(carreiraPath('/liga'))}
                  style={{ borderColor: `${accentColor}50`, color: accentColor }}
                >
                  Ver ranking completo
                </Button>
              </Card>
            )}

            {/* Pending connection requests (own profile only) */}
            {isOwner && pendingRequests && pendingRequests.length > 0 && (
              <Card className="p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                  Solicitações ({pendingRequests.length})
                  Solicitações ({pendingRequests.length})
                </h3>
                <div className="space-y-3">
                  {pendingRequests.map((person: any) => (
                    <div key={person.id} className="flex items-center gap-2">
                      {person.foto_url ? (
                        <img src={person.foto_url} alt="" className="w-9 h-9 rounded-full object-cover cursor-pointer"
                           onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))} />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground cursor-pointer"
                          onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))}>

                          {person.nome?.[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{person.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{TYPE_LABELS[person.tipo] || person.tipo}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 text-[10px] px-2" onClick={() => person.connectionId && handleAcceptRequest(person.connectionId)}>
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] px-1" onClick={() => person.connectionId && handleRejectRequest(person.connectionId)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}


            {currentUserId && suggestions && suggestions.length > 0 && (
              <Card className="p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
                <h3 className="text-sm font-semibold text-foreground mb-3">Sugestões para conectar</h3>
                <div className="space-y-3">
                  {suggestions.map((person) => (
                    <div key={person.id} className="flex items-center gap-2">
                      {person.foto_url ? (
                        <img src={person.foto_url} alt="" className="w-9 h-9 rounded-full object-cover cursor-pointer"
                           onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))} />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground cursor-pointer"
                          onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))}>

                          {person.nome?.[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate cursor-pointer hover:underline"
                          onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))}>
                          {person.nome}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{TYPE_LABELS[person.tipo] || person.tipo}</p>
                      </div>
                      <ConectarButton targetUserId={person.user_id} currentUserId={currentUserId} accentColor={accentColor} />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Connected people */}
            {connections && connections.length > 0 && (
              <Card className="p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
                <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                   <Users className="w-3.5 h-3.5" />
                   Conectados ({connections.length})
                </h3>
                <div className="space-y-2">
                  {connections.slice(0, 5).map((person) => (
                    <div key={person.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1 -mx-1 transition-colors"
                      onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))}>
                      {person.foto_url ? (
                        <img src={person.foto_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {person.nome?.[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{person.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{TYPE_LABELS[person.tipo] || person.tipo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className={`border-t mt-12 py-6 pb-20 lg:pb-6 ${isDarkTheme ? 'border-border' : ''}`} style={!isDarkTheme ? { borderColor: `${accentColor}20` } : undefined}>
        <div className="container text-center text-sm text-muted-foreground">
          <p>Carreira Esportiva — Sua trajetória no esporte</p>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <CarreiraBottomNav currentUserId={currentUserId} profileSlug={mySlug} />

      {/* Edit dialog for rede profiles */}
      {isOwner && isRedeProfile && perfil && (
        <EditPerfilRedeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          perfil={perfil}
        />
      )}
      {/* Edit dialog for athlete profiles */}
      {isOwner && !isRedeProfile && perfil && (
        <EditPerfilDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          perfil={perfil as any}
        />
      )}
    </div>
  );
}

/* --- Sub-components --- */

function FollowButton({ perfil, currentUserId, isOwner }: { perfil: any; currentUserId: string | null; isOwner: boolean }) {
  const { data: isFollowing } = useIsFollowing(perfil.id);
  const toggleFollow = useToggleFollow();

  if (isOwner || !currentUserId) return null;

  const handleFollow = () => {
    toggleFollow.mutate({ perfilId: perfil.id, isFollowing: !!isFollowing });
  };

  return (
    <Button size="sm" className="w-full text-xs h-8" variant={isFollowing ? 'outline' : 'default'}
      onClick={handleFollow} disabled={toggleFollow.isPending}
      style={!isFollowing ? { backgroundColor: perfil.cor_destaque || undefined } : undefined}>
      {isFollowing ? <><UserCheck className="w-3.5 h-3.5 mr-1" />Seguindo</> : <><UserPlus className="w-3.5 h-3.5 mr-1" />Seguir</>}
    </Button>
  );
}

function ShareButton({ slug, nome, accentColor, ownerUserId }: { slug: string; nome: string; accentColor?: string; ownerUserId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={() => setOpen(true)}
        style={accentColor ? { borderColor: `${accentColor}50`, color: accentColor } : undefined}>
        <Share2 className="w-3.5 h-3.5 mr-1" />Compartilhar
      </Button>
      <CompartilharPerfilDialog
        open={open}
        onOpenChange={setOpen}
        ownerUserId={ownerUserId}
        atletaNome={nome}
        atletaSlug={slug}
        accentColor={accentColor}
      />
    </>
  );
}

function RedeTimelineInline({ perfilId, isOwner, perfilNome, perfilFoto, accentColor }: { perfilId: string; isOwner: boolean; perfilNome: string; perfilFoto: string | null; accentColor?: string }) {
  const { data: posts, isLoading } = usePostsRede(perfilId);

  return (
    <div className="space-y-4">
      {isOwner && (
        <CreatePostForm perfilRedeId={perfilId} perfilRedeNome={perfilNome} perfilRedeFoto={perfilFoto} accentColor={accentColor} />
      )}
      {isLoading && <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}
      {posts?.map((post) => (
        <PostCard key={post.id} post={post} accentColor={accentColor} />
      ))}
      {!isLoading && (!posts || posts.length === 0) && !isOwner && (
        <p className="text-center text-sm text-muted-foreground py-6">Nenhuma publicação ainda.</p>
      )}
    </div>
  );
}

function ProfileViewsSection({ views, accentColor, navigate }: { views: any[]; accentColor: string; navigate: (path: string) => void }) {
  return (
    <Card className="p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
      <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
        <Eye className="w-3.5 h-3.5" style={{ color: accentColor }} />
        Quem viu este perfil ({views.length})
      </h3>
      <div className="max-h-[120px] overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {views.map((view) => (
            <div key={view.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 transition-colors"
              onClick={() => navigate(carreiraPath(`/perfil/${view.viewer_user_id}`))}>
              {view.viewer_foto_url ? (
                <img src={view.viewer_foto_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  {view.viewer_nome?.[0] || '?'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium truncate max-w-[100px]">{view.viewer_nome || 'Usuário'}</p>
                <p className="text-[10px] text-muted-foreground">{TYPE_LABELS[view.viewer_tipo || ''] || view.viewer_tipo || ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
