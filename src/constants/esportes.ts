// ── Shared sport constants used across all registration and profile forms ──

export const MODALIDADES = [
  'Futebol', 'Futsal', 'Beach Soccer', 'Futebol Society',
  'Futebol Americano', 'Basquete',
  'Vôlei de Quadra', 'Vôlei de Areia',
  'Handebol', 'Natação', 'Atletismo',
  'Judô', 'Jiu-Jitsu', 'Tênis', 'Outro',
];

/** Modalidades offered specifically for escola profiles (dono_escola) */
/** Lista única de modalidades: escola e profissional usam a mesma, para um professor poder escolher
 * qualquer esporte que uma escola possa oferecer (antes a lista do profissional tinha só 8). */
const MODALIDADES_BASE = [
  'Futebol', 'Futsal', 'Society', 'Beach Soccer', 'Futevôlei',
  'Vôlei de Quadra', 'Vôlei de Areia',
  'Basquete', 'Handebol', 'Natação',
  'Atletismo', 'Ginástica', 'Judô', 'Jiu-Jitsu', 'Tênis', 'Beach Tennis', 'Outro',
];
export const MODALIDADES_ESCOLA = MODALIDADES_BASE;

/** Modalidades for professor / técnico selects */
export const MODALIDADES_PROFISSIONAL = MODALIDADES_BASE;

/** Esportes em que existe a função de treinador de goleiros. */
const MODALIDADES_COM_GOLEIRO = ['Futebol', 'Futsal', 'Society', 'Beach Soccer', 'Handebol'];

/** Especialidades do professor/treinador. Neutras quanto ao esporte (a modalidade é outro campo);
 * "Goleiros" só aparece nos esportes que têm goleiro (ou enquanto a modalidade não foi escolhida). */
export function opcoesEspecialidadeProfessor(modalidade?: string, atual?: string): string[] {
  const lista = [
    'Técnico / Treinador principal',
    'Auxiliar técnico',
    'Coordenação técnica',
    'Iniciação esportiva (base)',
    'Preparação Física',
    'Tático / Análise de desempenho',
    'Coordenação Motora',
  ];
  if (!modalidade || MODALIDADES_COM_GOLEIRO.includes(modalidade)) lista.push('Goleiros');
  lista.push('Outro');
  // valor antigo já salvo (ex.: "Técnico de Futebol") continua selecionável, em vez de sumir do campo
  if (atual && !lista.includes(atual)) lista.splice(lista.length - 1, 0, atual);
  return lista;
}

/** Opções de um campo select: a do professor depende da modalidade; os demais usam a lista fixa. */
export function opcoesCampoSelect(
  tipo: string | null | undefined, chave: string, base: string[] | undefined, valores: Record<string, unknown>,
): string[] {
  if (tipo === 'professor' && chave === 'especialidade') {
    return opcoesEspecialidadeProfessor(valores.modalidade as string | undefined, valores.especialidade as string | undefined);
  }
  return base ?? [];
}

/** Posições de perfil por modalidade (usadas em "Posição principal/secundária" do atleta) */
export const POSICOES_FUTEBOL = ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meia', 'Atacante'];
export const POSICOES_VOLEI = ['Levantador', 'Oposto', 'Ponteiro', 'Central', 'Líbero'];
export const POSICOES_BASQUETE = ['Armador', 'Ala-Armador', 'Ala', 'Ala-Pivô', 'Pivô'];

/** Modalidades da família do vôlei -- usam posições e estatísticas próprias (ver JornadaJogoFormDialog) */
export const MODALIDADES_VOLEI = ['Vôlei de Quadra', 'Vôlei de Areia'];

export function isModalidadeVolei(modalidade?: string | null): boolean {
  return !!modalidade && MODALIDADES_VOLEI.includes(modalidade);
}

/** Basquete -- posições e estatísticas próprias (pontos, rebotes, tocos etc), ver JornadaJogoFormDialog */
export const MODALIDADES_BASQUETE = ['Basquete'];

export function isModalidadeBasquete(modalidade?: string | null): boolean {
  return !!modalidade && MODALIDADES_BASQUETE.includes(modalidade);
}

export const CATEGORIAS = [
  'Sub-5', 'Sub-6', 'Sub-7', 'Sub-8', 'Sub-9', 'Sub-10',
  'Sub-11', 'Sub-12', 'Sub-13', 'Sub-14', 'Sub-15',
  'Sub-16', 'Sub-17', 'Sub-18', 'Sub-19', 'Sub-20',
  'Profissional',
];

/** Categorias without "Profissional" – for child athlete forms */
export const CATEGORIAS_BASE = [
  'Sub-5', 'Sub-6', 'Sub-7', 'Sub-8', 'Sub-9', 'Sub-10',
  'Sub-11', 'Sub-12', 'Sub-13', 'Sub-14', 'Sub-15',
  'Sub-16', 'Sub-17', 'Sub-18', 'Sub-19', 'Sub-20',
];

export const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const ESTADO_LABELS: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas',
  BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
  GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

/** Cadastro assistido, não lista ISO completa -- cobre os destinos mais
 * comuns de intercâmbio de brasileiros no exterior, com "Outro" como
 * fallback pra qualquer país fora da lista. */
export const PAISES_INTERCAMBIO = [
  'Brasil', 'Estados Unidos', 'Canadá', 'Portugal', 'Espanha',
  'Reino Unido', 'Suíça', 'Alemanha', 'Itália', 'França',
  'Austrália', 'Japão', 'Outro',
] as const;
