import { useState, useRef, useEffect } from 'react';
import { parseDataLocal } from '@/lib/datas';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, MapPin, Share2, Trophy, User, Pencil, Instagram, UserPlus, UserCheck, ShieldCheck, Footprints, Crown, Quote, Users, Swords, Clock } from 'lucide-react';
import { useCarreiraStats } from '@/hooks/useCarreiraJornadaData';
import { PerfilAtleta, useUpdatePerfilAtleta, uploadProfilePhoto, useIsFollowing, useToggleFollow } from '@/hooks/useCarreiraData';
import { useCarreiraExperiencias } from '@/hooks/useCarreiraExperienciasData';
import { useCarreiraPlano } from '@/hooks/useCarreiraPlano';
import { ConectarButton } from './ConectarButton';
import { useConexoesCount } from './ConexoesCount';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function calcularCategoria(dataNascimento: string): string {
  const birthYear = parseDataLocal(dataNascimento).getFullYear();
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  return `Sub ${age}`;
}
import { toast } from 'sonner';
import { EditPerfilDialog } from './EditPerfilDialog';
import { EditConfiguracoesDialog } from './EditConfiguracoesDialog';
import { CompartilharPerfilDialog } from './CompartilharPerfilDialog';

interface PerfilHeaderProps {
  perfil: PerfilAtleta;
  isOwner?: boolean;
  /** Perfil_atleta ativo de quem está vendo (o filho selecionado no seletor
   * de irmãos de quem está logado), quando aplicável -- isola a conexão
   * feita por esse visitante do outro filho dele. */
  viewerPerfilAtletaId?: string | null;
}

export function PerfilHeader({ perfil, isOwner = false, viewerPerfilAtletaId }: PerfilHeaderProps) {
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
  const [bioExpandida, setBioExpandida] = useState(false);
  const [bioTruncada, setBioTruncada] = useState(false);
  const bioRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (bioRef.current) {
      setBioTruncada(bioRef.current.scrollHeight > bioRef.current.clientHeight + 1);
    }
  }, [perfil.bio]);

  const handleFollow = () => {
    if (!user) { toast.error('Faça login para seguir'); return; }
    toggleFollow.mutate({ perfilId: perfil.id, isFollowing: !!isFollowing });
  };

  const modalidades = perfil.modalidades?.length > 0 ? perfil.modalidades : [perfil.modalidade];

  const cor = perfil.cor_destaque || '#3b82f6';
  const conexoes = useConexoesCount(perfil.user_id, perfil.id);
  const { stats: statsJornada } = useCarreiraStats(perfil.crianca_id, 'todos');

  // Há quanto tempo o perfil está no Carreira ID ("Novo", "3 meses", "1 ano"...)
  const tempoNoApp = (() => {
    const inicio = perfil.created_at ? new Date(perfil.created_at) : null;
    if (!inicio || isNaN(inicio.getTime())) return { valor: '—', rotulo: 'No Carreira ID' };
    const meses = Math.floor((Date.now() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    if (meses < 1) return { valor: 'Novo', rotulo: 'No Carreira ID' };
    if (meses < 12) return { valor: String(meses), rotulo: `${meses === 1 ? 'mês' : 'meses'} no Carreira ID` };
    const anos = Math.floor(meses / 12);
    return { valor: String(anos), rotulo: `${anos === 1 ? 'ano' : 'anos'} no Carreira ID` };
  })();

  const instagramBruto = String((perfil as any).instagram_url || '').trim();
  const instagramHandle = instagramBruto
    ? (instagramBruto.includes('instagram.com')
        ? '@' + (instagramBruto.split('?')[0].split('/').filter(Boolean).pop() || '')
        : instagramBruto.startsWith('@') ? instagramBruto : '@' + instagramBruto)
    : '';
  const instagramHref = instagramBruto
    ? (instagramBruto.startsWith('http') ? instagramBruto : `https://instagram.com/${instagramBruto.replace('@', '')}`)
    : '';
  const localizacao = [perfil.cidade, perfil.estado].filter(Boolean).join(', ');
  const posicaoTexto = perfil.posicao_principal
    ? `${perfil.posicao_principal}${perfil.posicao_secundaria ? ` / ${perfil.posicao_secundaria}` : ''}`
    : '';
  const peTexto = perfil.pe_dominante ? (PE_LABELS[perfil.pe_dominante] || perfil.pe_dominante) : '';
  const faixaInfo = [
    posicaoTexto && { chave: 'posicao', icone: <Footprints className="h-5 w-5 shrink-0" style={{ color: cor }} />, titulo: posicaoTexto, sub: peTexto },
    localizacao && { chave: 'local', icone: <MapPin className="h-5 w-5 shrink-0" style={{ color: cor }} />, titulo: localizacao, sub: '' },
    instagramHandle && { chave: 'insta', icone: <Instagram className="h-5 w-5 shrink-0" style={{ color: cor }} />, titulo: instagramHandle, sub: '', href: instagramHref },
  ].filter(Boolean) as { chave: string; icone: JSX.Element; titulo: string; sub: string; href?: string }[];
  const numeros = [
    { icone: <Users className="h-5 w-5" />, valor: String(perfil.followers_count || 0), rotulo: 'Torcedores' },
    { icone: <Users className="h-5 w-5" />, valor: String(conexoes), rotulo: 'Conexões' },
    { icone: <Swords className="h-5 w-5" />, valor: String(statsJornada?.totalJogos ?? 0), rotulo: 'Jogos' },
    { icone: <Clock className="h-5 w-5" />, valor: tempoNoApp.valor, rotulo: tempoNoApp.rotulo },
  ];

  return (
    <>
      <Card className="overflow-hidden" style={{ borderColor: `${cor}50`, borderWidth: 2 }}>
        {/* Hero: banner do atleta (ou degradê na cor dele) por trás da foto e do nome */}
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-0"
            style={perfil.banner_url
              ? { backgroundImage: `url(${perfil.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: `linear-gradient(145deg, ${cor} 0%, color-mix(in srgb, ${cor} 55%, #05080f) 55%, color-mix(in srgb, ${cor} 18%, #05080f) 100%)` }}
          />
          {/* Véu escuro fixo: o texto do topo é sempre branco, no tema claro e no escuro, com qualquer cor de destaque */}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/65" />

          {/* Ações no topo */}
          <div className="absolute right-3 top-3 z-10 flex gap-2">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              aria-label="Compartilhar perfil"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/45 text-white backdrop-blur hover:bg-black/60"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          <div className="relative flex items-start gap-3.5 px-4 pb-4 pt-4">
            {/* Foto (estilo figurinha) */}
            <div className="relative shrink-0">
              {perfil.foto_url ? (
                <img
                  src={perfil.foto_url}
                  alt={perfil.nome}
                  className="aspect-[3/4] w-28 rounded-xl object-cover object-top shadow-xl ring-2"
                  style={{ ['--tw-ring-color' as any]: cor }}
                />
              ) : (
                <div
                  className="flex aspect-[3/4] w-32 items-center justify-center rounded-xl bg-muted text-muted-foreground shadow-xl ring-2"
                  style={{ ['--tw-ring-color' as any]: cor }}
                >
                  <User className="h-12 w-12" />
                </div>
              )}
              {isOwner && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    aria-label="Trocar foto"
                    className="absolute bottom-1 right-1 rounded-full p-1.5 text-white shadow-lg transition-colors hover:opacity-90"
                    style={{ backgroundColor: cor }}
                  >
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" onChange={handlePhotoUpload} className="hidden" />
                </>
              )}
            </div>

            {/* Nome e identificação */}
            <div className="min-w-0 flex-1">
              {/* Espaço do botão de compartilhar: só as primeiras linhas desviam dele, o resto usa a largura toda */}
              <span aria-hidden className="float-right h-9 w-9" />
              {temAcesso('selo_elite') && (
                <span className="mb-1.5 inline-flex w-fit items-center gap-1 rounded-md bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  <Crown className="h-3 w-3" /> Elite
                </span>
              )}
              <h1 className="break-words text-xl font-extrabold leading-tight text-white sm:text-2xl" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.55)' }}>
                {perfil.nome}
              </h1>
              {categoriaDisplay && (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-white">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-white" />
                  Atleta {categoriaDisplay}
                </p>
              )}
              {perfil.crianca_id && (
                <p className="mt-0.5 text-[11px] leading-snug text-white/75">Perfil administrado pelo responsável</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {atletaStatusInfo && (
                  <Badge variant="outline" className="gap-1 border-white/50 bg-black/30 text-[11px] font-semibold text-white backdrop-blur">
                    <ShieldCheck className="h-3 w-3" />
                    {atletaStatusInfo.label}
                    {atletaStatusInfo.clubName && ` • ${atletaStatusInfo.clubName}`}
                  </Badge>
                )}
                {modalidades.map((mod, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1 border-white/20 bg-white/15 text-[11px] text-white backdrop-blur">
                    <Trophy className="h-3 w-3" />{mod}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <CardContent className="space-y-3 p-3">
          {/* Posição e pé, cidade, Instagram */}
          {faixaInfo.length > 0 && (
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-muted/20">
              {faixaInfo.map((it, i) => {
                // Com 3 itens, a posição ocupa a linha de cima; os outros dois dividem a de baixo.
                const larguraTotal = faixaInfo.length === 3 ? i === 0 : faixaInfo.length === 1;
                const conteudo = (
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    {it.icone}
                    <div className="min-w-0 leading-tight">
                      <p className="break-words text-xs font-semibold text-foreground">{it.titulo}</p>
                      {it.sub && <p className="text-[11px] text-muted-foreground">{it.sub}</p>}
                    </div>
                  </div>
                );
                // Divisórias: com 3 itens, a posição fica em cima e os outros dois embaixo, separados por uma linha vertical.
                const n = faixaInfo.length;
                const divisoria = n === 3 ? (i === 1 ? 'border-t' : i === 2 ? 'border-t border-l' : '') : n === 2 && i === 1 ? 'border-l' : '';
                const classes = `min-w-0 ${larguraTotal ? 'col-span-2' : ''} ${divisoria}`;
                return it.href ? (
                  <a key={it.chave} href={it.href} target="_blank" rel="noopener noreferrer" className={`${classes} hover:bg-muted/40`}>
                    {conteudo}
                  </a>
                ) : (
                  <div key={it.chave} className={classes}>{conteudo}</div>
                );
              })}
            </div>
          )}

          {/* Números */}
          <div className="grid grid-cols-4 divide-x divide-border rounded-xl border bg-muted/20 py-3">
            {numeros.map((n) => (
              <div key={n.rotulo} className="flex flex-col items-center justify-start gap-0.5 px-1 text-center">
                <span style={{ color: cor }}>{n.icone}</span>
                <span className="text-lg font-extrabold leading-none text-foreground">{n.valor}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">{n.rotulo}</span>
              </div>
            ))}
          </div>

          {/* Bio */}
          {(perfil.bio || isOwner) && (
            <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3">
              <Quote className="mt-0.5 h-6 w-6 shrink-0 opacity-60" style={{ color: cor }} />
              <div className="min-w-0 flex-1">
                {perfil.bio ? (
                  <>
                    <p ref={bioRef} className={`whitespace-pre-line text-sm text-foreground ${bioExpandida ? '' : 'line-clamp-4'}`}>
                      {perfil.bio}
                    </p>
                    {(bioTruncada || bioExpandida) && (
                      <button
                        type="button"
                        onClick={() => setBioExpandida(!bioExpandida)}
                        className="mt-0.5 text-xs font-medium hover:underline"
                        style={{ color: cor }}
                      >
                        {bioExpandida ? 'ver menos' : 'ver mais'}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Conte um pouco sobre o atleta: gostos, posição, objetivos.</p>
                )}
              </div>
              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1 px-2.5 text-xs"
                  onClick={() => setEditDialogOpen(true)}
                  style={{ borderColor: `${cor}50`, color: cor }}
                >
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
              )}
            </div>
          )}

          {/* Conectar e torcer (visitante logado) */}
          {!isOwner && user && (
            <div className="flex flex-wrap justify-center gap-1.5">
              <ConectarButton
                targetUserId={perfil.user_id}
                currentUserId={user.id}
                targetPerfilAtletaId={perfil.id}
                sourcePerfilAtletaId={viewerPerfilAtletaId}
              />
              <Button size="sm" className="h-8 px-3 text-xs" variant={isFollowing ? 'outline' : 'default'}
                onClick={handleFollow} disabled={toggleFollow.isPending}
                style={!isFollowing ? { backgroundColor: perfil.cor_destaque || undefined } : undefined}>
                {isFollowing ? <><UserCheck className="mr-1 h-3 w-3" />Torcendo</> : <><UserPlus className="mr-1 h-3 w-3" />Torcer</>}
              </Button>
            </div>
          )}
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
