import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Modo Suporte "sticky": o admin entra num perfil com ?suporte=1 e a conta daquele perfil vira
 * o alvo enquanto ele navega (Conexões, Meu Perfil...), até clicar em Sair. Fica só na aba
 * (sessionStorage): fechar a aba encerra. Não grava nada no banco e não troca a sessão --
 * só decide de QUEM são os dados mostrados; a trava real continua sendo o RLS (has_role admin).
 */
const KEY = 'carreira_suporte_alvo';
const EVENTO = 'carreira-suporte-alvo-mudou';

export interface SuporteAlvo {
  userId: string;
  slug: string | null;
  nome: string;
}

export function lerSuporteAlvo(): SuporteAlvo | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const dados = JSON.parse(raw);
    return dados?.userId ? (dados as SuporteAlvo) : null;
  } catch {
    return null;
  }
}

export function definirSuporteAlvo(alvo: SuporteAlvo) {
  const atual = lerSuporteAlvo();
  if (atual && atual.userId === alvo.userId && atual.slug === alvo.slug && atual.nome === alvo.nome) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(alvo));
  } catch {
    // sem sessionStorage: o suporte segue funcionando só pela URL
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function limparSuporteAlvo() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** `ativo` só é verdadeiro pra admin; qualquer outro usuário ignora o que estiver guardado. */
export function useSuporteAlvo() {
  const { user } = useAuth();
  const [alvo, setAlvo] = useState<SuporteAlvo | null>(() => lerSuporteAlvo());

  useEffect(() => {
    const atualizar = () => setAlvo(lerSuporteAlvo());
    window.addEventListener(EVENTO, atualizar);
    return () => window.removeEventListener(EVENTO, atualizar);
  }, []);

  const sair = useCallback(() => limparSuporteAlvo(), []);
  const ativo = user?.role === 'admin' && !!alvo;
  return { ativo, alvo: ativo ? alvo : null, sair };
}
