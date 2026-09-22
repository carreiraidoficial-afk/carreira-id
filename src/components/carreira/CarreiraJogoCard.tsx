import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Trash2, X, Loader2, MoreVertical, ChevronDown, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { JogoComMidia, JogoMidia } from '@/types/jornada-esportiva';
import { isModalidadeVolei, isModalidadeBasquete } from '@/constants/esportes';

const POSICAO_VOLEI_LABEL: Record<string, string> = {
  levantador: 'Levantador', oposto: 'Oposto', ponteiro: 'Ponteiro', central: 'Central', libero: 'Líbero',
};

const POSICAO_BASQUETE_LABEL: Record<string, string> = {
  armador: 'Armador', 'ala-armador': 'Ala-Armador', ala: 'Ala', 'ala-pivo': 'Ala-Pivô', pivo: 'Pivô',
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
  const [obsOpen, setObsOpen] = useState(false);

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
  const isBasquete = isModalidadeBasquete((j as any).modalidade);

  const isVideoUrl = (url: string) => /\.(mp4|mov|webm|m4v|avi|mkv)(\?|$)/i.test(url);

  return (
    <div
      className="relative p-3 rounded-lg"
      style={{ backgroundColor: `${accentColor}08`, borderLeft: `3px solid ${accentColor}50` }}
    >
      {isOwner && (onEdit || onDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 absolute top-1.5 right-1.5 z-10">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(j)}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem onClick={() => onDelete(j.id)} className="text-destructive focus:text-destructive">
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <div className="min-w-0 pr-8">
        {/* Confronto: escudo + nome de cada time, placar em destaque no meio */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1 w-[72px] shrink-0">
            {j.logo_time_atleta_url ? (
              <img src={j.logo_time_atleta_url} alt="" className="w-9 h-9 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <Shield className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <span className="text-[11px] font-medium text-foreground text-center leading-tight line-clamp-2">{meuTime}</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2 text-xl font-bold">
            {temPlacar ? (
              <>
                <span className={placarColor}>{j.placar_time_atleta}</span>
                <span className="text-muted-foreground text-sm font-normal">×</span>
                <span className={placarColor}>{j.placar_adversario}</span>
              </>
            ) : (
              <span className="text-muted-foreground text-sm font-normal">vs</span>
            )}
          </div>
          <div className="flex flex-col items-center gap-1 w-[72px] shrink-0">
            {j.logo_time_adversario_url ? (
              <img src={j.logo_time_adversario_url} alt="" className="w-9 h-9 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <Shield className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <span className="text-[11px] font-medium text-foreground text-center leading-tight line-clamp-2">{j.time_adversario}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 text-center">
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
          ) : isBasquete ? (
            <>
              {j.posicao_jogo && POSICAO_BASQUETE_LABEL[j.posicao_jogo] && <Tag>🏀 {POSICAO_BASQUETE_LABEL[j.posicao_jogo]}</Tag>}
              {!!j.pontos && <Tag>🏀 {j.pontos} pts</Tag>}
              {!!j.assistencias && <Tag>🎯 {j.assistencias} assist.</Tag>}
              {(!!j.rebotes_ofensivos || !!j.rebotes_defensivos) && (
                <Tag>🔁 {(j.rebotes_ofensivos || 0) + (j.rebotes_defensivos || 0)} rebotes</Tag>
              )}
              {!!j.roubos_bola && <Tag>🖐️ {j.roubos_bola} roubo(s)</Tag>}
              {!!j.tocos && <Tag>🚫 {j.tocos} toco(s)</Tag>}
              {!!j.faltas_cometidas && <Tag>⚠️ {j.faltas_cometidas} falta(s)</Tag>}
              {!!j.minutos_jogados && <Tag>⏱️ {j.minutos_jogados}'</Tag>}
            </>
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
        {!isVolei && !isBasquete && j.teve_disputa_penaltis && (
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
        {isBasquete && j.quartos_detalhe && j.quartos_detalhe.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Quartos: {j.quartos_detalhe.map((q) => `${q.pontos_time}-${q.pontos_adversario}`).join(' · ')}
          </p>
        )}
        {j.observacoes && (
          <Collapsible open={obsOpen} onOpenChange={setObsOpen} className="mt-1.5">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center gap-1 text-[11px] font-medium text-primary">
                <ChevronDown className={`w-3 h-3 transition-transform ${obsOpen ? 'rotate-180' : ''}`} />
                {obsOpen ? 'Ocultar observações' : 'Ver observações'}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">{j.observacoes}</p>
            </CollapsibleContent>
          </Collapsible>
        )}
        {j.midias && j.midias.length > 0 && (
          <div className="grid grid-cols-4 gap-1 mt-2">
            {j.midias.slice(0, 8).map((m) => (
              <MidiaThumb key={m.id} midia={m} onOpen={(url) => setLightbox(url)} />
            ))}
          </div>
        )}
      </div>

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
