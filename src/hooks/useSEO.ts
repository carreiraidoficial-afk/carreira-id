import { useEffect } from 'react';

interface SEOOptions {
  title: string;
  description: string;
  /** Caminho relativo (ex: "/explorar") ou URL completa. Default: a rota atual. */
  path?: string;
  image?: string;
  type?: 'website' | 'profile' | 'article';
  noindex?: boolean;
  /** Objeto schema.org (sem @context) para injetar como JSON-LD. */
  jsonLd?: Record<string, unknown>;
}

const JSONLD_ID = 'seo-jsonld';

function setJsonLd(data: Record<string, unknown> | undefined) {
  let el = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.id = JSONLD_ID;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify({ '@context': 'https://schema.org', ...data });
}

const SITE_URL = 'https://carreiraid.com.br';
const DEFAULT_IMAGE = `${SITE_URL}/carreira-og-image.png`;

function setMetaByName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setMetaByProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setRobots(content: string) {
  let el = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', 'robots');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Atualiza title/description/canonical/OG/Twitter para a página atual.
 * O index.html tem valores estáticos (genéricos da home) como fallback para
 * quem carrega via JS desabilitado; este hook os sobrescreve em runtime assim
 * que a página monta. Sem isso, toda rota do SPA compartilhava o mesmo
 * canonical (apontando pra home), o que sinalizava pro Google que todo o
 * resto do site era conteúdo duplicado.
 */
export function useSEO({ title, description, path, image, type = 'website', noindex = false, jsonLd }: SEOOptions) {
  useEffect(() => {
    const fullTitle = title;
    const url = path
      ? (path.startsWith('http') ? path : `${SITE_URL}${path}`)
      : `${SITE_URL}${window.location.pathname}`;
    const ogImage = image || DEFAULT_IMAGE;

    document.title = fullTitle;
    setMetaByName('description', description);
    setCanonical(url);
    setRobots(noindex ? 'noindex, nofollow' : 'index, follow');

    setMetaByProperty('og:title', fullTitle);
    setMetaByProperty('og:description', description);
    setMetaByProperty('og:url', url);
    setMetaByProperty('og:type', type);
    setMetaByProperty('og:image', ogImage);

    setMetaByName('twitter:title', fullTitle);
    setMetaByName('twitter:description', description);
    setMetaByName('twitter:image', ogImage);

    setJsonLd(jsonLd);

    return () => setJsonLd(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, image, type, noindex, jsonLd]);
}
