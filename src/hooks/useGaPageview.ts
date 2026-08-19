import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isProduction } from '@/lib/fbPixel';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Manda um page_view pro GA4 a cada troca de rota da SPA -- inclusive a
 * primeira. O gtag('config', ..., { send_page_view: false }) no index.html
 * desliga o pageview automático do GA4 justamente pra esse hook ser a única
 * fonte de pageview, e não perder navegação client-side (feed, perfis etc)
 * nem contar a primeira página duas vezes.
 */
export function useGaPageview() {
  const location = useLocation();

  useEffect(() => {
    if (!isProduction() || !window.gtag) return;
    // Pequeno atraso pra dar tempo do useSEO() da página de destino já ter
    // atualizado document.title antes de mandarmos o evento.
    const timer = setTimeout(() => {
      window.gtag!('event', 'page_view', {
        page_path: location.pathname + location.search,
        page_location: window.location.href,
        page_title: document.title,
      });
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);
}
