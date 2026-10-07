import { supabase } from '@/integrations/supabase/client';
import { formatarTelefoneExibicao } from '@/lib/form-validators';

/**
 * No cadastro, o telefone informado (WhatsApp) fica só no perfil; o telefone da conta (profiles.telefone, que as
 * telas do admin mostram como contato do responsável) ficava vazio. Aqui o WhatsApp também vira telefone da conta,
 * mas só se a conta ainda não tem um (nulo ou vazio): nunca sobrescreve um número que a pessoa já informou.
 * É um complemento: se falhar, o cadastro segue normalmente.
 */
export async function copiarTelefoneParaConta(userId: string, telefone: string | null | undefined): Promise<void> {
  const formatado = formatarTelefoneExibicao(telefone);
  if (!userId || !formatado) return;
  try {
    await supabase.from('profiles').update({ telefone: formatado } as any).eq('user_id', userId).or('telefone.is.null,telefone.eq.');
  } catch {
    // complemento: não trava o cadastro
  }
}
