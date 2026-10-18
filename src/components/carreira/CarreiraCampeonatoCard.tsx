import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Trash2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CampeonatoComJogos, JogoComMidia, PosicaoFinalCampeonato, TorneioAbrangencia } from '@/types/jornada-esportiva';
import { CarreiraJogoCard } from './CarreiraJogoCard';

const ABRANGENCIA_LABEL: Record<TorneioAbrangencia, string> = {
  regional: 'Regional',
  estadual: 'Estadual',
  nacional: 'Nacional',
  internacional: 'Internacional',
};

const POSICAO_FINAL_META: Record<PosicaoFinalCampeonato, { label: string; bg: string; fg: string; emoji: string } | undefined> = {
  campeao: { label: 'Campeão', bg: '#fef3c7', fg: '#92400e', emoji: '🏆' },
  vice: { label: 'Vice', bg: '#e5e7eb', fg: '#374151', emoji: '🥈' },
  semifinalista: { label: 'Semifinalista', bg: '#fde68a', fg: '#78350f', emoji: '🥉' },
  quartas: { label: 'Quartas', bg: '#dbeafe', fg: '#1e3a8a', emoji: '' },
  oitavas: { label: 'Oitavas', bg: '#dbeafe', fg: '#1e3a8a', emoji: '' },
  fase_grupos: { label: 'Fase de grupos', bg: '#f3f4f6', fg: '#374151', emoji: '' },
  eliminado: { label: 'Eliminado', bg: '#fee2e2', fg: '#991b1b', emoji: '' },
  em_andamento: undefined,
};

const TIPO_PREM_META: Record<string, { label: string; emoji: string }> = {
  melhor_jogador: { label: 'Melhor jogador', emoji: '🏆' },
  melhor_goleiro: { label: 'Melhor goleiro', emoji: '🧤' },
  artilheiro: { label: 'Artilheiro', emoji: '⚽' },
  melhor_defesa: { label: 'Melhor defesa', emoji: '🛡️' },
  destaque: { label: 'Destaque', emoji: '⭐' },
  outro: { label: 'Outro', emoji: '🏅' },
};

interface Props {
  campeonato: CampeonatoComJogos;
  isOwner?: boolean;
  accentColor?: string;
  onEdit?: (c: CampeonatoComJogos) => void;
  onDelete?: (id: string) => void;
  onEditJogo?: (j: JogoComMidia) => void;
  onDeleteJogo?: (id: string) => void;
}

export function CarreiraCampeonatoCard({
  campeonato, isOwner, accentColor = '#3b82f6',
  onEdit, onDelete, onEditJogo, onDeleteJogo,
}: Props) {
  const [open, setOpen] = useState(false);
  const c = campeonato;
  const times = Array.from(new Set(c.jogos.map((j) => j.time_atleta?.trim()).filter(Boolean) as string[]));
  const timeFromJogos = times.length > 1 ? `${times[0]} +${times.length - 1}` : times[0];
  const nomeTime = (c as any).nome_time || timeFromJogos;
  const categoria = (c as any).categoria as string | undefined;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: `${accentColor}08`, border: `1px solid ${accentColor}30` }}
    >
      <div className="p-3 flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
          style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
        >
          {c.logo_url ? (
            <img src={c.logo_url} alt={c.nome} className="w-full h-full object-cover" />
          ) : (
            <Trophy className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm" style={{ color: accentColor }}>{c.nome}</h4>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              {ABRANGENCIA_LABEL[c.abrangencia]}
            </span>
            {c.posicao_final && ['campeao', 'vice', 'terceiro'].includes(c.posicao_final) && POSICAO_FINAL_META[c.posicao_final as PosicaoFinalCampeonato] && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{
                  backgroundColor: POSICAO_FINAL_META[c.posicao_final as PosicaoFinalCampeonato]!.bg,
                  color: POSICAO_FINAL_META[c.posicao_final as PosicaoFinalCampeonato]!.fg,
                }}
              >
                {POSICAO_FINAL_META[c.posicao_final as PosicaoFinalCampeonato]!.emoji} {POSICAO_FINAL_META[c.posicao_final as PosicaoFinalCampeonato]!.label}
              </span>
            )}
          </div>
          {(categoria || nomeTime) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground">
              {categoria && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}40` }}
                >
                  {categoria}
                </span>
              )}
              {nomeTime && <span className="truncate">{nomeTime}</span>}
            </div>
          )}
          {(c.premiacoes || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {c.premiacoes.map((p) => {
                const meta = TIPO_PREM_META[p.tipo_premiacao] || TIPO_PREM_META.outro;
                return (
                  <span
                    key={p.id}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                    title={p.titulo || meta.label}
                  >
                    {meta.emoji} {meta.label}{p.titulo ? ` (${p.titulo})` : ''}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(!open)}>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          {isOwner && onEdit && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(c)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {isOwner && onDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(c.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {c.jogos.length > 0 ? (
            c.jogos.map((j) => (
              <CarreiraJogoCard
                key={j.id}
                jogo={j}
                isOwner={isOwner}
                accentColor={accentColor}
                onEdit={onEditJogo}
                onDelete={onDeleteJogo}
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum jogo cadastrado neste campeonato.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Mini({ children }: { children: React.ReactNode }) {
  return <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{children}</span>;
}
