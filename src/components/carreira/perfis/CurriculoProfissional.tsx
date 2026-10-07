import type { LucideIcon } from 'lucide-react';
import { Languages, Medal, Star, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { lerConquistas, lerIdiomas, percentualNivel, type TipoConquista } from '@/lib/perfil-profissional';

interface Props {
  dados: Record<string, any> | null | undefined;
  accentColor?: string;
}

const ICONE_CONQUISTA: Record<TipoConquista, { Icone: LucideIcon; cor: string }> = {
  ouro: { Icone: Trophy, cor: '#f59e0b' },
  prata: { Icone: Medal, cor: '#94a3b8' },
  bronze: { Icone: Medal, cor: '#d97706' },
  estrela: { Icone: Star, cor: '#f59e0b' },
};

/** Conquistas (honrarias e cargos de destaque) do profissional, com ícone por tipo. */
export function ConquistasProfissionalCard({ dados, accentColor = '#3b82f6' }: Props) {
  const conquistas = lerConquistas(dados);
  if (conquistas.length === 0) return null;
  return (
    <Card className="p-5">
      <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <Trophy className="w-4 h-4" style={{ color: accentColor }} />
        Conquistas
      </h2>
      <ul className="divide-y divide-border">
        {conquistas.map((c, i) => {
          const { Icone, cor } = ICONE_CONQUISTA[c.tipo];
          const detalhe = [c.descricao, c.ano].filter(Boolean).join(' · ');
          return (
            <li key={`${c.titulo}-${i}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${cor}1f`, color: cor }}>
                <Icone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground break-words">{c.titulo}</p>
                {detalhe && <p className="text-xs text-muted-foreground break-words">{detalhe}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Idiomas com barra de nível (relevante para quem busca oportunidade no exterior). */
export function IdiomasProfissionalCard({ dados, accentColor = '#3b82f6' }: Props) {
  const idiomas = lerIdiomas(dados);
  if (idiomas.length === 0) return null;
  return (
    <Card className="p-5">
      <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <Languages className="w-4 h-4" style={{ color: accentColor }} />
        Idiomas
      </h2>
      <ul className="space-y-3">
        {idiomas.map((i, idx) => (
          <li key={`${i.idioma}-${idx}`} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
            <span className="text-sm font-medium text-foreground break-words">{i.idioma}</span>
            <span className="text-xs text-muted-foreground">{i.nivel}</span>
            <div
              className="col-span-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={`${i.idioma}: ${i.nivel}`}
              aria-valuenow={percentualNivel(i.nivel)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full" style={{ width: `${percentualNivel(i.nivel)}%`, backgroundColor: accentColor }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
