import { useMemo } from 'react';
import { parseDataLocal } from '@/lib/datas';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useCarreiraPremiacoes,
  useCarreiraConquistas,
} from '@/hooks/useCarreiraJornadaData';

type Categoria = 'coletivo' | 'individual';

interface TrofeuItem {
  id: string;
  categoria: Categoria;
  titulo: string;
  colocacaoLabel?: string;
  categoriaIdade?: string;
  nomeTime?: string;
  data: string; // ISO
  ano: number;
  fonte: 'campeonato' | 'conquista' | 'campeonato_premiacao' | 'evento_premiacao' | 'jogo_destaque';
  /** Só nos destaques de jogo: qual foi a partida ("vs PSG Barra · 2ª Rodada"). */
  partida?: string;
  colocacao?: string;
  emoji: string;
}

interface SalaTrofeusAtletaProps {
  criancaId: string | null | undefined;
  accentColor?: string;
  dadosPublicos?: {
    premiacoes?: boolean;
    campeonatos?: boolean;
    conquistas?: boolean;
  };
}

const POSICAO_META: Record<string, { label: string; emoji: string; color: string }> = {
  campeao: { label: 'Campeão', emoji: '🏆', color: '#f59e0b' },
  vice: { label: 'Vice-campeão', emoji: '🥈', color: '#94a3b8' },
  semifinalista: { label: 'Semifinalista', emoji: '🥉', color: '#d97706' },
  terceiro: { label: '3º Lugar', emoji: '🥉', color: '#d97706' },
  quartas: { label: 'Quartas de final', emoji: '🎖️', color: '#3b82f6' },
  oitavas: { label: 'Oitavas de final', emoji: '🎖️', color: '#3b82f6' },
  fase_grupos: { label: 'Fase de grupos', emoji: '🎖️', color: '#64748b' },
  eliminado: { label: 'Participação', emoji: '🎖️', color: '#64748b' },
};

const PREMIACAO_META: Record<string, { label: string; emoji: string }> = {
  melhor_jogador: { label: 'Melhor Jogador', emoji: '🏅' },
  melhor_goleiro: { label: 'Melhor Goleiro', emoji: '🧤' },
  artilheiro: { label: 'Artilheiro', emoji: '⚽' },
  melhor_defesa: { label: 'Melhor Defesa', emoji: '🛡️' },
  destaque: { label: 'Destaque da Partida', emoji: '⭐' },
  outro: { label: 'Reconhecimento', emoji: '🏅' },
};

// Hook: Campeonatos com posição final (coletivos) + premiações dos campeonatos (individuais)
export function useCarreiraCampeonatoTrofeus(criancaId: string | null | undefined) {
  return useQuery({
    queryKey: ['sala-trofeus-campeonatos', criancaId],
    queryFn: async (): Promise<TrofeuItem[]> => {
      if (!criancaId) return [];
      const [campRes, premRes, destRes] = await Promise.all([
        (supabase as any)
          .from('carreira_campeonatos')
          .select('id, nome, organizador, data_inicio, data_final, posicao_final, categoria, nome_time')
          .eq('crianca_id', criancaId),
        (supabase as any)
          .from('carreira_campeonato_premiacoes')
          .select('id, campeonato_id, tipo_premiacao, titulo, created_at')
          .eq('crianca_id', criancaId),
        (supabase as any)
          .from('carreira_jogos')
          .select('id, campeonato_id, data_jogo, time_adversario, fase_campeonato, time_atleta')
          .eq('crianca_id', criancaId)
          .eq('destaque_jogo', true),
      ]);
      if (campRes.error) throw campRes.error;
      if (premRes.error) throw premRes.error;
      if (destRes.error) throw destRes.error;

      const camps: any[] = campRes.data || [];
      const prems: any[] = premRes.data || [];
      const campMap = new Map(camps.map((c) => [c.id, c]));

      const items: TrofeuItem[] = [];

      // Coletivos: posicao_final relevante
      camps.forEach((c) => {
        const meta = POSICAO_META[c.posicao_final];
        if (!meta || c.posicao_final === 'em_andamento' || !c.posicao_final) return;
        const data = c.data_final || c.data_inicio;
        items.push({
          id: `camp-${c.id}`,
          categoria: 'coletivo',
          titulo: c.nome,
          colocacaoLabel: meta.label,
          categoriaIdade: c.categoria || undefined,
          nomeTime: c.nome_time || undefined,
          data,
          ano: data ? parseDataLocal(data).getFullYear() : new Date().getFullYear(),
          fonte: 'campeonato',
          colocacao: c.posicao_final,
          emoji: meta.emoji,
        });
      });

      // Individuais em campeonatos
      prems.forEach((p) => {
        const camp = campMap.get(p.campeonato_id);
        const meta = PREMIACAO_META[p.tipo_premiacao] || PREMIACAO_META.outro;
        const data = camp?.data_final || camp?.data_inicio || p.created_at;
        items.push({
          id: `cprem-${p.id}`,
          categoria: 'individual',
          titulo: camp?.nome || meta.label,
          colocacaoLabel: meta.label,
          categoriaIdade: camp?.categoria || undefined,
          nomeTime: camp?.nome_time || undefined,
          data,
          ano: data ? parseDataLocal(data).getFullYear() : new Date().getFullYear(),
          fonte: 'campeonato_premiacao',
          emoji: meta.emoji,
        });
      });

      // Destaque do jogo: cada partida em que o atleta foi o destaque, com o adversário e a fase
      ((destRes.data || []) as any[]).forEach((j) => {
        const camp = campMap.get(j.campeonato_id);
        items.push({
          id: `jdest-${j.id}`,
          categoria: 'individual',
          titulo: camp?.nome || 'Amistoso',
          colocacaoLabel: 'Destaque do jogo',
          categoriaIdade: camp?.categoria || undefined,
          nomeTime: j.time_atleta || camp?.nome_time || undefined,
          partida: [`vs ${j.time_adversario}`, j.fase_campeonato].filter(Boolean).join(' · '),
          data: j.data_jogo,
          ano: parseDataLocal(j.data_jogo).getFullYear(),
          fonte: 'jogo_destaque',
          emoji: '⭐',
        });
      });

      return items;
    },
    enabled: !!criancaId,
    // Os pais e o suporte editam jogos e premiações: quem abre o perfil precisa ver o que mudou, não a cópia de ontem.
    refetchOnMount: true,
  });
}

export function SalaTrofeusAtleta({
  criancaId,
  accentColor = '#3b82f6',
  dadosPublicos,
}: SalaTrofeusAtletaProps) {
  const flags = {
    premiacoes: dadosPublicos?.premiacoes !== false,
    campeonatos: dadosPublicos?.campeonatos !== false,
    conquistas: dadosPublicos?.conquistas !== false,
  };

  const { data: campTrofeus, isLoading: l1 } = useCarreiraCampeonatoTrofeus(
    flags.campeonatos || flags.premiacoes ? criancaId : null,
  );
  const { data: premiacoesEvt, isLoading: l2 } = useCarreiraPremiacoes(
    flags.premiacoes ? criancaId : null,
  );
  const { data: conquistas, isLoading: l3 } = useCarreiraConquistas(
    flags.conquistas ? criancaId : null,
  );

  const isLoading = l1 || l2 || l3;

  const items = useMemo<TrofeuItem[]>(() => {
    const all: TrofeuItem[] = [...(campTrofeus || [])];

    // Premiações de eventos (escolinha/atleta_id)
    (premiacoesEvt || []).forEach((p) => {
      const meta = PREMIACAO_META[p.tipo_premiacao] || PREMIACAO_META.outro;
      const data = p.evento?.data || '';
      all.push({
        id: `eprem-${p.id}`,
        categoria: 'individual',
        titulo: p.evento?.nome || meta.label,
        colocacaoLabel: meta.label,
        data,
        ano: data ? parseDataLocal(data).getFullYear() : new Date().getFullYear(),
        fonte: 'evento_premiacao',
        emoji: meta.emoji,
      });
    });

    // Conquistas coletivas sincronizadas (escolinha)
    (conquistas || []).forEach((c) => {
      const colocMeta = POSICAO_META[c.colocacao] || { label: c.colocacao, emoji: '🏆', color: accentColor };
      all.push({
        id: `conq-${c.id}`,
        categoria: 'coletivo',
        titulo: c.nome_campeonato,
        colocacaoLabel: colocMeta.label,
        categoriaIdade: c.categoria || undefined,
        data: `${c.ano}-12-31`,
        ano: c.ano,
        fonte: 'conquista',
        colocacao: c.colocacao,
        emoji: colocMeta.emoji,
      });
    });

    // Sort by data desc
    return all.sort((a, b) => parseDataLocal(b.data).getTime() - parseDataLocal(a.data).getTime());
  }, [campTrofeus, premiacoesEvt, conquistas, accentColor]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: accentColor }} />
        <h3 className="text-base font-medium text-muted-foreground mb-1">Sala de Troféus vazia</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Conquistas coletivas (campeão, vice…) e destaques individuais (melhor jogador, artilheiro, destaque do jogo…) aparecem aqui automaticamente.
        </p>
      </Card>
    );
  }

  // Stats
  const stats = {
    total: items.length,
    titulos: items.filter((i) => i.colocacao === 'campeao').length,
    vices: items.filter((i) => i.colocacao === 'vice').length,
    individuais: items.filter((i) => i.categoria === 'individual').length,
  };

  // Group by year (desc)
  const byYear = items.reduce<Record<number, TrofeuItem[]>>((acc, it) => {
    (acc[it.ano] ||= []).push(it);
    return acc;
  }, {});
  const anos = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <Card className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5" style={{ color: accentColor }} />
        <h3 className="text-lg font-semibold">Sala de Troféus</h3>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox label="Total" value={stats.total} accentColor={accentColor} />
        <StatBox label="Títulos" value={stats.titulos} color="#f59e0b" />
        <StatBox label="Vices" value={stats.vices} color="#94a3b8" />
        <StatBox label="Destaques" value={stats.individuais} color="#a855f7" />
      </div>

      {/* Lista por ano */}
      <div className="space-y-4">
        {anos.map((ano) => (
          <div key={ano}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">{ano}</h4>
              <Badge variant="secondary" className="text-[10px]">
                {byYear[ano].length}
              </Badge>
            </div>
            <div className="space-y-2">
              {byYear[ano].map((it) => (
                <TrofeuRow key={it.id} item={it} accentColor={accentColor} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function StatBox({ label, value, accentColor, color }: { label: string; value: number; accentColor?: string; color?: string }) {
  const c = color || accentColor || '#3b82f6';
  return (
    <div
      className="rounded-lg p-3 text-center border-2"
      style={{ borderColor: `${c}40`, backgroundColor: `${c}10` }}
    >
      <div className="text-2xl font-bold" style={{ color: c }}>{value}</div>
      <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function TrofeuRow({ item, accentColor }: { item: TrofeuItem; accentColor: string }) {
  const colocMeta = item.colocacao ? POSICAO_META[item.colocacao] : undefined;
  const corFundo =
    item.categoria === 'coletivo' && colocMeta
      ? colocMeta.color
      : item.categoria === 'individual'
      ? '#a855f7'
      : accentColor;

  const formattedDate = item.data
    ? format(parseDataLocal(item.data), "dd 'de' MMM", { locale: ptBR })
    : '';

  const Icone = item.categoria === 'coletivo' ? Trophy : Medal;

  const colocLinha = [item.colocacaoLabel, item.categoriaIdade].filter(Boolean).join(' • ');

  return (
    <div
      className="flex items-stretch gap-3 p-3 rounded-lg border"
      style={{ borderColor: `${corFundo}40`, backgroundColor: `${corFundo}10` }}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <h5 className="font-semibold text-sm leading-snug truncate" title={item.titulo}>
          {item.titulo}
        </h5>
        {colocLinha && (
          <p className="text-xs font-medium" style={{ color: corFundo }}>
            {colocLinha}
          </p>
        )}
        {item.nomeTime && (
          <p className="text-xs text-muted-foreground truncate">{item.nomeTime}</p>
        )}
        {item.partida && (
          <p className="text-xs text-muted-foreground truncate" title={item.partida}>{item.partida}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0"
            style={{ borderColor: `${corFundo}60`, color: corFundo }}
          >
            {item.categoria === 'coletivo' ? 'Coletivo' : 'Individual'}
          </Badge>
          {formattedDate && (
            <span className="text-[10px] text-muted-foreground">{formattedDate}</span>
          )}
        </div>
      </div>
      <Icone className="w-5 h-5 mt-0.5 shrink-0" style={{ color: corFundo }} />
    </div>
  );
}
