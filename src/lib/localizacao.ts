/**
 * Texto de localização de um perfil: "Cidade, Estado, País". O país só entra fora do Brasil, e repetições
 * seguidas somem ("Zurique, Zurique, Suíça" vira "Zurique, Suíça"). Se só o país foi informado (fora do Brasil),
 * mostra só ele: antes a localização inteira sumia quando faltavam cidade e estado.
 */
export function formatarLocalizacao(
  cidade?: string | null,
  estado?: string | null,
  pais?: string | null,
  separador = ', ',
): string {
  const partes = [cidade, estado, pais && pais.trim().toLowerCase() !== 'brasil' ? pais : null]
    .map((p) => (p ?? '').trim())
    .filter(Boolean);
  const semRepeticao = partes.filter((p, i) => i === 0 || p.toLowerCase() !== partes[i - 1].toLowerCase());
  return semRepeticao.join(separador);
}
