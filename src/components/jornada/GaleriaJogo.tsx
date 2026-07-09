import { useState } from 'react';
import type { JogoMidia } from '@/types/jornada-esportiva';

interface Props {
  midias: JogoMidia[];
  onDelete: (id: string) => Promise<void> | void;
}

export function GaleriaJogo({ midias, onDelete }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  if (!midias || midias.length === 0) return null;
  const active = midias[Math.min(activeIdx, midias.length - 1)];

  return (
    <div className="space-y-2">
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        {active.tipo_midia === 'video' ? (
          <video
            src={active.url_midia}
            controls
            preload="metadata"
            className="w-full h-full object-contain"
          />
        ) : (
          <img
            src={active.url_midia}
            alt="Mídia do jogo"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain"
          />
        )}
        <span className="absolute top-2 left-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded">
          {active.tipo_midia}
        </span>
        <button
          onClick={async () => {
            if (!confirm('Excluir esta mídia?')) return;
            await onDelete(active.id);
            setActiveIdx(0);
          }}
          className="absolute top-2 right-2 text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
        >
          🗑️
        </button>
      </div>
      {midias.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {midias.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setActiveIdx(i)}
              className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
                i === activeIdx ? 'border-blue-600' : 'border-gray-200'
              }`}
            >
              {m.tipo_midia === 'video' ? (
                <div className="w-full h-full bg-gray-800 text-white flex items-center justify-center text-xs">
                  ▶
                </div>
              ) : (
                <img
                  src={m.url_midia}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
