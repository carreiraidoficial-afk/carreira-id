import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThumbsUp, MessageCircle, Share2, Send, MoreHorizontal, Trash2, User, Loader2, Pencil } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PostAtleta, usePostLike, useDeletePostAtleta, useUpdatePostAtleta, usePostComments, useCreateComment } from '@/hooks/useCarreiraData';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { LinkPreviewCard } from './LinkPreviewCard';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useAnonymousGate } from '@/hooks/useAnonymousGate';
import { useColaboradorInfo } from '@/hooks/useCriancaAtiva';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface PostCardProps {
  post: PostAtleta;
  showAuthor?: boolean;
  accentColor?: string;
}

function renderTextWithLinks(text: string, hasLinkPreview?: boolean) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      // If there's a link preview, hide the raw URL from the text
      if (hasLinkPreview) return null;
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="text-primary hover:underline break-all">
          {part}
        </a>
      );
    }
    return part;
  }).filter(Boolean);
}

export function PostCard({ post, showAuthor = true, accentColor }: PostCardProps) {
  const { user } = useAuth();
  const { isLiked, toggleLike, effectiveUserId } = usePostLike(post.id);
  const deletePost = useDeletePostAtleta();
  const updatePost = useUpdatePostAtleta();
  const [editOpen, setEditOpen] = useState(false);
  const [editTitulo, setEditTitulo] = useState('');
  const [editTexto, setEditTexto] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const { data: comments } = usePostComments(post.id);
  const createComment = useCreateComment();
  const isAuthenticated = !!user?.id || !!effectiveUserId;
  const { requireAuth } = useAnonymousGate();

  // Resolve author from perfil_atleta or perfis_rede
  const perfilAtleta = post.perfil;
  const perfilRede = (post as any).perfil_rede;
  const authorName = perfilAtleta?.nome || perfilRede?.nome || 'Usuário';
  const authorPhoto = perfilAtleta?.foto_url || perfilRede?.foto_url || null;
  const authorSubtitle = perfilAtleta
    ? [perfilAtleta.modalidade, perfilAtleta.categoria, [perfilAtleta.cidade, perfilAtleta.estado].filter(Boolean).join(', ')].filter(Boolean).join(' • ')
    : perfilRede?.tipo ? perfilRede.tipo.charAt(0).toUpperCase() + perfilRede.tipo.slice(1).replace('_', ' ') : '';
  const authorLink = perfilAtleta?.slug
    ? carreiraPath(`/${perfilAtleta.slug}`)
    : perfilRede
      ? carreiraPath(`/perfil/${perfilRede.user_id}`)
      : '#';
  
  const isOwner = (perfilAtleta?.user_id === user?.id) || (perfilRede?.user_id === user?.id);
  const isAdmin = user?.role === 'admin';
  // Colaborador ativo (ex: mãe/pai com acesso concedido) também pode
  // gerenciar posts do atleta, não só o dono exato do perfil.
  const { data: minhaColaboracao } = useColaboradorInfo(perfilAtleta?.crianca_id, user?.id);
  const souColaboradorAtivo = !!minhaColaboracao;
  const canManage = isOwner || souColaboradorAtivo || isAdmin;
  const canEdit = canManage;

  // "Postado por": mostra o nome de quem realmente publicou quando não foi
  // o dono do perfil (ex: um colaborador postando pelo atleta).
  const postadoPorOutraPessoa = !!post.criado_por && post.criado_por !== perfilAtleta?.user_id;
  const { data: infoAutorPost } = useColaboradorInfo(perfilAtleta?.crianca_id, postadoPorOutraPessoa ? post.criado_por : null);
  const isEdited = post.updated_at && new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60_000;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR });
  const hasAuthor = !!(perfilAtleta || perfilRede);

  const linkPreview = post.link_preview || (post as any).link_preview;

  // Link público de compartilhamento (no domínio próprio).
  // Em produção, /p/:id é roteado pela edge function share-post (OG tags) e
  // redireciona humanos para /post/:id (rota SPA). Em preview/local cai direto na SPA.
  const shareUrl = `https://carreiraid.com.br/p/${post.id}`;

  const postTitulo = (post as any).titulo as string | undefined;

  const buildShareText = () => {
    const excerpt = post.texto ? (post.texto.length > 140 ? post.texto.slice(0, 137) + '…' : post.texto) : '';
    const headline = postTitulo?.trim() || `${authorName} no Carreira ID`;
    const lines = [`🏆 ${headline}`];
    if (excerpt) lines.push('', `"${excerpt}"`);
    lines.push('', `📲 ${shareUrl}`);
    return lines.join('\n');
  };

  const handleShare = async () => {
    const shareTitle = postTitulo?.trim() || `${authorName} no Carreira ID`;
    const shareText = post.texto
      ? (post.texto.length > 200 ? post.texto.slice(0, 197) + '…' : post.texto)
      : `Veja a publicação de ${authorName} no Carreira ID`;

    // Try Web Share API (only works in secure contexts, not iframes)
    try {
      if (typeof navigator.share === 'function' && navigator.canShare?.({ url: shareUrl })) {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      // Any other error (NotAllowedError in iframes, etc.) → fall through to clipboard
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(buildShareText());
      toast.success('Link e prévia copiados!');
    } catch {
      toast.info('Copie o link: ' + shareUrl);
    }
  };

  const handleSend = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildShareText())}`, '_blank');
  };

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja excluir este post?')) return;
    try { await deletePost.mutateAsync({ postId: post.id, autorId: post.autor_id }); } catch { /* hook handles */ }
  };

  const openEdit = () => {
    setEditTitulo(postTitulo || '');
    setEditTexto(post.texto || '');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editTexto.trim()) { toast.error('O texto não pode ficar vazio'); return; }
    try {
      await updatePost.mutateAsync({ postId: post.id, titulo: editTitulo, texto: editTexto.trim() });
      setEditOpen(false);
    } catch { /* hook handles toast */ }
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    const uid = user?.id || effectiveUserId;
    if (!uid) { requireAuth('interaction'); return; }
    await createComment.mutateAsync({ postId: post.id, texto: commentText.trim(), userId: uid });
    setCommentText('');
  };

  return (
    <>
      <Card className="overflow-hidden shadow-md hover:shadow-lg transition-shadow" style={accentColor ? { borderColor: `${accentColor}50`, borderWidth: 2 } : { border: 'none' }}>
        {showAuthor && hasAuthor && (
          <CardHeader className="pb-2 px-3 pt-3">
            <div className="flex items-start justify-between">
              <div className="flex gap-2.5">
                <Avatar className="w-10 h-10">
                  {authorPhoto && <AvatarImage src={authorPhoto} alt={authorName} />}
                  <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <Link to={authorLink} className="font-semibold text-sm hover:underline leading-tight block">
                    {authorName}
                  </Link>
                  {authorSubtitle && (
                    <p className="text-[11px] text-muted-foreground leading-tight">{authorSubtitle}</p>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {timeAgo}{isEdited && <span className="ml-1 italic">(editado)</span>}
                    {postadoPorOutraPessoa && infoAutorPost?.nome && (
                      <span className="ml-1">· postado por {infoAutorPost.nome}</span>
                    )}
                  </span>
                </div>
              </div>
              
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canEdit && (
                      <DropdownMenuItem onClick={openEdit}>
                        <Pencil className="w-4 h-4 mr-2" />Editar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardHeader>
        )}

        <CardContent className={cn("px-3 pb-2", !showAuthor && "pt-3")}>
          {postTitulo && (
            <h3 className="text-base font-bold leading-snug mb-1">{postTitulo}</h3>
          )}
          {post.texto && (
            <p className="text-sm whitespace-pre-wrap mb-2">{renderTextWithLinks(post.texto, !!(linkPreview && linkPreview.title))}</p>
          )}

          {linkPreview && linkPreview.title && (
            <div className="mb-2">
              <LinkPreviewCard preview={linkPreview} />
            </div>
          )}

          {/* Video */}
          {(post as any).video_url && (
            <div className="rounded-lg overflow-hidden bg-muted mb-2">
              <video
                src={(post as any).video_url}
                controls
                className="w-full max-h-96 object-contain"
                preload="metadata"
                playsInline
              />
            </div>
          )}

          {post.imagens_urls && post.imagens_urls.length > 0 && (
            <div className={cn(
              'grid gap-1',
              post.imagens_urls.length === 1 && 'grid-cols-1',
              post.imagens_urls.length === 2 && 'grid-cols-2',
              post.imagens_urls.length >= 3 && 'grid-cols-3'
            )}>
              {post.imagens_urls.map((url, index) => (
                <button key={index} onClick={() => setSelectedImage(url)}
                  className="relative rounded-md overflow-hidden bg-muted hover:opacity-90 transition-opacity aspect-[4/5]">
                  <img src={url} alt={`Imagem ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </CardContent>

        {(post.likes_count > 0 || post.comments_count > 0) && (
          <div className="px-3 pb-1 flex items-center justify-between text-xs text-muted-foreground">
            {post.likes_count > 0 && (
              <div className="flex items-center gap-1">
                <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                  <ThumbsUp className="w-2.5 h-2.5" />
                </span>
                <span>{post.likes_count}</span>
              </div>
            )}
            {post.comments_count > 0 && (
              <button onClick={() => setShowComments(!showComments)} className="hover:underline">
                {post.comments_count} comentário{post.comments_count > 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        <CardFooter className="px-2 py-0 border-t" style={accentColor ? { borderColor: `${accentColor}20` } : undefined}>
          <div className="flex items-center w-full">
            <Button variant="ghost" size="sm"
              onClick={() => { if (isAuthenticated) toggleLike.mutate(); else requireAuth('interaction'); }}
              disabled={toggleLike.isPending}
              className={cn("flex-col gap-0.5 flex-1 h-12 text-[11px] rounded-none py-1 hover:bg-orange-100/50", isLiked && "text-orange-600 font-semibold")}>
              <ThumbsUp className={cn("w-5 h-5", isLiked && "fill-current")} />
              Gostei
            </Button>
            
            <Button variant="ghost" size="sm" className="flex-col gap-0.5 flex-1 h-12 text-[11px] rounded-none py-1 hover:bg-blue-100/50"
              onClick={() => { if (!isAuthenticated) { requireAuth('interaction'); return; } setShowComments(!showComments); }}>
              <MessageCircle className="w-5 h-5 text-blue-600" />
              Comentar
            </Button>

            <Button variant="ghost" size="sm" onClick={handleShare} className="flex-col gap-0.5 flex-1 h-12 text-[11px] rounded-none py-1 hover:bg-emerald-100/50">
              <Share2 className="w-5 h-5 text-emerald-600" />
              Compartilhar
            </Button>

            <Button variant="ghost" size="sm" onClick={handleSend} className="flex-col gap-0.5 flex-1 h-12 text-[11px] rounded-none py-1 hover:bg-green-100/50">
              <Send className="w-5 h-5 text-green-600" />
              Enviar
            </Button>
          </div>
        </CardFooter>

        {showComments && (
          <div className="px-3 py-2 border-t bg-muted/30 space-y-2">
            {comments?.map((c) => (
              <div key={c.id} className="flex gap-2">
                <Avatar className="w-6 h-6 mt-0.5">
                  {c.profile?.foto_url && <AvatarImage src={c.profile.foto_url} alt={c.profile?.nome || ''} />}
                  <AvatarFallback className="text-[10px]"><User className="w-3 h-3" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 bg-muted rounded-lg px-2.5 py-1.5">
                  <span className="text-xs font-semibold">{c.profile?.nome || 'Usuário'}</span>
                  <p className="text-xs">{c.texto}</p>
                </div>
              </div>
            ))}
            {isAuthenticated && (
              <div className="flex gap-2 items-center">
                <Avatar className="w-6 h-6">
                  {authorPhoto && isOwner && <AvatarImage src={authorPhoto} />}
                  <AvatarFallback className="text-[10px]"><User className="w-3 h-3" /></AvatarFallback>
                </Avatar>
                <Input
                  placeholder="Escreva um comentário..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleComment(); }}
                  className="h-7 text-xs flex-1"
                />
                <Button size="sm" variant="ghost" className="h-7 px-2"
                  onClick={handleComment} disabled={!commentText.trim() || createComment.isPending}>
                  {createComment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Imagem ampliada" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar publicação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Título curto (opcional)</label>
              <Input
                value={editTitulo}
                onChange={(e) => setEditTitulo(e.target.value.slice(0, 80))}
                placeholder="Ex: Treino de finalização"
                maxLength={80}
              />
              <p className="text-[10px] text-muted-foreground text-right mt-0.5">{editTitulo.length}/80</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Texto</label>
              <Textarea
                value={editTexto}
                onChange={(e) => setEditTexto(e.target.value)}
                rows={6}
                placeholder="O que você quer compartilhar?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={updatePost.isPending}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={updatePost.isPending || !editTexto.trim()}>
              {updatePost.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}