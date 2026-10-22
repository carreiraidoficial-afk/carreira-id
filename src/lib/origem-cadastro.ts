import { supabase } from '@/integrations/supabase/client';

/**
 * Origem do cadastro: guarda de onde a pessoa chegou (primeira visita) e, depois do cadastro, registra uma vez
 * para a conta. Nunca atrapalha o fluxo: qualquer falha é ignorada.
 */
const CHAVE = 'carreira_origem_visita';
const JANELA_CONTA_NOVA_MS = 6 * 60 * 60 * 1000;

export type TipoLinkOrigem = 'direto' | 'torcida' | 'colega' | 'escola' | 'equipe' | 'rede' | 'convite';

interface OrigemVisita {
  tipo_link: TipoLinkOrigem;
  canal: string;
  convidante_slug: string | null;
  escola_slug: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_host: string | null;
  landing_path: string;
  salvoEm: number;
}

const limitar = (v: string | null, n: number) => (v ? v.slice(0, n) : null);

function canalDoReferrer(host: string | null): string {
  if (!host) return 'direto';
  const h = host.toLowerCase();
  if (h.includes('instagram')) return 'instagram';
  if (h.includes('facebook') || h.includes('fb.')) return 'facebook';
  if (h.includes('whatsapp') || h === 'wa.me') return 'whatsapp';
  if (h.includes('youtube') || h === 'youtu.be') return 'youtube';
  if (h.includes('tiktok')) return 'tiktok';
  if (h.includes('google')) return 'google';
  if (h.includes('bing')) return 'bing';
  if (h === 't.co' || h.includes('twitter') || h === 'x.com') return 'x';
  if (h.includes('linkedin')) return 'linkedin';
  return 'outro';
}

function tipoDoLink(p: URLSearchParams): TipoLinkOrigem {
  const ref = p.get('ref');
  // Link curto da escola: /convite/nome-da-escola (alunos) e /convite/nome-da-escola/professor.
  const curto = window.location.pathname.replace(/^\/(en|es)(?=\/|$)/, '').match(/^\/convite\/([^/]+)(\/professor)?\/?$/);
  if (curto) return curto[2] ? 'equipe' : 'escola';
  if (p.get('escola')) return 'escola';
  if (ref === 'equipe') return 'equipe';
  if (ref === 'rede') return 'rede';
  if (ref === 'torcedor' && p.get('a')) return 'torcida';
  if (ref === 'atleta' && p.get('a')) return 'colega';
  if (p.get('convite') || p.get('c')) return 'convite';
  return 'direto';
}

function escolaDoLinkCurto(): string | null {
  const m = window.location.pathname.replace(/^\/(en|es)(?=\/|$)/, '').match(/^\/convite\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function lerOrigemSalva(): OrigemVisita | null {
  try {
    const raw = localStorage.getItem(CHAVE);
    return raw ? (JSON.parse(raw) as OrigemVisita) : null;
  } catch {
    return null;
  }
}

/** Guarda a origem da primeira visita. Uma visita nova só substitui a salva se trouxer link de convite ou campanha. */
export function capturarOrigemVisita() {
  try {
    const url = new URL(window.location.href);
    const p = url.searchParams;
    const tipo = tipoDoLink(p);
    const temCampanha = !!p.get('utm_source');
    const salva = lerOrigemSalva();
    if (salva && tipo === 'direto' && !temCampanha) return;

    let host: string | null = null;
    try {
      host = document.referrer ? new URL(document.referrer).hostname : null;
    } catch {
      host = null;
    }
    if (host && host.endsWith(window.location.hostname)) host = null; // navegação interna não é origem
    const utm = p.get('utm_source');
    const origem: OrigemVisita = {
      tipo_link: tipo,
      canal: limitar((utm || canalDoReferrer(host)).toLowerCase(), 40) || 'direto',
      convidante_slug: limitar(p.get('a'), 120),
      escola_slug: limitar(p.get('escola') || escolaDoLinkCurto(), 120),
      utm_source: limitar(utm, 80),
      utm_medium: limitar(p.get('utm_medium'), 80),
      utm_campaign: limitar(p.get('utm_campaign'), 120),
      referrer_host: limitar(host, 120),
      landing_path: limitar(url.pathname.replace(/^\/(en|es)(?=\/|$)/, '') || '/', 200) || '/',
      salvoEm: Date.now(),
    };
    localStorage.setItem(CHAVE, JSON.stringify(origem));
  } catch {
    /* sem armazenamento: segue sem registrar */
  }
}

/** Registra a origem da conta nova (uma vez). Contas antigas não são tocadas: só vale para cadastro de até 6 horas atrás. */
export async function registrarOrigemCadastro(userId: string, contaCriadaEm?: string | null) {
  try {
    if (!contaCriadaEm || Date.now() - new Date(contaCriadaEm).getTime() > JANELA_CONTA_NOVA_MS) return;
    const chaveFeito = `${CHAVE}_feito_${userId}`;
    if (localStorage.getItem(chaveFeito)) return;
    const o = lerOrigemSalva();
    const { salvoEm: _ignorado, ...campos } = o ?? ({} as Partial<OrigemVisita>);
    const { error } = await (supabase as any)
      .from('carreira_origem_cadastro')
      .upsert({ user_id: userId, ...(o ? campos : { tipo_link: 'direto', canal: 'direto' }) }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (error) {
      console.error('[origemCadastro] erro ao registrar:', error);
      return;
    }
    localStorage.setItem(chaveFeito, '1');
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
}

export function rotuloOrigem(o?: { tipo_link?: string; canal?: string; convidante_slug?: string | null; escola_slug?: string | null } | null): string {
  if (!o) return 'Não registrado';
  const tipo: Record<string, string> = {
    direto: 'Direto',
    torcida: 'Convite de torcida',
    colega: 'Convite de colega',
    escola: 'Link da escola',
    equipe: 'Convite de professor',
    rede: 'Convite de profissional',
    convite: 'Convite',
  };
  return tipo[o.tipo_link || 'direto'] || o.tipo_link || 'Direto';
}
