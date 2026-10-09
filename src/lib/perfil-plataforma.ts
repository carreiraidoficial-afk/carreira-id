import { supabase } from '@/integrations/supabase/client';

/** A conta oficial do Carreira ID (modalidade "Plataforma") é um perfil_atleta só para poder publicar no Feed. Ela
 * não é atleta: não aparece em listas de pessoas (conexões, sugestões, busca) nem entra nas contagens. As publicações
 * dela continuam no Feed, identificadas como "Carreira ID". */
export const MODALIDADE_PLATAFORMA = 'Plataforma';

export function ehPerfilPlataforma(perfil: { modalidade?: string | null } | null | undefined): boolean {
  return perfil?.modalidade === MODALIDADE_PLATAFORMA;
}

let cache: { ids: Set<string>; em: number } | null = null;
const VALIDADE_MS = 5 * 60 * 1000;

/** user_id das contas oficiais da plataforma (para tirar as conexões com elas das contagens e das listas). */
export async function plataformaUserIds(): Promise<Set<string>> {
  if (cache && Date.now() - cache.em < VALIDADE_MS) return cache.ids;
  const { data } = await supabase.from('perfil_atleta').select('user_id').eq('modalidade', MODALIDADE_PLATAFORMA);
  const ids = new Set<string>((data || []).map((r: any) => r.user_id));
  cache = { ids, em: Date.now() };
  return ids;
}

/** A linha de conexão é com a conta da plataforma (o outro lado, do ponto de vista de `meuUserId`)? */
export function conexaoComPlataforma(
  row: { solicitante_id: string; destinatario_id: string },
  meuUserId: string,
  plataforma: Set<string>,
): boolean {
  const outro = row.solicitante_id === meuUserId ? row.destinatario_id : row.solicitante_id;
  return plataforma.has(outro);
}
