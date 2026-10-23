import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface FotoGaleria {
  id: string;
  url: string;
}

interface Props {
  fotos: FotoGaleria[];
  indiceInicial: number;
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
}

/** Foto ampliada com setas, contador e deslizar o dedo para passar. As setas do teclado também funcionam. */
export function GaleriaFotosDialog({ fotos, indiceInicial, aberto, titulo, onFechar }: Props) {
  const [indice, setIndice] = useState(indiceInicial);
  const toqueInicial = useRef<number | null>(null);

  useEffect(() => {
    if (aberto) setIndice(indiceInicial);
  }, [aberto, indiceInicial]);

  const anterior = useCallback(() => setIndice((i) => (i - 1 + fotos.length) % fotos.length), [fotos.length]);
  const proxima = useCallback(() => setIndice((i) => (i + 1) % fotos.length), [fotos.length]);

  useEffect(() => {
    if (!aberto || fotos.length < 2) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') anterior();
      if (e.key === 'ArrowRight') proxima();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberto, fotos.length, anterior, proxima]);

  if (fotos.length === 0) return null;
  const atual = fotos[Math.min(indice, fotos.length - 1)];

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent
        className="max-w-[96vw] sm:max-w-4xl border-0 bg-black/95 p-0 gap-0 [&>button]:hidden"
        onTouchStart={(e) => { toqueInicial.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (toqueInicial.current === null || fotos.length < 2) return;
          const delta = e.changedTouches[0].clientX - toqueInicial.current;
          toqueInicial.current = null;
          if (Math.abs(delta) > 50) (delta > 0 ? anterior : proxima)();
        }}
      >
        <DialogTitle className="sr-only">{titulo}</DialogTitle>
        <div className="relative flex min-h-[50vh] items-center justify-center">
          <img
            src={atual.url}
            alt={`${titulo} — foto ${indice + 1} de ${fotos.length}`}
            className="max-h-[85vh] w-full object-contain"
            decoding="async"
          />
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <X className="h-5 w-5" />
          </button>
          {fotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={anterior}
                aria-label="Foto anterior"
                className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={proxima}
                aria-label="Próxima foto"
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                {indice + 1} / {fotos.length}
              </span>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
