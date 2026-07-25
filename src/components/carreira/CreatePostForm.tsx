import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Image, Loader2, Send, User, X, Video, Lock } from 'lucide-react';
import { PerfilAtleta, useCreatePostAtleta, uploadPostImage, uploadPostVideo } from '@/hooks/useCarreiraData';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { LinkPreviewCard } from './LinkPreviewCard';
import { ModerationBlockDialog } from './ModerationBlockDialog';
import { compressImage } from '@/lib/image-compressor';
import { validateVideo, isVideoFile, VIDEO_ACCEPT } from '@/lib/video-validator';
import { isVideoUrl } from './VideoEmbedCard';
import { useCarreiraPlano, usePostsDiaCount } from '@/hooks/useCarreiraPlano';
import { PLANOS } from '@/config/carreiraPlanos';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useNavigate } from 'react-router-dom';
import heic2any from 'heic2any';

// Helper to convert HEIC/HEIF to JPEG
async function convertHeicToJpeg(file: File): Promise<File> {
  const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
                 file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

  if (!isHeic) return file;

  try {
    const blobResult = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85,
    });

    const convertedBlob = Array.isArray(blobResult) ? blobResult[0] : blobResult;
    const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');

    return new File([convertedBlob], newFileName, { type: 'image/jpeg' });
  } catch (error) {
    console.error('Error converting HEIC:', error);
    throw new Error('Não foi possível converter a imagem HEIC');
  }
}

interface CreatePostFormProps {
  perfil?: PerfilAtleta;
  perfilRedeId?: string;
  perfilRedeNome?: string;
  perfilRedeFoto?: string | null;
  accentColor?: string;
}

// Professional profile types that don't need subscriptions
const PROFESSIONAL_TYPES = ['tecnico', 'scout', 'agente_clube', 'dono_escola', 'empresario', 'jogador_profissional', 'professor'];

export function CreatePostForm({ perfil, perfilRedeId, perfilRedeNome, perfilRedeFoto, accentColor }: CreatePostFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createPost = useCreatePostAtleta();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  const criancaId = perfil?.crianca_id || null;
  const { plano, limites, temAcesso } = useCarreiraPlano(criancaId);
  const { data: postsDiaCount = 0 } = usePostsDiaCount(perfil?.id);

  // Check if this is a professional (non-athlete) profile
  const [perfilRedeTipo, setPerfilRedeTipo] = useState<string | null>(null);
  useEffect(() => {
    if (perfilRedeId) {
      supabase.from('perfis_rede').select('tipo').eq('id', perfilRedeId).single()
        .then(({ data }) => { if (data) setPerfilRedeTipo(data.tipo); });
    }
  }, [perfilRedeId]);

  // Admin profile (no crianca_id, modalidade = 'Plataforma') or professional profile = no limits
  const isAdmin = !!perfil && !perfil.crianca_id && perfil.modalidade === 'Plataforma';
  const isProfessional = isAdmin || (!!perfilRedeId && !!perfilRedeTipo && PROFESSIONAL_TYPES.includes(perfilRedeTipo));
  // Professionals/Admin: no post limit, video up to 2min/40MB, YouTube allowed
  const effectiveLimites = isProfessional
    ? { ...limites, posts_dia: 99, video_seg: 120, video_max_mb: 40, youtube: true }
    : limites;
  const effectivePostsLimitReached = isProfessional ? false : postsDiaCount >= limites.posts_dia;
  const effectiveCanUploadVideo = isProfessional ? true : temAcesso('video_seg');
  
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [videoFile, setVideoFile] = useState<{ file: File; preview: string; duration: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [linkPreview, setLinkPreview] = useState<any>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [moderationBlock, setModerationBlock] = useState<{ open: boolean; reason: string; level: string; logId?: string }>({ open: false, reason: '', level: '' });

  // Fallback to direct Supabase auth for Carreira-only users (no user_roles entry)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setSessionUserId(session.user.id);
    });
  }, []);

  const effectiveUserId = user?.id || sessionUserId;

  const lastFetchedUrl = useRef<string | null>(null);
  
  const postsLimitReached = effectivePostsLimitReached;
  const canUploadVideo = effectiveCanUploadVideo;
  const linkIsLockedVideo = !!linkPreview && isVideoUrl(linkPreview.url) && !effectiveLimites.youtube;
  const displayLinkPreview = linkPreview
    ? { ...linkPreview, video_embed_allowed: !isVideoUrl(linkPreview.url) || effectiveLimites.youtube }
    : null;

  const handleTextChange = (value: string) => {
    setTexto(value);
    const urlMatch = value.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      const detectedUrl = urlMatch[1];
      if (detectedUrl !== lastFetchedUrl.current && !fetchingPreview) {
        lastFetchedUrl.current = detectedUrl;
        fetchLinkPreviewData(detectedUrl);
      }
    } else {
      setLinkPreview(null);
      lastFetchedUrl.current = null;
    }
  };

  const fetchLinkPreviewData = async (url: string) => {
    setFetchingPreview(true);
    try {
      // Instagram blocks server-side scraping — build preview client-side
      const isInstagram = /instagram\.com/i.test(url);
      if (isInstagram) {
        setLinkPreview({
          url,
          title: 'Publicação no Instagram',
          description: 'Veja esta publicação no Instagram',
          image: null,
          site_name: 'Instagram',
          type: 'instagram',
        });
        toast.info('Links do Instagram não permitem pré-visualização de imagem. O link será publicado normalmente.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('fetch-link-preview', { body: { url } });
      if (error || !data?.title) {
        toast.warning('Não foi possível gerar pré-visualização deste link. Você pode publicar assim mesmo ou descartar.');
        return;
      }
      setLinkPreview(data);
    } catch {
      toast.warning('Erro ao buscar pré-visualização do link.');
    } finally { setFetchingPreview(false); }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (images.length + files.length > 3) {
      toast.error('Máximo de 3 imagens por post');
      return;
    }

    for (const file of files) {
      const isImage = file.type.startsWith('image/') ||
                      file.name.toLowerCase().endsWith('.heic') ||
                      file.name.toLowerCase().endsWith('.heif');
      if (!isImage) {
        toast.error(`Arquivo não suportado: ${file.name}`);
        continue;
      }

      if (file.size > 15 * 1024 * 1024) {
        toast.error(`Imagem muito grande: ${file.name}. Máximo 15MB.`);
        continue;
      }

      try {
        // Convert HEIC/HEIF to JPEG for preview and upload compatibility
        const processedFile = await convertHeicToJpeg(file);

        const reader = new FileReader();
        reader.onload = (ev) => {
          setImages((prev) => {
            if (prev.length >= 3) {
              toast.error('Máximo de 3 imagens por post');
              return prev;
            }
            return [...prev, { file: processedFile, preview: ev.target?.result as string }];
          });
        };
        reader.readAsDataURL(processedFile);
      } catch (err: any) {
        toast.error(err?.message || `Erro ao processar ${file.name}`);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isVideoFile(file)) {
      toast.error('Formato de vídeo não suportado');
      return;
    }

    const result = await validateVideo(file, effectiveLimites.video_seg, effectiveLimites.video_max_mb);
    
    if (!result.valid) {
      toast.error(result.error || 'Vídeo não permitido');
      return;
    }

    const preview = URL.createObjectURL(file);
    setVideoFile({ file, preview, duration: result.duration });
    // Remove images if adding video
    setImages([]);

    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    if (videoFile) {
      URL.revokeObjectURL(videoFile.preview);
      setVideoFile(null);
    }
  };

  const handleSubmit = async () => {
    if (!texto.trim() && images.length === 0 && !videoFile) {
      toast.error('Escreva algo, adicione uma imagem ou vídeo');
      return;
    }

    if (!effectiveUserId) {
      toast.error('Você precisa estar logado');
      return;
    }

    if (postsLimitReached) {
      toast.error(`Você atingiu o limite de ${effectiveLimites.posts_dia} publicação(ões) por dia no plano ${PLANOS[plano].nome}`);
      return;
    }

    setUploading(true);
    try {
      // Moderation check (if there's text)
      if (texto.trim()) {
        try {
          const { data: modResult, error: modError } = await supabase.functions.invoke('moderate-content', {
            body: { content: texto.trim(), user_id: effectiveUserId, content_type: 'post' },
          });
          if (!modError && modResult && modResult.aprovado === false) {
            setModerationBlock({
              open: true,
              reason: modResult.motivo || 'Conteúdo inadequado',
              level: modResult.level || 'filtro',
              logId: modResult.log_id || undefined,
            });
            setUploading(false);
            return;
          }
        } catch {
          // If moderation fails, allow post (don't block users due to service issues)
        }
      }

      // Compress and upload images
      const imageUrls: string[] = [];
      for (const img of images) {
        const compressed = await compressImage(img.file);
        const url = await uploadPostImage(compressed, effectiveUserId);
        imageUrls.push(url);
      }

      // Upload video if present
      let videoUrl: string | undefined;
      if (videoFile) {
        videoUrl = await uploadPostVideo(videoFile.file, effectiveUserId);
      }

      // Create post
      const postData: any = {
        titulo: titulo.trim() || undefined,
        texto: texto.trim(),
        imagens_urls: imageUrls,
        video_url: videoUrl,
        link_preview: displayLinkPreview || null,
        criado_por: effectiveUserId,
      };
      if (perfilRedeId) {
        postData.perfil_rede_id = perfilRedeId;
      } else if (perfil) {
        postData.autor_id = perfil.id;
      }
      await createPost.mutateAsync(postData);

      // Reset form
      setTitulo('');
      setTexto('');
      setImages([]);
      removeVideo();
      setLinkPreview(null);
    } catch (error: any) {
      console.error('[CreatePostForm] Error:', error);
      toast.error('Erro ao publicar: ' + (error?.message || 'Tente novamente'));
    } finally {
      setUploading(false);
    }
  };

  const isSubmitting = uploading || createPost.isPending;

  return (
    <> 
    <Card className="shadow-md" style={accentColor ? { borderColor: `${accentColor}50`, borderWidth: 2 } : { border: 'none' }}>
      <CardContent className="pt-4">
        {/* Posts limit indicator */}
        {postsLimitReached && (
          <div className="mb-3 flex items-center gap-2 p-2.5 rounded-lg bg-muted/80 border border-dashed border-muted-foreground/20">
            <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="text-xs text-muted-foreground flex-1">
              Limite de {effectiveLimites.posts_dia} publicação(ões)/dia atingido.{' '}
              <button onClick={() => navigate(carreiraPath('/planos'))} className="text-primary underline font-medium">
                Fazer upgrade
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Avatar className="w-10 h-10 flex-shrink-0">
            {(perfil?.foto_url || perfilRedeFoto) ? (
              <AvatarImage src={(perfil?.foto_url || perfilRedeFoto)!} alt={perfil?.nome || perfilRedeNome || ''} />
            ) : null}
            <AvatarFallback>
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <input
                type="text"
                placeholder="Título curto (opcional)"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value.slice(0, 80))}
                disabled={postsLimitReached}
                maxLength={80}
                className="w-full bg-transparent border-0 p-0 text-base font-semibold placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0"
              />
              {titulo.length > 0 && (
                <div className="text-[10px] text-muted-foreground text-right">{titulo.length}/80</div>
              )}
            </div>
            <Textarea
              placeholder={postsLimitReached ? `Limite de posts diários atingido (${limites.posts_dia}/${limites.posts_dia})` : "O que está acontecendo na sua jornada esportiva?"}
              value={texto}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={3}
              className="resize-none border-0 p-0 focus-visible:ring-0 text-base"
              disabled={postsLimitReached}
            />

            {/* Link Preview */}
            {fetchingPreview && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />Carregando preview...</div>}
            {displayLinkPreview && (
              <div className="relative">
                <LinkPreviewCard preview={displayLinkPreview} />
                <button onClick={() => setLinkPreview(null)} className="absolute top-2 right-2 bg-background/80 rounded-full p-1"><X className="w-3 h-3" /></button>
              </div>
            )}
            {linkIsLockedVideo && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="w-3 h-3" />
                Vídeos incorporados (YouTube/Vimeo) são um recurso Premium — este link será publicado como um card simples.
              </div>
            )}

            {/* Video Preview */}
            {videoFile && (
              <div className="relative rounded-lg overflow-hidden bg-muted">
                <video
                  src={videoFile.preview}
                  controls
                  className="w-full max-h-64 object-contain"
                  preload="metadata"
                />
                <button
                  type="button"
                  onClick={removeVideo}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
                  {Math.ceil(videoFile.duration)}s • {(videoFile.file.size / (1024 * 1024)).toFixed(1)} MB
                </div>
              </div>
            )}

            {/* Image Previews */}
            {images.length > 0 && (
              <div className={cn(
                'grid gap-2',
                images.length === 1 && 'grid-cols-1',
                images.length === 2 && 'grid-cols-2',
                images.length >= 3 && 'grid-cols-3'
              )}>
                {images.map((img, index) => (
                  <div key={index} className="relative aspect-[4/5] rounded-lg overflow-hidden bg-muted">
                    <img
                      src={img.preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={images.length >= 3 || isSubmitting || !!videoFile || postsLimitReached}
                  className="gap-1.5"
                >
                  <Image className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs">Foto</span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {/* Video button */}
                {canUploadVideo ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isSubmitting || !!videoFile || images.length > 0 || postsLimitReached}
                    className="gap-1.5"
                  >
                    <Video className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">Vídeo</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(carreiraPath('/planos'))}
                    className="gap-1.5 text-muted-foreground"
                  >
                    <Video className="w-4 h-4" />
                    <Lock className="w-3 h-3" />
                  </Button>
                )}
                <input
                  ref={videoInputRef}
                  type="file"
                  accept={VIDEO_ACCEPT}
                  onChange={handleVideoSelect}
                  className="hidden"
                />

                {images.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {images.length}/3 imagens
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
              {!postsLimitReached && effectiveLimites.posts_dia < 99 && (
                  <span className="text-[10px] text-muted-foreground">
                    {postsDiaCount}/{effectiveLimites.posts_dia}
                  </span>
                )}
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || postsLimitReached || (!texto.trim() && images.length === 0 && !videoFile)}
                  size="sm"
                  className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Publicando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Publicar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    <ModerationBlockDialog
      open={moderationBlock.open}
      onOpenChange={(open) => setModerationBlock(prev => ({ ...prev, open }))}
      reason={moderationBlock.reason}
      level={moderationBlock.level}
      logId={moderationBlock.logId}
    />
    </>
  );
}
