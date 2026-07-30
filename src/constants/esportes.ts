// ── Shared sport constants used across all registration and profile forms ──

export const MODALIDADES = [
  'Futebol', 'Futsal', 'Beach Soccer', 'Futebol Society',
  'Futebol Americano', 'Basquete',
  'Vôlei de Quadra', 'Vôlei de Areia',
  'Handebol', 'Natação', 'Atletismo',
  'Judô', 'Jiu-Jitsu', 'Tênis', 'Outro',
];

/** Modalidades offered specifically for escola profiles (dono_escola) */
export const MODALIDADES_ESCOLA = [
  'Futebol', 'Futsal', 'Society', 'Beach Soccer',
  'Vôlei de Quadra', 'Vôlei de Areia',
  'Basquete', 'Handebol', 'Natação',
  'Atletismo', 'Judô', 'Jiu-Jitsu', 'Tênis', 'Outro',
];

/** Modalidades for professor / técnico selects */
export const MODALIDADES_PROFISSIONAL = [
  'Futebol', 'Futsal', 'Society', 'Beach Soccer',
  'Vôlei de Quadra', 'Vôlei de Areia',
  'Basquete', 'Outro',
];

/** Posições de perfil por modalidade (usadas em "Posição principal/secundária" do atleta) */
export const POSICOES_FUTEBOL = ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meia', 'Atacante'];
export const POSICOES_VOLEI = ['Levantador', 'Oposto', 'Ponteiro', 'Central', 'Líbero'];

/** Modalidades da família do vôlei -- usam posições e estatísticas próprias (ver JornadaJogoFormDialog) */
export const MODALIDADES_VOLEI = ['Vôlei de Quadra', 'Vôlei de Areia'];

export function isModalidadeVolei(modalidade?: string | null): boolean {
  return !!modalidade && MODALIDADES_VOLEI.includes(modalidade);
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
