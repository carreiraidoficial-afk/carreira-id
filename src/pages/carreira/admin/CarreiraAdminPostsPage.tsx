import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Search, Loader2, Trash2, User, FileText, Send, Image, X, ExternalLink, Link as LinkIcon, Newspaper } from 'lucide-react';
import { LinkPreviewCard } from '@/components/carreira/LinkPreviewCard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { PostAtleta, useMyPerfilAtleta, useCreatePostAtleta, generateSlug } from '@/hooks/useCarreiraData';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';

function useAdminPosts(search: string) {
  return useQuery({
    queryKey: ['carreira-admin-posts', search],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts_atleta')
        .select('*, perfil:perfil_atleta(id, nome, slug, foto_url, user_id, is_public, modalidade), perfil_rede:perfis_rede(id, nome, slug, foto_url, user_id, tipo)')
        .order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      let posts = (data || []).map((p: any) => ({
        ...p,
        perfil: Array.isArray(p.perfil) ? p.perfil[0] : p.perfil,
        perfil_rede: Array.isArray(p.perfil_rede) ? p.perfil_rede[0] : p.perfil_rede,
      })) as unknown as PostAtleta[];
      if (search) {
        const s = search.toLowerCase();
        posts = posts.filter(p => p.texto?.toLowerCase().includes(s) || p.perfil?.nome?.toLowerCase().includes(s) || (p as any).perfil_rede?.nome?.toLowerCase().includes(s));
      }
      return posts;
    },
  });
}

function useAdminDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('posts_atleta').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['carreira-admin-posts'] }); toast.success('Post excluído'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

function useAutoCreateAdminPerfil() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Não autenticado');
      const { data: existing } = await supabase.from('perfil_atleta').select('id, nome, foto_url').eq('user_id', user.id).maybeSingle();
      if (existing) {
        // Corrige nome legado "(Admin)" → "Carreira ID"
        const updates: any = {};
        if (existing.nome?.includes('(Admin)')) updates.nome = 'Carreira ID';
        // Set logo if missing — upload from static asset
        if (!existing.foto_url) {
          try {
            const logoUrl = await uploadAdminLogo(user.id);
            if (logoUrl) updates.foto_url = logoUrl;
          } catch { /* silent */ }
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('perfil_atleta').update(updates).eq('id', existing.id);
        }
        return existing;
      }
      const nome = 'Carreira ID';
      const slug = generateSlug(nome);
      let foto_url: string | null = null;
      try { foto_url = await uploadAdminLogo(user.id); } catch { /* silent */ }
      const { data, error } = await supabase.from('perfil_atleta')
        .insert({ user_id: user.id, slug, nome, modalidade: 'Plataforma', bio: 'Conta oficial Carreira ID', is_public: true, foto_url })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meu-perfil-atleta'] }); toast.success('Perfil admin atualizado!'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

async function uploadAdminLogo(userId: string): Promise<string | null> {
  try {
    const response = await fetch('/images/logo-carreira-id-dark.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    const path = `${userId}/admin-logo.png`;
    await supabase.storage.from('atleta-fotos').upload(path, blob, { upsert: true, contentType: 'image/png' });
    const { data } = supabase.storage.from('atleta-fotos').getPublicUrl(path);
    return data.publicUrl;
  } catch { return null; }
}

export default function CarreiraAdminPostsPage() {
  const { user } = useAuth();
  const [urlParams] = useSearchParams();
  const [search, setSearch] = useState(urlParams.get('q') || '');
  const [texto, setTexto] = useState('');
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [linkPreview, setLinkPreview] = useState<any>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [buscandoNoticia, setBuscandoNoticia] = useState(false);
  const lastFetchedUrl = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: posts, isLoading } = useAdminPosts(search);
  const { data: meuPerfil, isLoading: loadingPerfil } = useMyPerfilAtleta();
  const deletePost = useAdminDeletePost();
  const createPost = useCreatePostAtleta();
  const autoCreate = useAutoCreateAdminPerfil();

  // Auto-fix admin profile (logo, name) on load
  useEffect(() => {
    if (meuPerfil && (!meuPerfil.foto_url || meuPerfil.nome?.includes('(Admin)'))) {
      autoCreate.mutate();
    }
  }, [meuPerfil?.id]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 3) { toast.error('Máximo 3 imagens'); return; }
    files.forEach(file => {
      if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) { toast.error('Apenas imagens até 5MB'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => setImages(prev => [...prev, { file, preview: ev.target?.result as string }]);
      reader.readAsDataURL(file);
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleTextChange = (value: string) => {
    setTexto(value);
    const urlMatch = value.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      const detectedUrl = urlMatch[1];
      if (detectedUrl !== lastFetchedUrl.current && !fetchingPreview) {
        lastFetchedUrl.current = detectedUrl;
        setFetchingPreview(true);
        supabase.functions.invoke('fetch-link-preview', { body: { url: detectedUrl } })
          .then(({ data, error }) => { if (!error && data?.title) setLinkPreview(data); })
          .catch(() => {})
          .finally(() => setFetchingPreview(false));
      }
    } else {
      setLinkPreview(null);
      lastFetchedUrl.current = null;
    }
  };

  const handleBuscarNoticia = async (tema: 'regional' | 'nacional' | 'escolinha') => {
    setBuscandoNoticia(true);
    setLinkPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke('search-esporte-noticias', { body: { tema } });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setTexto(`${data.resumo}\n\nFonte: ${data.fonte_nome}`.trim());
      lastFetchedUrl.current = data.fonte_url;
      if (data.fonte_url) {
        setFetchingPreview(true);
        supabase.functions.invoke('fetch-link-preview', { body: { url: data.fonte_url } })
          .then(({ data: preview, error: previewError }) => { if (!previewError && preview?.title) setLinkPreview(preview); })
          .catch(() => {})
          .finally(() => setFetchingPreview(false));
      }
      toast.success('Notícia encontrada! Revise o texto antes de publicar.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao buscar notícia');
    } finally {
      setBuscandoNoticia(false);
    }
  };

  const handlePublicar = async () => {
    if (!texto.trim() && images.length === 0) { toast.error('Escreva algo ou adicione imagem'); return; }
    if (!meuPerfil) { toast.error('Perfil admin necessário'); return; }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const img of images) {
        const ext = img.file.name.split('.').pop();
        const path = `posts/${user?.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('atleta-posts').upload(path, img.file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('atleta-posts').getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
      await createPost.mutateAsync({ autor_id: meuPerfil.id, texto: texto.trim(), imagens_urls: urls, link_preview: linkPreview || null });
      setTexto(''); setImages([]); setLinkPreview(null); lastFetchedUrl.current = null;
    } catch (err: any) { toast.error('Erro: ' + err.message); }
    finally { setUploading(false); }
  };

  const isSubmitting = uploading || createPost.isPending;

  return (
    <CarreiraAdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Posts — Moderação</h1>
          <p className="text-muted-foreground text-sm">Publique e modere posts da rede Carreira ID</p>
        </div>

        {/* Publicar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><Send className="w-5 h-5" />Publicar na Rede</CardTitle>
            <CardDescription>{meuPerfil ? `Publicando como ${meuPerfil.nome}` : 'Crie um perfil admin para publicar'}</CardDescription>
          </CardHeader>
          <CardContent>
            {!meuPerfil && !loadingPerfil ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Button size="sm" onClick={() => autoCreate.mutate()} disabled={autoCreate.isPending}>
                  {autoCreate.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</> : 'Criar perfil admin'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-dashed p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Newspaper className="w-3.5 h-3.5" />Buscar notícia pra sugerir um rascunho (revise antes de publicar)</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={buscandoNoticia} onClick={() => handleBuscarNoticia('regional')}>Campeonato regional</Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={buscandoNoticia} onClick={() => handleBuscarNoticia('nacional')}>Campeonato nacional</Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={buscandoNoticia} onClick={() => handleBuscarNoticia('escolinha')}>Escolinha</Button>
                    {buscandoNoticia && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />Buscando...</span>}
                  </div>
                </div>
                <Textarea placeholder="O que compartilhar na rede? Cole um link para gerar preview automaticamente" value={texto} onChange={e => handleTextChange(e.target.value)} rows={3} disabled={!meuPerfil || isSubmitting} className="resize-none" />
                {fetchingPreview && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />Carregando preview...</div>}
                {linkPreview && (
                  <div className="relative">
                    <LinkPreviewCard preview={linkPreview} />
                    <button onClick={() => { setLinkPreview(null); lastFetchedUrl.current = null; }} className="absolute top-2 right-2 bg-background/80 rounded-full p-1"><X className="w-3 h-3" /></button>
                  </div>
                )}
                {images.length > 0 && (
                  <div className={cn('grid gap-2', images.length === 1 && 'grid-cols-1', images.length === 2 && 'grid-cols-2', images.length >= 3 && 'grid-cols-3')}>
                    {images.map((img, i) => (
                      <div key={i} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                        <img src={img.preview} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-background/80 rounded-full p-1"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={images.length >= 3 || isSubmitting} className="gap-2"><Image className="w-4 h-4" />Foto</Button>
                  <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
                  <Button onClick={handlePublicar} disabled={isSubmitting || !meuPerfil || (!texto.trim() && images.length === 0)} size="sm" className="gap-2">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Publicando...</> : <><Send className="w-4 h-4" /> Publicar</>}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por texto ou autor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : !posts?.length ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><FileText className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Nenhum post encontrado</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <Card key={post.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3 flex-1 min-w-0">
                      <Avatar className="w-10 h-10 shrink-0">
                        {(post.perfil?.foto_url || (post as any).perfil_rede?.foto_url) && <AvatarImage src={post.perfil?.foto_url || (post as any).perfil_rede?.foto_url} />}
                        <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{post.perfil?.nome || (post as any).perfil_rede?.nome || 'Desconhecido'}</span>
                          {(post as any).perfil_rede?.tipo && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{(post as any).perfil_rede.tipo}</span>}
                          <span className="text-xs text-muted-foreground">{format(new Date(post.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        </div>
                        <p className="text-sm mt-1 line-clamp-3">{post.texto}</p>
                        {post.imagens_urls?.length > 0 && (
                          <div className="flex gap-1 mt-2">{post.imagens_urls.slice(0, 3).map((url, i) => <img key={i} src={url} alt="" className="w-16 h-16 rounded object-cover" />)}</div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{post.likes_count} curtidas</span>
                          <span>{post.comments_count} comentários</span>
                          {post.perfil?.slug && (
                            <a href={`/${post.perfil.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              <ExternalLink className="w-3 h-3" /> Ver perfil
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive shrink-0"><Trash2 className="w-4 h-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir publicação?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deletePost.mutate(post.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </CarreiraAdminLayout>
  );
}
