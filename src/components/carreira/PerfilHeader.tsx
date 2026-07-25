import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, MapPin, Share2, Trophy, User, Pencil, Instagram, UserPlus, UserCheck, ShieldCheck, Footprints, Crown, Settings } from 'lucide-react';
import { PerfilAtleta, useUpdatePerfilAtleta, uploadProfilePhoto, useIsFollowing, useToggleFollow } from '@/hooks/useCarreiraData';
import { useCarreiraExperiencias } from '@/hooks/useCarreiraExperienciasData';
import { useCarreiraPlano } from '@/hooks/useCarreiraPlano';
import { ConectarButton } from './ConectarButton';
import { ConexoesCount } from './ConexoesCount';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function calcularCategoria(dataNascimento: string): string {
  const birthYear = new Date(dataNascimento).getFullYear();
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  return `Sub ${age}`;
}
import { toast } from 'sonner';
import { EditPerfilDialog } from './EditPerfilDialog';
import { EditConfiguracoesDialog } from './EditConfiguracoesDialog';
import { CompartilharPerfilDialog } from './CompartilharPerfilDialog';

function TorcedoresCount({ perfilId }: { perfilId: string }) {
  const { data: count } = useQuery({
    queryKey: ['torcedores-count', perfilId],
    queryFn: async () => {
      const { count } = await supabase
        .from('atleta_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_perfil_id', perfilId);
      return count || 0;
    },
  });
  return <span><strong className="text-foreground">{count ?? 0}</strong> torcedores</span>;
}

interface PerfilHeaderProps {
  perfil: PerfilAtleta;
  isOwner?: boolean;
}

export function PerfilHeader({ perfil, isOwner = false }: PerfilHeaderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updatePerfil = useUpdatePerfilAtleta();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  // Fallback to direct Supabase auth for Carreira-only users
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setSessionUserId(session.user.id);
    });
  }, []);
  const effectiveUserId = user?.id || sessionUserId;
  const { data: isFollowing } = useIsFollowing(perfil.id);
  const toggleFollow = useToggleFollow();
  const { data: experiencias } = useCarreiraExperiencias(perfil.crianca_id);
  const { temAcesso, plano } = useCarreiraPlano(perfil.crianca_id || null);

  // Auto-calculate athlete status from current experience
  const atletaStatusInfo = (() => {
    if (!experiencias?.length) return null;
    const currentExp = experiencias.find(exp => exp.atual);
    if (!currentExp || !currentExp.tipo_instituicao) return null;
    if (currentExp.tipo_instituicao === 'clube_federado') {
      return { label: 'Atleta federado', clubName: currentExp.nome_escola };
    }
    if (currentExp.tipo_instituicao === 'escolinha') return { label: 'Atleta em formação', clubName: null };
    return null;
  })();

  const PE_LABELS: Record<string, string> = {
    direito: 'Pé direito',
    esquerdo: 'Pé esquerdo',
    ambidestro: 'Ambidestro',
  };

  // Fetch child's birth date to calculate category dynamically
  const { data: criancaData } = useQuery({
    queryKey: ['crianca-nascimento', perfil.crianca_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('criancas')
        .select('data_nascimento')
        .eq('id', perfil.crianca_id!)
        .single();
      return data;
    },
    enabled: !!perfil.crianca_id,
  });

  const categoriaDisplay = criancaData?.data_nascimento
    ? calcularCategoria(criancaData.data_nascimento)
    : perfil.categoria;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveUserId) return;
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.heic')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadProfilePhoto(file, effectiveUserId);
      // Optimistic update: reflect photo immediately in cache
      queryClient.setQueryData(['perfil-atleta', perfil.slug], (old: any) =>
        old ? { ...old, foto_url: url } : old
      );
      queryClient.setQueryData(['meu-perfil-atleta', user.id], (old: any) =>
        old ? { ...old, foto_url: url } : old
      );
      // Also update the page-level cache key used by CarreiraPerfilPage
      queryClient.setQueryData(['carreira-profile-by-slug', perfil.slug], (old: any) =>
        old ? { ...old, foto_url: url } : old
      );
      await updatePerfil.mutateAsync({ id: perfil.id, foto_url: url });
    } catch (error: any) {
      toast.error('Erro ao atualizar foto: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const [shareOpen, setShareOpen] = useState(false);

  const handleFollow = () => {
    if (!user) { toast.error('Faça login para seguir'); return; }
    toggleFollow.mutate({ perfilId: perfil.id, isFollowing: !!isFollowing });
  };

  const modalidades = perfil.modalidades?.length > 0 ? perfil.modalidades : [perfil.modalidade];

  return (
    <>
      <Card className="overflow-hidden" style={{ borderColor: `${perfil.cor_destaque || '#3b82f6'}50`, borderWidth: 2 }}>
        {/* Banner */}
        {perfil.banner_url && (
          <div className="h-28 sm:h-36 w-full overflow-hidden">
            <img src={perfil.banner_url} alt="Banner" className="w-full h-full object-cover" />
          </div>
        )}
        <CardContent className={`p-4 sm:p-5 ${perfil.banner_url ? '-mt-10' : ''}`}>
          {/* === TOP: Avatar + core info side by side === */}
          <div className="flex items-start gap-4 sm:gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <Avatar 
                className="w-24 h-24 sm:w-28 sm:h-28 border-3 shadow-lg ring-2"
                style={{ borderColor: `${perfil.cor_destaque || '#3b82f6'}33`, boxShadow: `0 0 0 2px ${perfil.cor_destaque || '#3b82f6'}22` }}>
                {perfil.foto_url ? <AvatarImage src={perfil.foto_url} alt={perfil.nome} className="object-cover" /> : null}
                <AvatarFallback className="text-2xl"><User className="w-10 h-10" /></AvatarFallback>
              </Avatar>
              {isOwner && (
                <>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="absolute bottom-0 right-0 text-white rounded-full p-1.5 shadow-lg hover:opacity-90 transition-colors"
                    style={{ backgroundColor: perfil.cor_destaque || '#3b82f6' }}>
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" onChange={handlePhotoUpload} className="hidden" />
                </>
              )}
            </div>

            {/* Core info next to avatar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 
                  className="text-base sm:text-lg font-bold text-foreground leading-tight"
                  style={perfil.banner_url ? { textShadow: '0 1px 4px rgba(0,0,0,0.7), 0 0px 2px rgba(0,0,0,0.5)' } : undefined}
                >
                  {perfil.nome}
                </h1>
              </div>
              {temAcesso('selo_elite') ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 w-fit">
                  <Crown className="w-3 h-3" /> Elite
                </span>
              ) : plano !== 'base' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 w-fit">
                  <Trophy className="w-3 h-3" /> Competidor
                </span>
              )}
              
              {categoriaDisplay && (
                <p className="text-xs font-medium mt-0.5" style={{ color: perfil.cor_destaque || '#3b82f6' }}>
                  Atleta {categoriaDisplay}
                </p>
              )}
              {perfil.crianca_id && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Perfil administrado pelo responsável</span>
                </div>
              )}

              {/* Status + badges */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {atletaStatusInfo && (
                  <Badge variant="outline" className="gap-1 text-xs font-semibold"
                    style={{ borderColor: perfil.cor_destaque || '#3b82f6', color: perfil.cor_destaque || '#3b82f6' }}>
                    <ShieldCheck className="w-3 h-3" />
                    {atletaStatusInfo.label}
                    {atletaStatusInfo.clubName && ` • ${atletaStatusInfo.clubName}`}
                  </Badge>
                )}
                {modalidades.map((mod, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1 text-xs"
                    style={{ backgroundColor: `${perfil.cor_destaque || '#3b82f6'}18`, color: perfil.cor_destaque || '#3b82f6', borderColor: `${perfil.cor_destaque || '#3b82f6'}30` }}>
                    <Trophy className="w-3 h-3" />{mod}
                  </Badge>
                ))}
              </div>

              {/* Position + foot */}
              {(perfil.posicao_principal || perfil.pe_dominante) && (
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {perfil.posicao_principal && (
                    <span className="flex items-center gap-1">
                      <Footprints className="w-3 h-3" />
                      {perfil.posicao_principal}
                      {perfil.posicao_secundaria && ` / ${perfil.posicao_secundaria}`}
                    </span>
                  )}
                  {perfil.pe_dominante && (
                    <span>• {PE_LABELS[perfil.pe_dominante] || perfil.pe_dominante}</span>
                  )}
                </div>
              )}

              {(perfil.cidade || perfil.estado) && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                  <MapPin className="w-3 h-3" />
                  <span>{[perfil.cidade, perfil.estado].filter(Boolean).join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          {/* === FULL-WIDTH SEPARATOR === */}
          <div className="mt-3 -mx-4 sm:-mx-5 border-t-2" style={{ borderColor: `${perfil.cor_destaque || '#3b82f6'}40` }} />

          {/* === BOTTOM: Full-width centered content === */}
          <div className="mt-3 flex flex-col items-center text-center">
            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{perfil.followers_count || 0}</strong> seguidores</span>
              <ConexoesCount userId={perfil.user_id} />
              <TorcedoresCount perfilId={perfil.id} />
            </div>

            {perfil.bio && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{perfil.bio}</p>}

            {(perfil as any).instagram_url && (
              <a href={(perfil as any).instagram_url.startsWith('http') ? (perfil as any).instagram_url : `https://instagram.com/${(perfil as any).instagram_url.replace('@', '')}`}
                target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline">
                <Instagram className="w-3.5 h-3.5" />
                {(perfil as any).instagram_url.includes('instagram.com') 
                  ? '@' + (perfil as any).instagram_url.split('/').filter(Boolean).pop()
                  : (perfil as any).instagram_url.startsWith('@') ? (perfil as any).instagram_url : '@' + (perfil as any).instagram_url}
              </a>
            )}

            {/* Actions */}
            <div className="flex gap-1.5 mt-3 flex-wrap justify-center">
              {isOwner && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => setEditDialogOpen(true)}
                    style={{ borderColor: `${perfil.cor_destaque || '#3b82f6'}50`, color: perfil.cor_destaque || '#3b82f6' }}
                  >
                    <Pencil className="w-3 h-3 mr-1" />Editar perfil
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => setConfigDialogOpen(true)}
                    style={{ borderColor: `${perfil.cor_destaque || '#3b82f6'}50`, color: perfil.cor_destaque || '#3b82f6' }}
                  >
                    <Settings className="w-3 h-3 mr-1" />Configurações
                  </Button>
                </>
              )}

              {!isOwner && user && (
                <>
                  <ConectarButton targetUserId={perfil.user_id} currentUserId={user.id} />
                  <Button size="sm" className="h-7 text-xs px-2.5" variant={isFollowing ? 'outline' : 'default'}
                    onClick={handleFollow} disabled={toggleFollow.isPending}
                    style={!isFollowing ? { backgroundColor: perfil.cor_destaque || undefined } : undefined}>
                    {isFollowing ? <><UserCheck className="w-3 h-3 mr-1" />Seguindo</> : <><UserPlus className="w-3 h-3 mr-1" />Seguir</>}
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => setShareOpen(true)}
                style={{ borderColor: `${perfil.cor_destaque || '#3b82f6'}50`, color: perfil.cor_destaque || '#3b82f6' }}>
                <Share2 className="w-3 h-3 mr-1" />Compartilhar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isOwner && <EditPerfilDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} perfil={perfil} />}
      {isOwner && <EditConfiguracoesDialog open={configDialogOpen} onOpenChange={setConfigDialogOpen} perfil={perfil} />}
      <CompartilharPerfilDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        ownerUserId={perfil.user_id}
        atletaNome={perfil.nome}
        atletaSlug={perfil.slug}
        accentColor={perfil.cor_destaque || undefined}
      />
    </>
  );
}
