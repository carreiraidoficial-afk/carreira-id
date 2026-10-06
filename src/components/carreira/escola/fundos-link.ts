import type { TipoLink } from '@/lib/links-escola';

interface FundoLink {
  /** Casa com as modalidades da escola (sem acento, minúsculas). */
  esporte: RegExp;
  tipo: TipoLink;
  src: string;
}

/** Fundos fornecidos pela plataforma. Imagem de esporte específico só aparece em escola
 * que oferece aquela modalidade -- as demais ficam no degradê padrão. Pra adicionar:
 * coloque o arquivo em public/links/ e acrescente uma linha aqui. */
const FUNDOS: FundoLink[] = [
  { esporte: /volei/, tipo: 'matricula', src: '/links/volei-matricula.webp' },
];

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function fundoDoLink(tipo: TipoLink, modalidades: string[]): string | null {
  const textoModalidades = modalidades.map(semAcento);
  const achado = FUNDOS.find((f) => f.tipo === tipo && textoModalidades.some((m) => f.esporte.test(m)));
  return achado?.src ?? null;
}
