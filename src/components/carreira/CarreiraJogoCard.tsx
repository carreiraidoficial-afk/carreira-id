import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { JogoComMidia, JogoMidia } from '@/types/jornada-esportiva';
import { isModalidadeVolei } from '@/constants/esportes';

const POSICAO_VOLEI_LABEL: Record<string, string> = {
  levantador: 'Levantador', oposto: 'Oposto', ponteiro: 'Ponteiro', central: 'Central', libero: 'Líbero',
};

interface Props {
  jogo: JogoComMidia;
  isOwner?: boolean;
  accentColor?: string;
  onEdit?: (j: JogoComMidia) => void;
  onDelete?: (id: string) => void;
}

const isHeicUrl = (url: string) => /\.(heic|heif)(\?|$)/i.test(url);

// Converte HEIC remoto em blob URL JPEG sob demanda
async function convertHeicUrlToJpegBlobUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  const heic2any = (await import('heic2any')).default;
  const converted = await heic2any({ blob, toType: 'image/jpeg', quality: 0.85 });
  const finalBlob = Array.isArray(converted) ? converted[0] : converted;
  return URL.createObjectURL(finalBlob);
}

function MidiaThumb({
  midia,
  onOpen,
}: {
  midia: JogoMidia;
  onOpen: (resolvedUrl: string) => void;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    isHeicUrl(midia.url_midia) ? null : midia.url_midia,
  );
  const [failed, setFailed] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    let revoke: string | null = null;
    if (midia.tipo_midia !== 'video' && isHeicUrl(midia.url_midia) && !resolvedUrl && !failed) {
      setConverting(true);
      convertHeicUrlToJpegBlobUrl(midia.url_midia)
        .then((u) => {
          revoke = u;
          setResolvedUrl(u);
        })
        .catch((err) => {
          console.error('Falha ao converter HEIC:', err);
          setFailed(true);
        })
        .finally(() => setConverting(false));
    }
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midia.url_midia]);

  const handleClick = () => {
    if (midia.tipo_midia === 'video') {
      onOpen(midia.url_midia);
    } else if (resolvedUrl) {
      onOpen(resolvedUrl);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      className="aspect-square rounded overflow-hidden bg-muted block relative cursor-zoom-in"
    >
      {midia.tipo_midia === 'video' ? (
        <video
          src={midia.url_midia}
          className="w-full h-full object-cover pointer-events-none"
          onContextMenu={(e) => e.preventDefault()}
        />
      ) : converting ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : failed || !resolvedUrl ? (
        <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground p-1 text-center">
          Pré-visualização indisponível
        </div>
      ) : (
        <img
          src={resolvedUrl}
          alt=""
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full h-full object-cover pointer-events-none select-none"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </button>
  );
}

export function CarreiraJogoCard({ jogo, isOwner, accentColor = '#3b82f6', onEdit, onDelete }: Props) {
  const j = jogo;
  const [lightbox, setLightbox] = useState<string | null>(null);

  const placarColor = (() => {
    if (j.placar_time_atleta == null || j.placar_adversario == null) return 'text-muted-foreground';
    if (j.placar_time_atleta > j.placar_adversario) return 'text-emerald-600';
    if (j.placar_time_atleta < j.placar_adversario) return 'text-red-600';
    return 'text-muted-foreground';
  })();

  const dataFmt = (() => {
    try { return format(new Date(j.data_jogo), "dd 'de' MMM yyyy", { locale: ptBR }); }
    catch { return j.data_jogo; }
  })();

  const meuTime = j.time_atleta?.trim() || 'Meu time';
  const temPlacar = j.placar_time_atleta != null && j.placar_adversario != null;
  const isVolei = isModalidadeVolei((j as any).modalidade);
  const isLibero = isVolei && j.posicao_jogo === 'libero';

  const isVideoUrl = (url: string) => /\.(mp4|mov|webm|m4v|avi|mkv)(\?|$)/i.test(url);

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg"
      style={{ backgroundColor: `${accentColor}08`, borderLeft: `3px solid ${accentColor}50` }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap text-sm font-medium text-foreground">
          <span className="truncate">{meuTime}</span>
          {temPlacar && (
            <span className={`font-bold ${placarColor}`}>{j.placar_time_atleta}</span>
          )}
          <span className="text-muted-foreground">x</span>
          {temPlacar && (
            <span className={`font-bold ${placarColor}`}>{j.placar_adversario}</span>
          )}
          <span className="truncate">{j.time_adversario}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {dataFmt}{j.local ? ` • ${j.local}` : ''}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-1.5 text-[11px]">
          {isVolei ? (
            isLibero ? (
              <>
                <Tag>🎯 Líbero</Tag>
                {j.recepcoes_realizadas != null && <Tag>🙌 {j.recepcoes_realizadas} recepções</Tag>}
                {j.defesas_realizadas != null && <Tag>🛡️ {j.defesas_realizadas} defesas</Tag>}
                {!!j.erros_recepcao && <Tag>❌ {j.erros_recepcao} erro(s) recepção</Tag>}
              </>
            ) : (
              <>
                {j.posicao_jogo && POSICAO_VOLEI_LABEL[j.posicao_jogo] && <Tag>🏐 {POSICAO_VOLEI_LABEL[j.posicao_jogo]}</Tag>}
                {!!j.pontos_ataque && <Tag>⚡ {j.pontos_ataque} ataque</Tag>}
                {!!j.pontos_bloqueio && <Tag>🧱 {j.pontos_bloqueio} bloqueio</Tag>}
                {!!j.pontos_saque && <Tag>🎾 {j.pontos_saque} saque</Tag>}
                {!!j.erros_cometidos && <Tag>❌ {j.erros_cometidos} erro(s)</Tag>}
              </>
            )
          ) : j.posicao_jogo === 'goleiro' ? (
            <>
              <Tag>🧤 Goleiro</Tag>
              {j.defesas_importantes != null && <Tag>🛡️ {j.defesas_importantes} defesa(s)</Tag>}
              {j.gols_sofridos != null && <Tag>🥅 {j.gols_sofridos} sofrido(s)</Tag>}
              {!!j.penaltis_defendidos && <Tag>⛔ {j.penaltis_defendidos} pên. def.</Tag>}
              {!!j.minutos_jogados && <Tag>⏱️ {j.minutos_jogados}'</Tag>}
            </>
          ) : (
            <>
              {!!j.gols_marcados && <Tag>⚽ {j.gols_marcados} gol(s) do atleta</Tag>}
              {!!j.gols_penalti && <Tag>🎯 {j.gols_penalti} de pênalti</Tag>}
              {!!j.assistencias && <Tag>🎯 {j.assistencias} assist. do atleta</Tag>}
            </>
          )}
          {!isVolei && j.teve_prorrogacao && <Tag>⏱️ Prorrogação</Tag>}
          {j.fase_campeonato && <Tag>{j.fase_campeonato}</Tag>}
        </div>
        {!isVolei && j.teve_disputa_penaltis && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Disputa de pênaltis: <strong>{j.placar_penaltis_time ?? '?'} × {j.placar_penaltis_adversario ?? '?'}</strong>
            {j.posicao_jogo === 'goleiro' && j.penaltis_defendidos_disputa != null && ` · ${j.penaltis_defendidos_disputa} def.`}
            {j.posicao_jogo !== 'goleiro' && !!j.penaltis_convertidos_disputa && ` · converteu ${j.penaltis_convertidos_disputa}`}
          </p>
        )}
        {isVolei && j.sets_detalhe && j.sets_detalhe.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Sets: {j.sets_detalhe.map((s) => `${s.pontos_time}-${s.pontos_adversario}`).join(' · ')}
          </p>
        )}
        {j.observacoes && <p className="text-xs text-muted-foreground mt-1.5">{j.observacoes}</p>}
        {j.midias && j.midias.length > 0 && (
          <div className="grid grid-cols-4 gap-1 mt-2">
            {j.midias.slice(0, 8).map((m) => (
              <MidiaThumb key={m.id} midia={m} onOpen={(url) => setLightbox(url)} />
            ))}
          </div>
        )}
      </div>
      {isOwner && (
        <div className="flex items-center gap-0.5 shrink-0">
          {onEdit && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(j)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(j.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent
          className="max-w-4xl p-0 bg-black/95 border-0"
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
          {lightbox && (
            isVideoUrl(lightbox) ? (
              <video
                src={lightbox}
                controls
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture
                onContextMenu={(e) => e.preventDefault()}
                className="w-full max-h-[85vh] object-contain"
              />
            ) : (
              <img
                src={lightbox}
                alt=""
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className="w-full max-h-[85vh] object-contain select-none"
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{children}</span>;
}
