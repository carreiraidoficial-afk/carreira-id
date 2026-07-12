export type CarreiraPlano = 'base' | 'premium';

/** Legacy plan strings that map to the new Premium plan */
const LEGACY_PREMIUM = new Set(['premium', 'competidor', 'elite', 'mensal', 'pro_mensal']);

/** Normalize any plan string (legacy or new) to a CarreiraPlano */
export function normalizePlano(raw: string | null | undefined): CarreiraPlano {
  if (!raw) return 'base';
  if (LEGACY_PREMIUM.has(raw)) return 'premium';
  return 'base';
}

export interface PlanoLimites {
  jornada_mes: number;
  carreira_mes: number;
  posts_dia: number;
  video_seg: number;
  video_max_mb: number;
  youtube: boolean;
  selo_elite: boolean;
  ver_views: boolean;
  prioridade_busca: boolean;
  destaque_listagem: boolean;
  stats_avancadas: boolean;
  liga_conexoes: boolean;
}

export interface PlanoInfo {
  nome: string;
  preco: number; // 0 = free
  cor: string;
  icone: string;
  descricao: string;
  limites: PlanoLimites;
  destaques: string[];
}

/** Preço fixo do plano Premium (usado em toda a UI). */
export const PRECO_PREMIUM = 12.0;
/** Duração do trial gratuito, em dias. */
export const TRIAL_DIAS = 7;

export const PLANOS: Record<CarreiraPlano, PlanoInfo> = {
  base: {
    nome: 'Base',
    preco: 0,
    cor: '#6b7280',
    icone: '⚽',
    descricao: 'Comece sua jornada esportiva',
    limites: {
      jornada_mes: 1,
      carreira_mes: 1,
      posts_dia: 1,
      video_seg: 0,
      video_max_mb: 0,
      youtube: false,
      selo_elite: false,
      ver_views: false,
      prioridade_busca: false,
      destaque_listagem: false,
      stats_avancadas: false,
      liga_conexoes: true,
    },
    destaques: [
      'Perfil público do atleta (foto e informações básicas: posição, idade, pé dominante)',
      'Histórico de carreira (Escolinhas e Clubes) — 1 registro por mês',
      'Registro da Jornada — Participação em jogos e conquistas (1 por mês)',
      'Publicações no feed (texto e fotos) — 1 por dia',
      'Conexões na plataforma (atletas, escolas e clubes)',
      'Perfil visível para scouts, captadores e clubes',
      'Participação na comunidade e notificações da plataforma',
      'Participação na Liga de Conexões do Atleta',
    ],
  },
  premium: {
    nome: 'Premium',
    preco: PRECO_PREMIUM,
    cor: '#8b5cf6',
    icone: '👑',
    descricao: 'Acesso completo à plataforma',
    limites: {
      jornada_mes: 9999,
      carreira_mes: 9999,
      posts_dia: 99,
      video_seg: 60,
      video_max_mb: 40,
      youtube: true,
      selo_elite: true,
      ver_views: true,
      prioridade_busca: true,
      destaque_listagem: true,
      stats_avancadas: true,
      liga_conexoes: true,
    },
    destaques: [
      'Tudo do Base',
      'Registro ilimitado da Jornada Esportiva e do Histórico de carreira',
      'Publicações no feed sem limite diário',
      'Vídeos de até 1 minuto e vídeos do YouTube (treinos, jogos e highlights)',
      'Prioridade nas buscas para scouts e clubes',
      'Selo Premium no perfil',
      'Destaque em listagens de atletas',
      'Estatísticas avançadas',
      'Ver quem visualizou o perfil',
      'Acesso antecipado a novos recursos da plataforma',
    ],
  },
};

/** Returns the minimum plan required for a given feature */
export function planoMinimoParaFeature(feature: keyof PlanoLimites): CarreiraPlano {
  if (PLANOS.base.limites[feature]) return 'base';
  return 'premium';
}

/** Returns plan hierarchy level (for comparison) */
export function planoNivel(plano: CarreiraPlano): number {
  return plano === 'base' ? 0 : 1;
}

/** Check if current plan has access to required plan */
export function temAcessoAoPlano(atual: CarreiraPlano, requerido: CarreiraPlano): boolean {
  return planoNivel(atual) >= planoNivel(requerido);
}