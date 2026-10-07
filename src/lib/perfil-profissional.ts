/** Perfis de profissional que ganham o layout de currículo (Sobre mim, informações em grade,
 * certificações e experiência em lista). Os outros tipos de rede continuam como estavam. */
export const TIPOS_PROFISSIONAL_EQUIPE = ['professor', 'tecnico', 'preparador_fisico'];

export const ehProfissionalEquipe = (tipo: string | null | undefined) =>
  !!tipo && TIPOS_PROFISSIONAL_EQUIPE.includes(tipo);

/** "Outro" é só o valor do seletor; sem texto livre não diz nada ao visitante. */
export function especialidadeVisivel(dados: Record<string, any> | null | undefined): string {
  const valor = String(dados?.especialidade || '').trim();
  return valor && valor.toLowerCase() !== 'outro' ? valor : '';
}

/** Título curto sob o nome ("Professor de Vôlei de Areia"), montado dos dados já cadastrados.
 * Sem dado suficiente, devolve o rótulo padrão do tipo. */
export function tituloProfissional(tipo: string, dados: Record<string, any> | null | undefined, rotuloBase: string): string {
  const modalidade = String(dados?.modalidade || '').trim();
  if (tipo === 'professor') return modalidade ? `Professor de ${modalidade}` : rotuloBase;
  if (tipo === 'preparador_fisico') {
    const especialidade = especialidadeVisivel(dados);
    return especialidade ? `${rotuloBase} · ${especialidade}` : rotuloBase;
  }
  return rotuloBase;
}

/** Texto corrido vira lista: uma linha por item, sem os "•" ou "-" digitados à mão. */
export function linhasDeTexto(texto: unknown): string[] {
  if (typeof texto !== 'string') return [];
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.replace(/^\s*[•·●▪\-–—*]+\s*/, '').trim())
    .filter(Boolean);
}
