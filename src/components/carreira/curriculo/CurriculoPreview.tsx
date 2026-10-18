import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  blob: Blob;
}

/**
 * Mostra as páginas do PDF como imagens, uma sob a outra. Funciona no celular, onde o navegador não exibe PDF
 * dentro da página. A biblioteca (pdf.js) só é carregada quando a prévia abre.
 */
export function CurriculoPreview({ blob }: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');

  useEffect(() => {
    let cancelado = false;
    const area = areaRef.current;
    if (!area) return;
    area.innerHTML = '';
    setEstado('carregando');

    (async () => {
      try {
        const [pdfjs, worker] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ]);
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
        const larguraCss = Math.min(area.clientWidth || 600, 720);
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

        for (let n = 1; n <= doc.numPages; n++) {
          if (cancelado) return;
          const pagina = await doc.getPage(n);
          const base = pagina.getViewport({ scale: 1 });
          const escala = (larguraCss / base.width) * dpr;
          const viewport = pagina.getViewport({ scale: escala });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.borderRadius = '6px';
          canvas.style.boxShadow = '0 1px 6px rgba(0,0,0,0.25)';
          await pagina.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
          if (cancelado) return;
          const caixa = document.createElement('div');
          caixa.style.position = 'relative';
          caixa.style.marginBottom = '12px';
          caixa.appendChild(canvas);
          // Links do PDF (vídeos dos jogos) viram links clicáveis que abrem em nova aba: a pessoa não sai do app.
          const anotacoes: any[] = await pagina.getAnnotations();
          anotacoes
            .filter((a) => a.subtype === 'Link' && typeof a.url === 'string' && /^https?:/i.test(a.url))
            .forEach((a) => {
              const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(a.rect);
              const link = document.createElement('a');
              link.href = a.url;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.title = 'Abrir em nova aba';
              link.style.position = 'absolute';
              link.style.left = `${(Math.min(x1, x2) / viewport.width) * 100}%`;
              link.style.top = `${(Math.min(y1, y2) / viewport.height) * 100}%`;
              link.style.width = `${(Math.abs(x2 - x1) / viewport.width) * 100}%`;
              link.style.height = `${(Math.abs(y2 - y1) / viewport.height) * 100}%`;
              caixa.appendChild(link);
            });
          if (cancelado) return;
          area.appendChild(caixa);
        }
        if (!cancelado) setEstado('pronto');
        doc.destroy();
      } catch (err) {
        console.error('[CurriculoPreview] erro ao mostrar a prévia:', err);
        if (!cancelado) setEstado('erro');
      }
    })();

    return () => { cancelado = true; };
  }, [blob]);

  return (
    <div className="relative">
      {estado === 'carregando' && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Montando a prévia...
        </div>
      )}
      {estado === 'erro' && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Não foi possível mostrar a prévia, mas você ainda pode baixar o PDF.
        </p>
      )}
      <div ref={areaRef} />
    </div>
  );
}
