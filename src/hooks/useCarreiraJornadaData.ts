import { useQuery } from '@tanstack/react-query';
import { useJornada } from './useJornada';


// ========== Types ==========

export interface GolPublico {
  id: string;
  evento_id: string;
  crianca_id: string;
  quantidade: number;
  evento?: {
    id: string;
    nome: string;
    data: string;
    tipo: string;
    adversario: string | null;
    local: string | null;
    placar_time1: number | null;
    placar_time2: number | null;
    status: string;
  };
  time?: {
    id: string;
    nome: string;
  };
}

export interface AmistosoConvocacaoPublica {
  id: string;
  evento_id: string;
  crianca_id: string;
  status: string;
  presente: boolean | null;
  evento?: {
    id: string;
    nome: string;
    data: string;
    tipo: string;
    adversario: string | null;
    local: string | null;
    placar_time1: number | null;
    placar_time2: number | null;
    status: string;
  };
}

export interface CampeonatoConvocacaoPublica {
  id: string;
  campeonato_id: string;
  crianca_id: string;
  status: string;
  campeonato?: {
    id: string;
    nome: string;
    ano: number;
    categoria: string | null;
    status: string;
    nome_time: string | null;
    escolinha?: {
      id: string;
      nome: string;
    };
  };
}

export interface PremiacaoPublica {
  id: string;
  evento_id: string;
  crianca_id: string;
  tipo_premiacao: string;
  evento?: {
    id: string;
    nome: string;
    data: string;
    tipo: string;
  };
}

export interface ConquistaPublica {
  id: string;
  evento_id: string;
  escolinha_id: string;
  nome_campeonato: string;
  colocacao: string;
  ano: number;
  categoria: string | null;
}

export interface CarreiraStats {
  totalGols: number;
  totalJogos: number;
  totalCampeonatos: number;
  totalPremiacoes: number;
  totalConquistas: number;
}

// ========== Hooks ==========

export function useCarreiraGols(criancaId: string | null | undefined) {
  return useQuery({
    queryKey: ['carreira-gols', criancaId],
    queryFn: async () => [] as GolPublico[],
    enabled: !!criancaId,
  });
}

export function useCarreiraAmistosos(criancaId: string | null | undefined) {
  return useQuery({
    queryKey: ['carreira-amistosos', criancaId],
    queryFn: async () => [] as AmistosoConvocacaoPublica[],
    enabled: !!criancaId,
  });
}

export function useCarreiraCampeonatos(criancaId: string | null | undefined) {
  return useQuery({
    queryKey: ['carreira-campeonatos', criancaId],
    queryFn: async () => [] as CampeonatoConvocacaoPublica[],
    enabled: !!criancaId,
  });
}

export function useCarreiraPremiacoes(criancaId: string | null | undefined) {
  return useQuery({
    queryKey: ['carreira-premiacoes', criancaId],
    queryFn: async () => [] as PremiacaoPublica[],
    enabled: !!criancaId,
  });
}

export function useCarreiraConquistas(criancaId: string | null | undefined) {
  return useQuery({
    queryKey: ['carreira-conquistas', criancaId],
    queryFn: async () => [] as ConquistaPublica[],
    enabled: !!criancaId,
  });
}

// ========== Aggregated Stats ==========

export interface CarreiraStatsExtended extends CarreiraStats {
  totalAssistencias: number;
  totalVitorias: number;
  // Goleiro
  jogosComoGoleiro: number;
  totalDefesas: number;
  totalGolsSofridos: number;
  totalPenaltisDefendidos: number;
  minutosGoleiro: number;
}

export interface UseCarreiraStatsResult {
  stats: CarreiraStatsExtended;
  anosDisponiveis: number[];
}

const yearOf = (s?: string | null): number | null => {
  if (!s) return null;
  const y = new Date(s).getFullYear();
  return Number.isFinite(y) ? y : null;
};

export function useCarreiraStats(
  criancaId: string | null | undefined,
  ano: number | 'todos' = 'todos',
): UseCarreiraStatsResult {
  const { data: gols } = useCarreiraGols(criancaId);
  const { data: amistosos } = useCarreiraAmistosos(criancaId);
  const { data: campeonatos } = useCarreiraCampeonatos(criancaId);
  const { data: premiacoes } = useCarreiraPremiacoes(criancaId);
  const { data: conquistas } = useCarreiraConquistas(criancaId);
  const jornada = useJornada(criancaId ?? null);

  // ===== Coletar anos disponíveis (de todas as fontes) =====
  const yearsSet = new Set<number>();
  (gols || []).forEach(g => { const y = yearOf(g.evento?.data); if (y) yearsSet.add(y); });
  (amistosos || []).forEach(a => { const y = yearOf(a.evento?.data); if (y) yearsSet.add(y); });
  (campeonatos || []).forEach(c => { if (c.campeonato?.ano) yearsSet.add(c.campeonato.ano); });
  (premiacoes || []).forEach(p => { const y = yearOf(p.evento?.data); if (y) yearsSet.add(y); });
  (conquistas || []).forEach(c => { if (c.ano) yearsSet.add(c.ano); });
  jornada.data.campeonatos.forEach((c: any) => { const y = yearOf(c.data_inicio); if (y) yearsSet.add(y); });
  jornada.data.amistosos.forEach((j: any) => { const y = yearOf(j.data_jogo); if (y) yearsSet.add(y); });
  jornada.data.campeonatos.forEach((c: any) => {
    (c.jogos || []).forEach((j: any) => { const y = yearOf(j.data_jogo); if (y) yearsSet.add(y); });
  });
  const anosDisponiveis = Array.from(yearsSet).sort((a, b) => b - a);

  const matchYear = (y: number | null | undefined) =>
    ano === 'todos' ? true : y === ano;

  // ===== Sync (escola) =====
  const golsFiltered = (gols || []).filter(g => matchYear(yearOf(g.evento?.data)));
  const amistososFiltered = (amistosos || []).filter(a => matchYear(yearOf(a.evento?.data)));
  const campeonatosFiltered = (campeonatos || []).filter(c => matchYear(c.campeonato?.ano ?? null));
  const premiacoesFiltered = (premiacoes || []).filter(p => matchYear(yearOf(p.evento?.data)));
  const conquistasFiltered = (conquistas || []).filter(c => matchYear(c.ano ?? null));

  const totalGolsSync = golsFiltered.reduce((sum, g) => sum + g.quantidade, 0);
  const amistososFinalizados = amistososFiltered.filter(a => a.evento?.status === 'finalizado' || a.evento?.status === 'realizado');
  const amistososEventIds = new Set(amistososFinalizados.map(a => a.evento_id));
  const orphanGolEventIds = new Set(golsFiltered.filter(g => !amistososEventIds.has(g.evento_id) && g.evento).map(g => g.evento_id));
  const uniqueCampeonatoIds = new Set(campeonatosFiltered.map(c => c.campeonato_id));

  // ===== Jornada própria (carreira_*) =====
  const jCampeonatos = jornada.data.campeonatos.filter((c: any) => matchYear(yearOf(c.data_inicio)));
  const jAmistosos = jornada.data.amistosos.filter((j: any) => matchYear(yearOf(j.data_jogo)));
  const jJogosCamp = jornada.data.campeonatos.flatMap((c: any) =>
    (c.jogos || []).filter((j: any) => matchYear(yearOf(j.data_jogo)))
  );
  const jAllJogos = [...jAmistosos, ...jJogosCamp];

  const jTotalGols = jAllJogos.reduce((s, j: any) => s + (j.gols_marcados || 0), 0);
  const jTotalAssist = jAllJogos.reduce((s, j: any) => s + (j.assistencias || 0), 0);
  const jTotalVitorias = jAllJogos.filter((j: any) =>
    j.placar_time_atleta != null && j.placar_adversario != null &&
    j.placar_time_atleta > j.placar_adversario
  ).length;
  const jTotalPremiacoes = jCampeonatos.reduce((s, c: any) => s + (c.premiacoes?.length || 0), 0);

  const jJogosGoleiro = jAllJogos.filter((j: any) => j.posicao_jogo === 'goleiro');
  const jTotalDefesas = jJogosGoleiro.reduce((s, j: any) => s + (j.defesas_importantes || 0), 0);
  const jTotalGolsSofridos = jJogosGoleiro.reduce((s, j: any) => s + (j.gols_sofridos || 0), 0);
  const jTotalPenaltisDef = jJogosGoleiro.reduce((s, j: any) => s + (j.penaltis_defendidos || 0) + (j.penaltis_defendidos_disputa || 0), 0);
  const jMinutosGoleiro = jJogosGoleiro.reduce((s, j: any) => s + (j.minutos_jogados || 0), 0);

  const stats: CarreiraStatsExtended = {
    totalGols: totalGolsSync + jTotalGols,
    totalJogos: amistososFinalizados.length + orphanGolEventIds.size + jAllJogos.length,
    totalCampeonatos: uniqueCampeonatoIds.size + jCampeonatos.length,
    totalPremiacoes: premiacoesFiltered.length + jTotalPremiacoes,
    totalConquistas: conquistasFiltered.length,
    totalAssistencias: jTotalAssist,
    totalVitorias: jTotalVitorias,
    jogosComoGoleiro: jJogosGoleiro.length,
    totalDefesas: jTotalDefesas,
    totalGolsSofridos: jTotalGolsSofridos,
    totalPenaltisDefendidos: jTotalPenaltisDef,
    minutosGoleiro: jMinutosGoleiro,
  };

  return { stats, anosDisponiveis };
}
