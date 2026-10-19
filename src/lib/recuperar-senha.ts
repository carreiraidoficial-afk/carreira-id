import { supabase } from '@/integrations/supabase/client';

/** Intervalo mínimo entre pedidos de link (o Supabase só aceita 1 por minuto para o mesmo e-mail). */
export const ESPERA_RECUPERACAO_S = 60;

/** Traduz os erros do Supabase Auth para algo que o usuário entenda e saiba o que fazer. */
export function traduzirErroRecuperacao(mensagem?: string | null): string {
  const m = String(mensagem || '').toLowerCase();
  if (m.includes('once every') || m.includes('for security purposes') || m.includes('rate limit') || m.includes('too many')) {
    return 'Você pediu o link há pouco. Aguarde 1 minuto e tente de novo (o último e-mail pode já estar na sua caixa).';
  }
  if (m.includes('error sending') || m.includes('sending recovery') || m.includes('smtp')) {
    return 'Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos ou fale com o suporte.';
  }
  if (m.includes('invalid') && m.includes('email')) {
    return 'Confira o e-mail digitado: ele parece incorreto.';
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Sem conexão. Verifique sua internet e tente de novo.';
  }
  return 'Não foi possível enviar o link agora. Tente novamente em instantes.';
}

export interface ResultadoRecuperacao {
  ok: boolean;
  /** E-mail já limpo (sem espaços, minúsculo), quando o pedido foi aceito. */
  email?: string;
  /** Mensagem pronta para mostrar ao usuário, quando falhou. */
  erro?: string;
}

/** Pede o link de redefinição de senha. Limpa o e-mail (espaços, maiúsculas) e confere o formato antes de enviar. */
export async function pedirLinkRecuperacao(emailDigitado: string): Promise<ResultadoRecuperacao> {
  const email = emailDigitado.trim().toLowerCase();
  if (!email) return { ok: false, erro: 'Digite o e-mail da sua conta.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, erro: 'Confira o e-mail digitado: ele parece incorreto.' };
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { ok: false, erro: traduzirErroRecuperacao(error.message) };
    return { ok: true, email };
  } catch (e: any) {
    return { ok: false, erro: traduzirErroRecuperacao(e?.message) };
  }
}
