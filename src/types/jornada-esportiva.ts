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
  | 'ponta';

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
  | 'destaque'
  | 'outro';

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
  created_at: string;
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
}

export interface CreateJogoMidiaInput {
  jogo_id: string;
  tipo_midia: TipoMidia;
  url_midia: string;
  ordem: number;
}
