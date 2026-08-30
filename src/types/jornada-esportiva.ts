export type TorneioAbrangencia = 'regional' | 'estadual' | 'nacional' | 'internacional';
export type TipoJogo = 'campeonato' | 'amistoso';
export type TipoMidia = 'foto' | 'video';
export type PosicaoJogo =
  | 'goleiro'
  | 'lateral-esquerdo'
  | 'lateral-direito'
  | 'zagueiro'
  | 'volante'
  | 'meia'
  | 'meia-atacante'
  | 'ala'
  | 'atacante'
  | 'ponta'
  | 'levantador'
  | 'oposto'
  | 'ponteiro'
  | 'central'
  | 'libero'
  | 'armador'
  | 'ala-armador'
  | 'ala-pivo'
  | 'pivo';

export type PosicaoFinalCampeonato =
  | 'campeao'
  | 'vice'
  | 'semifinalista'
  | 'quartas'
  | 'oitavas'
  | 'fase_grupos'
  | 'eliminado'
  | 'em_andamento';

export type TipoPremiacaoIndividual =
  | 'melhor_jogador'
  | 'melhor_goleiro'
  | 'artilheiro'
  | 'melhor_defesa'
  | 'melhor_atacante'
  | 'melhor_saque'
  | 'melhor_bloqueio'
  | 'melhor_libero'
  | 'melhor_levantador'
  | 'cestinha'
  | 'melhor_reboteiro'
  | 'melhor_defensor'
  | 'destaque'
  | 'outro';

/** Placar de um set de vôlei (opcional, dentro de sets_detalhe) */
export interface SetDetalhe {
  set: number;
  pontos_time: number;
  pontos_adversario: number;
}

/** Placar de um quarto de basquete (opcional, dentro de quartos_detalhe) */
export interface QuartoDetalhe {
  quarto: number;
  pontos_time: number;
  pontos_adversario: number;
}

export interface Campeonato {
  id: string;
  crianca_id: string;
  nome: string;
  organizador?: string;
  abrangencia: TorneioAbrangencia;
  data_inicio: string;
  data_final?: string;
  logo_url?: string | null;
  posicao_final?: PosicaoFinalCampeonato | null;
  categoria?: string | null;
  nome_time?: string | null;
  modalidade: string;
  created_at: string;
}

export interface CampeonatoPremiacao {
  id: string;
  campeonato_id: string;
  crianca_id: string;
  tipo_premiacao: TipoPremiacaoIndividual;
  titulo?: string | null;
  jogo_id?: string | null;
  created_at: string;
}

export interface Jogo {
  id: string;
  crianca_id: string;
  campeonato_id?: string | null;
  data_jogo: string;
  time_adversario: string;
  local?: string;
  placar_time_atleta?: number;
  placar_adversario?: number;
  gols_marcados?: number;
  assistencias?: number;
  posicao_jogo?: PosicaoJogo;
  time_atleta?: string | null;
  observacoes?: string;
  fase_campeonato?: string;
  modalidade: string;
  created_at: string;
  // Prorrogação e disputa de pênaltis -- fatos do jogo, não dependem da posição
  teve_prorrogacao?: boolean | null;
  teve_disputa_penaltis?: boolean | null;
  placar_penaltis_time?: number | null;
  placar_penaltis_adversario?: number | null;
  // Pênalti marcado em jogo por jogador de linha (opcionais)
  gols_penalti?: number | null;
  penaltis_convertidos_disputa?: number | null;
  // Estatísticas de goleiro (opcionais)
  minutos_jogados?: number | null;
  gols_sofridos?: number | null;
  defesas_importantes?: number | null;
  penaltis_defendidos?: number | null;
  penaltis_defendidos_disputa?: number | null;
  penaltis_gol_lado_correto?: number | null;
  penaltis_gol_lado_errado?: number | null;
  // Estatísticas de vôlei -- bloco geral (opcionais)
  pontos_ataque?: number | null;
  pontos_bloqueio?: number | null;
  pontos_saque?: number | null;
  erros_cometidos?: number | null;
  // Estatísticas de vôlei -- bloco líbero (opcionais)
  recepcoes_realizadas?: number | null;
  defesas_realizadas?: number | null;
  erros_recepcao?: number | null;
  // Placar detalhado por set (opcional)
  sets_detalhe?: SetDetalhe[] | null;
  // Estatísticas de basquete (opcionais) -- assistencias, erros_cometidos e
  // minutos_jogados acima são reaproveitados (AS, ER, MIN da súmula)
  pontos?: number | null;
  rebotes_ofensivos?: number | null;
  rebotes_defensivos?: number | null;
  roubos_bola?: number | null;
  tocos?: number | null;
  faltas_cometidas?: number | null;
  arremessos_2pt_tentados?: number | null;
  arremessos_2pt_convertidos?: number | null;
  arremessos_3pt_tentados?: number | null;
  arremessos_3pt_convertidos?: number | null;
  lances_livres_tentados?: number | null;
  lances_livres_convertidos?: number | null;
  // Placar detalhado por quarto (opcional)
  quartos_detalhe?: QuartoDetalhe[] | null;
}

export interface JogoMidia {
  id: string;
  jogo_id: string;
  tipo_midia: TipoMidia;
  url_midia: string;
  ordem: number;
  created_at: string;
}

export interface JogoComMidia extends Jogo {
  midias: JogoMidia[];
}

export interface CampeonatoComJogos extends Campeonato {
  jogos: JogoComMidia[];
  premiacoes: CampeonatoPremiacao[];
  totalJogos?: number;
  totalGols?: number;
  totalAssistencias?: number;
  totalVitorias?: number;
}

export interface EstatisticasAtleta {
  totalJogos: number;
  totalGols: number;
  totalAssistencias: number;
  totalVitorias: number;
  totalCampeonatos: number;
  posicoesMais: { posicao: PosicaoJogo; vezes: number }[];
  // Agregados de goleiro
  jogosComoGoleiro?: number;
  totalDefesas?: number;
  totalGolsSofridos?: number;
  totalPenaltisDefendidos?: number;
  minutosTotais?: number;
  // Prorrogação e pênaltis (jogador de linha)
  jogosComProrrogacao?: number;
  totalGolsPenalti?: number;
  totalPenaltisConvertidosDisputa?: number;
  // Agregados de vôlei
  totalPontosAtaque?: number;
  totalPontosBloqueio?: number;
  totalPontosSaque?: number;
  totalErrosCometidos?: number;
  jogosComoLibero?: number;
  totalRecepcoes?: number;
  totalDefesasVolei?: number;
  totalErrosRecepcao?: number;
  // Agregados de basquete
  totalPontosBasquete?: number;
  totalRebotesOfensivos?: number;
  totalRebotesDefensivos?: number;
  totalRoubosBola?: number;
  totalTocos?: number;
}

export interface JornadaEsportivaData {
  campeonatos: CampeonatoComJogos[];
  amistosos: JogoComMidia[];
  estatisticas: EstatisticasAtleta;
}

export interface CreateCampeonatoInput {
  nome: string;
  organizador?: string;
  abrangencia: TorneioAbrangencia;
  data_inicio: string;
  data_final?: string;
  logo_url?: string | null;
  posicao_final?: PosicaoFinalCampeonato | null;
  categoria?: string | null;
  nome_time?: string | null;
  modalidade: string;
}

export interface CreateCampeonatoPremiacaoInput {
  campeonato_id: string;
  tipo_premiacao: TipoPremiacaoIndividual;
  titulo?: string | null;
  jogo_id?: string | null;
}

export interface CreateJogoInput {
  campeonato_id?: string | null;
  data_jogo: string;
  time_adversario: string;
  local?: string;
  placar_time_atleta?: number;
  placar_adversario?: number;
  gols_marcados?: number;
  assistencias?: number;
  posicao_jogo?: PosicaoJogo;
  time_atleta?: string | null;
  observacoes?: string;
  fase_campeonato?: string;
  modalidade: string;
  // Prorrogação e disputa de pênaltis -- fatos do jogo, não dependem da posição
  teve_prorrogacao?: boolean | null;
  teve_disputa_penaltis?: boolean | null;
  placar_penaltis_time?: number | null;
  placar_penaltis_adversario?: number | null;
  // Pênalti marcado em jogo por jogador de linha (opcionais)
  gols_penalti?: number | null;
  penaltis_convertidos_disputa?: number | null;
  // Estatísticas de goleiro (opcionais)
  minutos_jogados?: number | null;
  gols_sofridos?: number | null;
  defesas_importantes?: number | null;
  penaltis_defendidos?: number | null;
  penaltis_defendidos_disputa?: number | null;
  penaltis_gol_lado_correto?: number | null;
  penaltis_gol_lado_errado?: number | null;
  // Estatísticas de vôlei -- bloco geral (opcionais)
  pontos_ataque?: number | null;
  pontos_bloqueio?: number | null;
  pontos_saque?: number | null;
  erros_cometidos?: number | null;
  // Estatísticas de vôlei -- bloco líbero (opcionais)
  recepcoes_realizadas?: number | null;
  defesas_realizadas?: number | null;
  erros_recepcao?: number | null;
  // Placar detalhado por set (opcional)
  sets_detalhe?: SetDetalhe[] | null;
  // Estatísticas de basquete (opcionais)
  pontos?: number | null;
  rebotes_ofensivos?: number | null;
  rebotes_defensivos?: number | null;
  roubos_bola?: number | null;
  tocos?: number | null;
  faltas_cometidas?: number | null;
  arremessos_2pt_tentados?: number | null;
  arremessos_2pt_convertidos?: number | null;
  arremessos_3pt_tentados?: number | null;
  arremessos_3pt_convertidos?: number | null;
  lances_livres_tentados?: number | null;
  lances_livres_convertidos?: number | null;
  // Placar detalhado por quarto (opcional)
  quartos_detalhe?: QuartoDetalhe[] | null;
}

export interface CreateJogoMidiaInput {
  jogo_id: string;
  tipo_midia: TipoMidia;
  url_midia: string;
  ordem: number;
}
