export type TipoLink =
  | 'matricula'
  | 'planos'
  | 'aula_experimental'
  | 'agendamento'
  | 'whatsapp'
  | 'competicao'
  | 'localizacao'
  | 'site'
  | 'outro';

export interface LinkEscola {
  titulo: string;
  url: string;
  tipo: TipoLink;
  descricao?: string;
}

export const MAX_LINKS_ESCOLA = 6;
export const MAX_TITULO_LINK = 40;
export const MAX_DESCRICAO_LINK = 100;

/** O tipo decide texto do botão, descrição padrão e (na tela) ícone -- o dono só cola a URL. */
export const TIPOS_LINK: Record<TipoLink, { rotulo: string; tituloPadrao: string; cta: string; descricaoPadrao: string }> = {
  matricula: {
    rotulo: 'Matrículas',
    tituloPadrao: 'Matrículas e informações',
    cta: 'Acessar agora',
    descricaoPadrao: 'Saiba como se matricular, turmas disponíveis e outras informações.',
  },
  planos: {
    rotulo: 'Planos e pacotes',
    tituloPadrao: 'Planos e pacotes',
    cta: 'Ver planos',
    descricaoPadrao: 'Conheça nossos planos de treinamento e pacotes.',
  },
  aula_experimental: {
    rotulo: 'Aula experimental',
    tituloPadrao: 'Aula experimental',
    cta: 'Agendar aula',
    descricaoPadrao: 'Agende uma aula experimental e conheça a escola.',
  },
  agendamento: {
    rotulo: 'Agendamento',
    tituloPadrao: 'Agendamento',
    cta: 'Agendar',
    descricaoPadrao: 'Escolha o melhor horário e agende online.',
  },
  whatsapp: {
    rotulo: 'WhatsApp',
    tituloPadrao: 'Fale com a escola',
    cta: 'Chamar no WhatsApp',
    descricaoPadrao: 'Tire suas dúvidas direto com a equipe.',
  },
  competicao: {
    rotulo: 'Competição / inscrição',
    tituloPadrao: 'Competições e inscrições',
    cta: 'Ver detalhes',
    descricaoPadrao: 'Campeonatos, inscrições e regulamentos.',
  },
  localizacao: {
    rotulo: 'Localização',
    tituloPadrao: 'Como chegar',
    cta: 'Ver no mapa',
    descricaoPadrao: 'Endereço e rota até a escola.',
  },
  site: {
    rotulo: 'Site',
    tituloPadrao: 'Site da escola',
    cta: 'Visitar site',
    descricaoPadrao: 'Conheça mais sobre a escola.',
  },
  outro: {
    rotulo: 'Outro',
    tituloPadrao: '',
    cta: 'Acessar',
    descricaoPadrao: '',
  },
};

/** Ordem em que os tipos são sugeridos pra um link novo. */
export const ORDEM_SUGESTAO_TIPOS: TipoLink[] = ['matricula', 'planos', 'aula_experimental', 'agendamento', 'whatsapp', 'competicao'];

export function proximoTipoSugerido(links: LinkEscola[]): TipoLink {
  const usados = new Set(links.map((l) => l.tipo));
  return ORDEM_SUGESTAO_TIPOS.find((t) => !usados.has(t)) ?? 'outro';
}

export function ehTipoLink(valor: unknown): valor is TipoLink {
  return typeof valor === 'string' && valor in TIPOS_LINK;
}

/** Aceita só http/https. "wa.me/55..." (sem esquema) vira https://wa.me/55...;
 * qualquer outro esquema (javascript:, data:, etc.) é rejeitado. */
export function normalizarUrl(bruta: string): string | null {
  const texto = (bruta || '').trim();
  if (!texto) return null;
  const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(texto) ? texto : `https://${texto}`;
  try {
    const url = new URL(comEsquema);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Lê dados_perfil.links com tolerância: descarta item sem título ou com URL inválida;
 * link antigo (sem tipo) vira "outro". */
export function lerLinksEscola(dados: Record<string, any> | null | undefined): LinkEscola[] {
  const lista = Array.isArray(dados?.links) ? dados!.links : [];
  const resultado: LinkEscola[] = [];
  for (const item of lista) {
    const titulo = typeof item?.titulo === 'string' ? item.titulo.trim().slice(0, MAX_TITULO_LINK) : '';
    const url = typeof item?.url === 'string' ? normalizarUrl(item.url) : null;
    if (!titulo || !url) continue;
    const descricao = typeof item?.descricao === 'string' ? item.descricao.trim().slice(0, MAX_DESCRICAO_LINK) : '';
    resultado.push({
      titulo,
      url,
      tipo: ehTipoLink(item?.tipo) ? item.tipo : 'outro',
      ...(descricao ? { descricao } : {}),
    });
    if (resultado.length >= MAX_LINKS_ESCOLA) break;
  }
  return resultado;
}
