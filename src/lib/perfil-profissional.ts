import { normalizarUrl } from '@/lib/links-escola';

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
  const livre = String(dados?.titulo_profissional || '').trim();
  if (livre) return livre;
  const modalidade = String(dados?.modalidade || '').trim();
  if (tipo === 'professor') return modalidade ? `Professor de ${modalidade}` : rotuloBase;
  if (tipo === 'preparador_fisico') {
    const especialidade = especialidadeVisivel(dados);
    return especialidade ? `${rotuloBase} · ${especialidade}` : rotuloBase;
  }
  return rotuloBase;
}

/** Bio curta, no estilo Instagram (cartão lateral). O texto longo vai em "Sobre mim". */
export const MAX_BIO_PROFISSIONAL = 160;
/** "Sobre mim" completo, no estilo da seção "Sobre" do LinkedIn. */
export const MAX_SOBRE_MIM = 2000;

/** Texto do cartão "Sobre mim": o campo próprio; ou, em perfil antigo cuja bio era longa, a própria bio
 * (assim nada some). Bio curta sem "Sobre mim" não gera cartão: já aparece inteira no cartão lateral. */
export function textoSobreMim(bio: string | null | undefined, dados: Record<string, any> | null | undefined): string {
  const proprio = String(dados?.sobre_mim || '').trim();
  if (proprio) return proprio;
  const b = String(bio || '').trim();
  return b.length > MAX_BIO_PROFISSIONAL ? b : '';
}

/** Texto corrido vira lista: uma linha por item, sem os "•" ou "-" digitados à mão. */
export function linhasDeTexto(texto: unknown): string[] {
  if (typeof texto !== 'string') return [];
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.replace(/^\s*[•·●▪\-–—*]+\s*/, '').trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------------------------
// Currículo estruturado (guardado em perfis_rede.dados_perfil, sem tabela nova)
// ---------------------------------------------------------------------------------------------

export const MAX_CERTIFICACOES = 12;
export const MAX_IDIOMAS = 6;
export const MAX_CONQUISTAS = 12;

export type StatusCertificacao = 'concluido' | 'andamento';
export interface Certificacao {
  titulo: string;
  instituicao: string;
  status: StatusCertificacao;
}

export const NIVEIS_IDIOMA = ['Básico', 'Intermediário', 'Avançado', 'Fluente', 'Nativo'] as const;
export type NivelIdioma = (typeof NIVEIS_IDIOMA)[number];
export interface IdiomaNivel {
  idioma: string;
  nivel: NivelIdioma;
}

export const TIPOS_CONQUISTA = [
  { id: 'ouro', rotulo: 'Ouro / título' },
  { id: 'prata', rotulo: 'Prata / vice' },
  { id: 'bronze', rotulo: 'Bronze / terceiro' },
  { id: 'estrela', rotulo: 'Destaque' },
] as const;
export type TipoConquista = (typeof TIPOS_CONQUISTA)[number]['id'];
export interface Conquista {
  titulo: string;
  descricao: string;
  /** Ano com 4 dígitos, ou vazio. */
  ano: string;
  tipo: TipoConquista;
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function lerCertificacoes(dados: Record<string, any> | null | undefined): Certificacao[] {
  const lista = Array.isArray(dados?.certificacoes_lista) ? dados!.certificacoes_lista : [];
  return lista
    .map((c: any) => ({
      titulo: texto(c?.titulo, 100),
      instituicao: texto(c?.instituicao, 100),
      status: (c?.status === 'andamento' ? 'andamento' : 'concluido') as StatusCertificacao,
    }))
    .filter((c: Certificacao) => c.titulo)
    .slice(0, MAX_CERTIFICACOES);
}

export function lerIdiomas(dados: Record<string, any> | null | undefined): IdiomaNivel[] {
  const lista = Array.isArray(dados?.idiomas) ? dados!.idiomas : [];
  return lista
    .map((i: any) => ({
      idioma: texto(i?.idioma, 30),
      nivel: ((NIVEIS_IDIOMA as readonly string[]).includes(i?.nivel) ? i.nivel : 'Intermediário') as NivelIdioma,
    }))
    .filter((i: IdiomaNivel) => i.idioma)
    .slice(0, MAX_IDIOMAS);
}

export function lerConquistas(dados: Record<string, any> | null | undefined): Conquista[] {
  const lista = Array.isArray(dados?.conquistas) ? dados!.conquistas : [];
  return lista
    .map((c: any) => ({
      titulo: texto(c?.titulo, 100),
      descricao: texto(c?.descricao, 120),
      ano: /^\d{4}$/.test(String(c?.ano ?? '')) ? String(c.ano) : '',
      tipo: (TIPOS_CONQUISTA.some((t) => t.id === c?.tipo) ? c.tipo : 'estrela') as TipoConquista,
    }))
    .filter((c: Conquista) => c.titulo)
    .slice(0, MAX_CONQUISTAS);
}

/** Preenchimento da barra de nível (Nativo = cheia). */
export const percentualNivel = (nivel: NivelIdioma) =>
  ({ 'Básico': 25, 'Intermediário': 50, 'Avançado': 75, 'Fluente': 90, 'Nativo': 100 })[nivel];

/** '' = vazio (ok); null = inválido; senão a URL limpa. Só aceita endereços do LinkedIn. */
export function normalizarLinkedin(valor: string): string | null {
  const bruto = (valor || '').trim();
  if (!bruto) return '';
  const url = normalizarUrl(bruto);
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'linkedin.com' || host.endsWith('.linkedin.com') ? url : null;
  } catch {
    return null;
  }
}
