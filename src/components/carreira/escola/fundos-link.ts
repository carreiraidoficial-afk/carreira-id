import type { TipoLink } from '@/lib/links-escola';

interface FundoLink {
  /** Casa com as modalidades da escola (sem acento, minúsculas). null = serve pra qualquer esporte. */
  esporte: RegExp | null;
  tipo: TipoLink;
  src: string;
}

/** Fundos fornecidos pela plataforma. Imagem de esporte específico só aparece em escola
 * que oferece aquela modalidade; se não houver, vale a imagem neutra do tipo (esporte: null);
 * sem nenhuma das duas, o card fica no degradê padrão. Pra adicionar: coloque o arquivo
 * em public/links/ e acrescente uma linha aqui. */
const FUNDOS: FundoLink[] = [
  { esporte: /volei/, tipo: 'matricula', src: '/links/volei-matricula.webp' },
  { esporte: /volei/, tipo: 'aula_experimental', src: '/links/aula-experimental-volei.webp' },
  { esporte: /volei/, tipo: 'competicao', src: '/links/competicao-volei.webp' },
  { esporte: null, tipo: 'planos', src: '/links/planos-geral.webp' },
];

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function fundoDoLink(tipo: TipoLink, modalidades: string[]): string | null {
  const textoModalidades = modalidades.map(semAcento);
  const doTipo = FUNDOS.filter((f) => f.tipo === tipo);
  const especifico = doTipo.find((f) => f.esporte && textoModalidades.some((m) => f.esporte!.test(m)));
  return (especifico ?? doTipo.find((f) => f.esporte === null))?.src ?? null;
}
