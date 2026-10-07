import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { PostAtleta } from '@/hooks/useCarreiraData';

interface Props {
  posts: PostAtleta[] | undefined;
  accentColor?: string;
  /** Dono (ou suporte): vê a dica de como encher a galeria quando ela está vazia. */
  podeGerenciar?: boolean;
}

/** Galeria do profissional: as imagens das publicações dele, da mais nova para a mais antiga, com visualização ampliada. */
export function GaleriaProfissional({ posts, accentColor = '#3b82f6', podeGerenciar }: Props) {
  const imagens = useMemo(
    () => (posts || []).flatMap((p) => (p.imagens_urls || []).filter(Boolean).map((url) => ({ url, postId: p.id }))),
    [posts],
  );
  const [aberta, setAberta] = useState<number | null>(null);

  const mover = useCallback(
    (passo: number) => setAberta((i) => (i === null || imagens.length === 0 ? i : (i + passo + imagens.length) % imagens.length)),
    [imagens.length],
  );

  useEffect(() => {
    if (aberta === null) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberta, mover]);

  if (imagens.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Images className="mx-auto mb-2 h-10 w-10 opacity-40" style={{ color: accentColor }} />
        <p className="text-sm text-muted-foreground">Nenhuma foto na galeria ainda.</p>
        {podeGerenciar && (
          <p className="mt-1 text-xs text-muted-foreground">As imagens das suas publicações aparecem aqui. Publique com foto na aba Publicações.</p>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
        <Images className="h-4 w-4" style={{ color: accentColor }} />
        Galeria ({imagens.length})
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {imagens.map((img, i) => (
          <button
            key={`${img.postId}-${i}`}
            type="button"
            onClick={() => setAberta(i)}
            aria-label={`Abrir foto ${i + 1} de ${imagens.length}`}
            className="group aspect-square overflow-hidden rounded-lg bg-muted"
          >
            <img src={img.url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          </button>
        ))}
      </div>

      <Dialog open={aberta !== null} onOpenChange={(a) => { if (!a) setAberta(null); }}>
        <DialogContent className="max-w-3xl border-0 bg-black/95 p-2 sm:p-4">
          <DialogTitle className="sr-only">Foto {aberta !== null ? aberta + 1 : ''} de {imagens.length}</DialogTitle>
          {aberta !== null && imagens[aberta] && (
            <div className="relative flex items-center justify-center">
              <img src={imagens[aberta].url} alt="" className="max-h-[80vh] w-full object-contain" />
              {imagens.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => mover(-1)}
                    aria-label="Foto anterior"
                    className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(1)}
                    aria-label="Próxima foto"
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-0.5 text-xs text-white">
                    {aberta + 1} / {imagens.length}
                  </span>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
