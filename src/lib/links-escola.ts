export interface LinkEscola {
  titulo: string;
  url: string;
}

export const MAX_LINKS_ESCOLA = 6;
export const MAX_TITULO_LINK = 40;

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

/** Lê dados_perfil.links com tolerância: descarta item sem título ou com URL inválida. */
export function lerLinksEscola(dados: Record<string, any> | null | undefined): LinkEscola[] {
  const lista = Array.isArray(dados?.links) ? dados!.links : [];
  const resultado: LinkEscola[] = [];
  for (const item of lista) {
    const titulo = typeof item?.titulo === 'string' ? item.titulo.trim().slice(0, MAX_TITULO_LINK) : '';
    const url = typeof item?.url === 'string' ? normalizarUrl(item.url) : null;
    if (titulo && url) resultado.push({ titulo, url });
    if (resultado.length >= MAX_LINKS_ESCOLA) break;
  }
  return resultado;
}
