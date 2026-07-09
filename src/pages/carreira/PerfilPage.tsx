import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Share2, Copy, Check } from 'lucide-react';
import { PerfilLayout } from '@/components/carreira/perfis/PerfilLayout';
import { DadosEspecificos } from '@/components/carreira/perfis/DadosEspecificos';
import { ConnectionsSection } from '@/components/carreira/ConnectionsSection';
import { EditPerfilRedeDialog } from '@/components/carreira/EditPerfilRedeDialog';
import { HistoricoProfissionalSection, type HistoricoProfissional } from '@/components/carreira/HistoricoProfissionalSection';
import { HistoricoProfissionalFormDialog } from '@/components/carreira/HistoricoProfissionalFormDialog';
import { PeneirasSection } from '@/components/carreira/PeneirasSection';

import { MigrarPerfilBanner } from '@/components/carreira/MigrarPerfilBanner';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';
import { CreatePostForm } from '@/components/carreira/CreatePostForm';
import { PostCard } from '@/components/carreira/PostCard';
import { DescobrirAtletasSection } from '@/components/carreira/DescobrirAtletasSection';
import { usePostsRede } from '@/hooks/useCarreiraData';
import logoCarreira from '@/assets/logo-carreira-id-dark.png';
import { TutorialAutoShow } from '@/components/carreira/TutorialAutoShow';
import { useEffect, useState } from 'react';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';

export default function PerfilPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [editingHistorico, setEditingHistorico] = useState<HistoricoProfissional | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
  }, []);

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['perfil-rede', userId],
    queryFn: async () => {
      const { data: redeData, error: redeError } = await supabase
        .from('perfis_rede')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();
      if (redeError) throw redeError;
      if (redeData) return { type: 'rede' as const, data: redeData };

      const { data: atletaData, error: atletaError } = await supabase
        .from('perfil_atleta')
        .select('slug')
        .eq('user_id', userId!)
        .maybeSingle();
      if (atletaError) throw atletaError;
      if (atletaData?.slug) return { type: 'atleta_redirect' as const, slug: atletaData.slug };

      return null;
    },
    enabled: !!userId,
  });

  const { theme: tema, isDarkTheme } = useCarreiraTheme();

  useEffect(() => {
    if (perfil?.type === 'atleta_redirect' && perfil.slug) {
      navigate(carreiraPath(`/${perfil.slug}`), { replace: true });
    }
  }, [perfil, navigate]);

  if (isLoading || perfil?.type === 'atleta_redirect') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-theme={tema}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const redeProfile = perfil?.type === 'rede' ? perfil.data : null;

  if (!redeProfile) {
    return (
      <div className="min-h-screen bg-background" data-theme={tema}>
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
          <div className="container flex items-center h-20 px-4">
            <button onClick={() => navigate(carreiraPath('/feed'))} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              <img src={logoCarreira} alt="Carreira" className="h-24" />
            </button>
          </div>
        </header>
        <main className="container max-w-lg px-4 py-16 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-foreground">Perfil não encontrado</h1>
          <p className="text-sm text-muted-foreground mt-2">Este usuário ainda não criou um perfil na rede.</p>
          <Button className="mt-6" onClick={() => navigate(carreiraPath('/feed'))}>
            Voltar ao Feed
          </Button>
        </main>
      </div>
    );
  }

  const isOwnProfile = currentUserId === redeProfile.user_id;

  const inviteLink = (redeProfile as any).convite_codigo
    ? `${window.location.origin}${carreiraPath('/cadastro')}?convite=${(redeProfile as any).convite_codigo}`
    : '';

  const handleCopyInvite = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success('Link de convite copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background" data-theme={tema}>
      <header className={`sticky top-0 z-50 backdrop-blur border-b ${isDarkTheme ? 'bg-[hsl(220_12%_10%/0.95)] border-[hsl(220_10%_18%)]' : 'bg-background/95'}`}>
        <div className="container flex items-center justify-between h-20 px-4">
          <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate(carreiraPath('/feed'))} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            <img src={logoCarreira} alt="Carreira" className="h-24" />
          </button>
        </div>
      </header>

      <main className="container max-w-lg px-4 py-6">
        {isOwnProfile && <TutorialAutoShow tipoPerfil={redeProfile.tipo} />}
        {isOwnProfile && redeProfile.tipo === 'pai_responsavel' && (
          <div className="mb-4">
            <MigrarPerfilBanner
              userId={redeProfile.user_id}
              perfilNome={redeProfile.nome}
              onMigrated={() => {
                supabase
                  .from('perfil_atleta')
                  .select('slug')
                  .eq('user_id', redeProfile.user_id)
                  .maybeSingle()
                  .then(({ data }) => {
                    if (data?.slug) {
                      navigate(carreiraPath(`/${data.slug}`), { replace: true });
                    } else {
                      window.location.reload();
                    }
                  });
              }}
            />
          </div>
        )}
        <PerfilLayout
          perfil={{
            id: redeProfile.id,
            user_id: redeProfile.user_id,
            nome: redeProfile.nome,
            tipo: redeProfile.tipo,
            foto_url: redeProfile.foto_url,
            bio: redeProfile.bio,
            instagram: redeProfile.instagram,
            dados_perfil: redeProfile.dados_perfil as Record<string, any> | null,
            site: (redeProfile as any).site,
            telefone_whatsapp: (redeProfile as any).telefone_whatsapp,
            whatsapp_publico: (redeProfile as any).whatsapp_publico,
          }}
          isOwnProfile={isOwnProfile}
          currentUserId={currentUserId}
          accentColor={(redeProfile.dados_perfil as any)?.cor_destaque || '#3b82f6'}
          onEditProfile={isOwnProfile ? () => setEditDialogOpen(true) : undefined}
        >
        {(() => {
          const redeAccent = (redeProfile.dados_perfil as any)?.cor_destaque || '#3b82f6';
          const SCOUTING_TYPES = ['tecnico', 'scout', 'agente_clube', 'escola_esportes', 'empresario'];
          const PENEIRA_TYPES = ['tecnico', 'scout', 'agente_clube', 'dono_escola'];
          const showPeneiras = isOwnProfile && PENEIRA_TYPES.includes(redeProfile.tipo);
          const showDescobrir = isOwnProfile && (SCOUTING_TYPES.includes(redeProfile.tipo) || redeProfile.tipo === 'torcedor');
          const NON_HISTORICO_TYPES = ['atleta_filho', 'pai_responsavel', 'influenciador', 'torcedor'];
          const showHistorico = !NON_HISTORICO_TYPES.includes(redeProfile.tipo);
          const historico: HistoricoProfissional[] = (redeProfile.dados_perfil as any)?.historico_profissional || [];

          const handleSaveHistorico = async (item: HistoricoProfissional) => {
            const dados = (redeProfile.dados_perfil || {}) as Record<string, any>;
            const list: HistoricoProfissional[] = dados.historico_profissional || [];
            const idx = list.findIndex(h => h.id === item.id);
            const updated = idx >= 0 ? list.map((h, i) => i === idx ? item : h) : [...list, item];
            updated.sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));

            await supabase.from('perfis_rede').update({
              dados_perfil: { ...dados, historico_profissional: updated },
            } as any).eq('id', redeProfile.id);

            queryClient.invalidateQueries({ queryKey: ['perfil-rede', userId] });
            toast.success(idx >= 0 ? 'Experiência atualizada!' : 'Experiência adicionada!');
            setEditingHistorico(null);
          };

          const handleDeleteHistorico = async (id: string) => {
            const dados = (redeProfile.dados_perfil || {}) as Record<string, any>;
            const list: HistoricoProfissional[] = dados.historico_profissional || [];
            await supabase.from('perfis_rede').update({
              dados_perfil: { ...dados, historico_profissional: list.filter(h => h.id !== id) },
            } as any).eq('id', redeProfile.id);
            queryClient.invalidateQueries({ queryKey: ['perfil-rede', userId] });
            toast.success('Experiência removida');
          };

          const tabCount = 3 + (showHistorico ? 1 : 0) + (showDescobrir ? 1 : 0) + (showPeneiras ? 1 : 0);
          const gridClass = tabCount <= 3 ? 'grid-cols-3' : tabCount === 4 ? 'grid-cols-4' : tabCount === 5 ? 'grid-cols-5' : 'grid-cols-6';

          return (
            <>
              {/* Invite card for own profile */}
              {isOwnProfile && inviteLink && (
                <Card className="p-4 mt-4 border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Convide amigos para a rede</span>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleCopyInvite}>
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copiado!' : 'Copiar link'}
                    </Button>
                  </div>
                </Card>
              )}

              <Tabs defaultValue="publicacoes" className="mt-4">
                <TabsList className={`w-full grid ${gridClass}`}>
                  <TabsTrigger value="publicacoes" className="flex-1">Publicações</TabsTrigger>
                  <TabsTrigger value="sobre" className="flex-1">Sobre</TabsTrigger>
                  {showHistorico && (
                    <TabsTrigger value="historico" className="flex-1">Histórico</TabsTrigger>
                  )}
                  <TabsTrigger value="conexoes" className="flex-1">Conexões</TabsTrigger>
                  {showPeneiras && (
                    <TabsTrigger value="peneiras" className="flex-1">Peneiras</TabsTrigger>
                  )}
                  {showDescobrir && (
                    <TabsTrigger value="descobrir" className="flex-1">
                      {redeProfile.tipo === 'torcedor' ? 'Atletas' : 'Descobrir'}
                    </TabsTrigger>
                  )}
                </TabsList>
                <TabsContent value="publicacoes">
                  <RedePostsFeed perfilId={redeProfile.id} isOwnProfile={isOwnProfile} perfilNome={redeProfile.nome} perfilFoto={redeProfile.foto_url} />
                </TabsContent>
                <TabsContent value="sobre">
                  <DadosEspecificos
                    tipo={redeProfile.tipo as any}
                    dados={redeProfile.dados_perfil as Record<string, any> | null}
                  />
                </TabsContent>
                {showHistorico && (
                  <TabsContent value="historico">
                    <HistoricoProfissionalSection
                      historico={historico}
                      isOwner={isOwnProfile}
                      accentColor={redeAccent}
                      onAdd={() => { setEditingHistorico(null); setHistoricoDialogOpen(true); }}
                      onEdit={(item) => { setEditingHistorico(item); setHistoricoDialogOpen(true); }}
                      onDelete={handleDeleteHistorico}
                    />
                  </TabsContent>
                )}
                <TabsContent value="conexoes">
                  <ConnectionsSection
                    userId={redeProfile.user_id}
                    currentUserId={currentUserId}
                  />
                </TabsContent>
                {showPeneiras && (
                  <TabsContent value="peneiras">
                    <PeneirasSection
                      userId={redeProfile.user_id}
                      perfilRedeId={redeProfile.id}
                      perfilRedeTipo={redeProfile.tipo}
                      accentColor={redeAccent}
                    />
                  </TabsContent>
                )}
                {showDescobrir && (
                  <TabsContent value="descobrir">
                    <DescobrirAtletasSection />
                  </TabsContent>
                )}
              </Tabs>
              {isOwnProfile && (
                <HistoricoProfissionalFormDialog
                  open={historicoDialogOpen}
                  onOpenChange={setHistoricoDialogOpen}
                  editing={editingHistorico}
                  onSave={handleSaveHistorico}
                />
              )}
            </>
          );
        })()}
        </PerfilLayout>
      </main>

      {isOwnProfile && redeProfile && (
        <EditPerfilRedeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          perfil={redeProfile}
        />
      )}

      <CarreiraBottomNav currentUserId={currentUserId} profileSlug={null} />
    </div>
  );
}

function RedePostsFeed({ perfilId, isOwnProfile, perfilNome, perfilFoto }: { perfilId: string; isOwnProfile: boolean; perfilNome: string; perfilFoto: string | null }) {
  const { data: posts, isLoading } = usePostsRede(perfilId);

  return (
    <div className="space-y-4 mt-4">
      {isOwnProfile && (
        <CreatePostForm perfilRedeId={perfilId} perfilRedeNome={perfilNome} perfilRedeFoto={perfilFoto} />
      )}
      {isLoading && <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}
      {posts?.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {!isLoading && (!posts || posts.length === 0) && !isOwnProfile && (
        <p className="text-center text-sm text-muted-foreground py-6">Nenhuma publicação ainda.</p>
      )}
    </div>
  );
}
