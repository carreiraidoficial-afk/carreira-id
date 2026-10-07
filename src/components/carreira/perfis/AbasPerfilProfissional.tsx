import type { ReactNode } from 'react';

export type AbaProfissionalId = 'visao' | 'informacoes' | 'historico' | 'conquistas' | 'galeria' | 'publicacoes';

const ABAS: { id: AbaProfissionalId; rotulo: string }[] = [
  { id: 'visao', rotulo: 'Visão geral' },
  { id: 'informacoes', rotulo: 'Informações' },
  { id: 'historico', rotulo: 'Histórico' },
  { id: 'conquistas', rotulo: 'Conquistas' },
  { id: 'galeria', rotulo: 'Galeria' },
  { id: 'publicacoes', rotulo: 'Publicações' },
];

export const ABAS_PROFISSIONAL_VALIDAS = ABAS.map((a) => a.id) as string[];

interface Props {
  aba: AbaProfissionalId;
  onAba: (aba: AbaProfissionalId) => void;
  accentColor: string;
  /** Abas que dependem de conteúdo (ou de o visitante ser o dono): as demais sempre aparecem. */
  visiveis: { historico: boolean; conquistas: boolean; galeria: boolean };
  conteudos: Record<AbaProfissionalId, ReactNode>;
}

/** Abas do perfil de profissional (Visão geral, Informações, Histórico, Conquistas, Galeria, Publicações).
 * Aba sem conteúdo só aparece para o dono; se a aba pedida na URL não está visível, cai na Visão geral. */
export function AbasPerfilProfissional({ aba, onAba, accentColor, visiveis, conteudos }: Props) {
  const abasVisiveis = ABAS.filter((a) => (a.id === 'historico' || a.id === 'conquistas' || a.id === 'galeria' ? visiveis[a.id] : true));
  const ativa = abasVisiveis.some((a) => a.id === aba) ? aba : 'visao';

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Seções do perfil"
        className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {abasVisiveis.map((a) => {
          const selecionada = a.id === ativa;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={selecionada}
              onClick={() => onAba(a.id)}
              className={`shrink-0 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                selecionada ? 'text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              style={selecionada ? { backgroundColor: accentColor, borderColor: accentColor } : { borderColor: 'transparent' }}
            >
              {a.rotulo}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="space-y-4">{conteudos[ativa]}</div>
    </div>
  );
}
