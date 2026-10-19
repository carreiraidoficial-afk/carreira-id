import { carreiraPath } from '@/hooks/useCarreiraBasePath';

/** Idade em anos completos a partir de "YYYY-MM-DD". */
export function idadeEmAnos(dataNascimento: string): number {
  const [a, m, d] = dataNascimento.split('-').map(Number);
  if (!a || !m || !d) return -1;
  const hoje = new Date();
  let idade = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) idade--;
  return idade;
}

/** Número pronto para wa.me: só dígitos com o código do país (brasileiro sem DDI ganha 55). */
export function whatsappParaWaMe(telefoneLimpo: string): string {
  const digitos = telefoneLimpo.replace(/\D/g, '');
  return telefoneLimpo.trim().startsWith('+') ? digitos : `55${digitos}`;
}

export function linkAnuencia(token: string): string {
  return `${window.location.origin}${carreiraPath('/autorizar')}?codigo=${encodeURIComponent(token)}`;
}

/** Mensagem curta e identificável, enviada do WhatsApp do próprio adolescente. */
export function mensagemParaResponsavel(nomeResponsavel: string, link: string): string {
  const primeiro = nomeResponsavel.trim().split(' ')[0] || '';
  return [
    `Oi${primeiro ? `, ${primeiro}` : ''}! Sou eu. Quero montar meu perfil de atleta no *Carreira ID*, uma plataforma brasileira onde atletas de base registram a trajetória esportiva (jogos, campeonatos e conquistas).`,
    '',
    'Como sou menor de idade, preciso da sua autorização. Leva 2 minutos e o perfil só é ativado depois que você confirmar:',
    link,
    '',
    'Pode conferir antes em carreiraid.com.br',
  ].join('\n');
}

export function linkWhatsApp(numero: string, mensagem: string): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`;
}

/** Guarda o link do responsável enquanto ele entra/cria conta; depois do login volta para a página de autorização. */
export const PENDING_AUTORIZAR_KEY = 'carreira_pending_autorizar_codigo';

/** Versão do texto da página de autorização, gravada como prova da anuência. Mude sempre que o texto mudar. */
export const TERMO_ANUENCIA_VERSAO = 'anuencia-2026-10-v1';
