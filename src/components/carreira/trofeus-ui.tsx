import type { ReactNode } from 'react';
import { Award, Medal, Trophy } from 'lucide-react';

/** Peças visuais compartilhadas pelas salas de troféus (atleta e escola), para as duas ficarem com a mesma linguagem. */

export interface ItemFaixa {
  valor: number;
  rotulo: string;
  cor: string;
  /** Contadores zerados somem da faixa (menos o "Total"), para a sala não parecer vazia. */
  esconderSeZero?: boolean;
}

export function FaixaConquistas({ itens }: { itens: ItemFaixa[] }) {
  const visiveis = itens.filter((i) => !(i.esconderSeZero && i.valor === 0));
  return (
    <div className="flex rounded-xl border bg-muted/30 py-2.5" style={{ borderTop: `2px solid ${visiveis[0]?.cor ?? '#3b82f6'}` }}>
      {visiveis.map((item, i) => (
        <div key={item.rotulo} className={`flex-1 min-w-0 text-center ${i > 0 ? 'border-l' : ''}`}>
          <div className="text-xl font-bold leading-none" style={{ color: item.cor }}>{item.valor}</div>
          <div className="mt-1 truncate px-1 text-[10px] uppercase tracking-wide text-muted-foreground">{item.rotulo}</div>
        </div>
      ))}
    </div>
  );
}

/** Frase de abertura da sala: leva o foco para o que existe, em vez de mostrar "0 títulos". */
export function resumoConquistas({ titulos, vices, anoRecente }: { titulos: number; vices: number; anoRecente?: number }): string | null {
  if (titulos > 0) return titulos === 1 ? '1 título conquistado' : `${titulos} títulos conquistados`;
  if (vices > 0) return anoRecente ? `Finalista em ${anoRecente}` : 'Finalista';
  return null;
}

type Tipo = 'campeao' | 'vice' | 'terceiro' | 'outro' | 'individual';

const GRADIENTES: Record<Tipo, [string, string]> = {
  campeao: ['#fde68a', '#d97706'],
  vice: ['#f1f5f9', '#94a3b8'],
  terceiro: ['#fdba74', '#b45309'],
  outro: ['#bfdbfe', '#3b82f6'],
  individual: ['#e9d5ff', '#9333ea'],
};

export function tipoDoSelo(colocacao?: string, individual?: boolean): Tipo {
  if (individual) return 'individual';
  if (colocacao === 'campeao') return 'campeao';
  if (colocacao === 'vice') return 'vice';
  if (colocacao === 'terceiro' || colocacao === 'semifinalista') return 'terceiro';
  return 'outro';
}

/** Selo redondo com a cor da colocação: dourado (campeão), prata (vice), bronze (3º/semifinal). */
export function SeloTrofeu({ tipo }: { tipo: Tipo }) {
  const [claro, escuro] = GRADIENTES[tipo];
  const Icone = tipo === 'campeao' ? Trophy : tipo === 'vice' || tipo === 'terceiro' ? Medal : Award;
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      style={{
        backgroundImage: `linear-gradient(145deg, ${claro}, ${escuro})`,
        boxShadow: tipo === 'campeao' ? `0 0 14px ${escuro}80` : `0 1px 4px ${escuro}60`,
      }}
    >
      <Icone className="h-5 w-5" style={{ color: tipo === 'vice' ? '#475569' : '#ffffff' }} />
    </div>
  );
}

export function CabecalhoSala({ icone, resumo, direita, titulo = 'Sala de Troféus' }: { icone: ReactNode; resumo: string | null; direita?: ReactNode; titulo?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-lg font-semibold">
          {icone}
          {titulo}
        </div>
        {resumo && <p className="mt-0.5 text-xs text-muted-foreground">{resumo}</p>}
      </div>
      {direita}
    </div>
  );
}
