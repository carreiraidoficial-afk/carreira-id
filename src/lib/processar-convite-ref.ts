import { supabase } from '@/integrations/supabase/client';

/**
 * Processa parâmetros ?ref e ?c=<convite_codigo> e ?a=<atleta_slug>
 * salvos em sessionStorage durante o cadastro.
 *
 * Cria:
 *  - rede_convites (dispara trigger handle_convite_confirmado → pontos)
 *  - rede_conexoes status=aceito com o atleta convidante (auto-follow)
 *
 * Idempotente: silenciosamente ignora se já processado.
 */
const STORAGE_KEY = 'carreira_pending_ref';

export interface PendingRef {
  ref: 'torcedor' | 'atleta' | 'rede';
  conviteCodigo?: string;
  atletaSlug?: string;
}

export function salvarPendingRef(data: PendingRef) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function lerPendingRef(): PendingRef | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function limparPendingRef() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function processarConviteRef(novoUserId: string): Promise<void> {
  const pending = lerPendingRef();
  if (!pending || !novoUserId) return;

  try {
    // 1) Resolver convidante via convite_codigo
    let convidantePerfilId: string | null = null;
    let convidanteUserId: string | null = null;
    if (pending.conviteCodigo) {
      const { data } = await supabase
        .from('perfis_rede')
        .select('id, user_id')
        .eq('convite_codigo', pending.conviteCodigo)
        .maybeSingle();
      if (data) {
        convidantePerfilId = data.id;
        convidanteUserId = data.user_id;
      }
    }

    // 2) Inserir rede_convites (se temos convidante)
    if (convidantePerfilId && convidanteUserId !== novoUserId) {
      await supabase.from('rede_convites').insert({
        convidante_perfil_id: convidantePerfilId,
        convidado_user_id: novoUserId,
      });
    }

    // 3) Auto-follow no atleta (criança) cujo perfil foi compartilhado
    if (pending.atletaSlug) {
      const { data: atletaData } = await supabase
        .from('perfil_atleta')
        .select('user_id')
        .eq('slug', pending.atletaSlug)
        .maybeSingle();
      const atletaUserId = atletaData?.user_id;
      if (atletaUserId && atletaUserId !== novoUserId) {
        await supabase.from('rede_conexoes').insert({
          solicitante_id: novoUserId,
          destinatario_id: atletaUserId,
          status: 'aceito',
        });
      }
    } else if (convidanteUserId && convidanteUserId !== novoUserId) {
      // fallback: conecta com o convidante
      await supabase.from('rede_conexoes').insert({
        solicitante_id: novoUserId,
        destinatario_id: convidanteUserId,
        status: 'aceito',
      });
    }
  } catch (err) {
    console.error('[processarConviteRef] erro:', err);
  } finally {
    limparPendingRef();
  }
}
