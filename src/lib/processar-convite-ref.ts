import { supabase } from '@/integrations/supabase/client';

/**
 * Processa parâmetros ?ref e ?c=<convite_codigo> e ?a=<atleta_slug> (e ?escola=<slug>)
 * salvos durante o cadastro.
 *
 * Cria:
 *  - rede_convites (dispara trigger handle_convite_confirmado → pontos)
 *  - rede_conexoes status=aceita com o atleta convidante (auto-follow)
 *  - rede_conexoes status=pendente com a escola, quando veio do card "Aluno da escola?"
 *    da página pública (a escola confirma o vínculo)
 *
 * Idempotente: silenciosamente ignora se já processado.
 */
const STORAGE_KEY = 'carreira_pending_ref';
/** O espelho em localStorage existe só pro caso de o e-mail de confirmação abrir em outra aba. */
const VALIDADE_ESPELHO_MS = 24 * 60 * 60 * 1000;

export interface PendingRef {
  ref: 'torcedor' | 'atleta' | 'rede';
  conviteCodigo?: string;
  atletaSlug?: string;
  /** Slug da escola de onde o aluno veio (pedido de vínculo pendente). */
  escolaSlug?: string;
  /** Unidade da escola escolhida no card (opcional). */
  unidade?: string;
}

export function salvarPendingRef(data: PendingRef) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
  // Só o vínculo com escola precisa sobreviver a outra aba (confirmação de e-mail).
  if (data.escolaSlug) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, salvoEm: Date.now() }));
    } catch {
      // ignore
    }
  }
}

/** Lê só da sessão da aba: usado pra decidir o tipo de perfil automaticamente. */
export function lerPendingRef(): PendingRef | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Sessão primeiro; se a aba é nova (e-mail de confirmação), cai no espelho de até 24h. */
function lerPendingRefComEspelho(): PendingRef | null {
  const daSessao = lerPendingRef();
  if (daSessao) return daSessao;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const dados = JSON.parse(raw);
    if (!dados?.salvoEm || Date.now() - dados.salvoEm > VALIDADE_ESPELHO_MS) return null;
    return dados as PendingRef;
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
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Pedido de vínculo pendente do atleta recém-criado com a escola de origem (a escola aprova). */
async function solicitarVinculoComEscola(novoUserId: string, novoPerfilAtletaId: string, escolaSlug: string, unidade?: string) {
  const { data: escola } = await supabase
    .from('perfis_rede')
    .select('id, user_id, dados_perfil')
    .eq('slug', escolaSlug)
    .eq('tipo', 'dono_escola')
    .maybeSingle();
  if (!escola?.user_id || escola.user_id === novoUserId) return;

  // Idempotência: já existe pedido (ou vínculo) deste atleta com esta escola.
  const { data: existentes } = await supabase
    .from('rede_conexoes')
    .select('id')
    .eq('solicitante_id', novoUserId)
    .eq('destinatario_id', escola.user_id)
    .eq('solicitante_perfil_atleta_id', novoPerfilAtletaId)
    .limit(1);
  if (existentes && existentes.length > 0) return;

  // A unidade só vale se existir mesmo na escola (o valor vem da URL).
  const unidadesEscola: any[] = Array.isArray((escola.dados_perfil as any)?.unidades) ? (escola.dados_perfil as any).unidades : [];
  const unidadeValida = unidade && unidadesEscola.some((u) => u?.nome === unidade) ? unidade : null;

  const { error } = await supabase.from('rede_conexoes').insert({
    solicitante_id: novoUserId,
    destinatario_id: escola.user_id,
    status: 'pendente',
    solicitante_perfil_atleta_id: novoPerfilAtletaId,
    ...(unidadeValida ? { unidade_nome: unidadeValida } : {}),
  } as any);
  if (error) throw error;

  // Avisa a escola (best-effort, igual ao botão Conectar).
  try {
    const { data: atleta } = await supabase.from('perfil_atleta').select('nome').eq('id', novoPerfilAtletaId).maybeSingle();
    await supabase.functions.invoke('send-carreira-push', {
      body: {
        user_ids: [escola.user_id],
        title: '🔗 Novo aluno pediu vínculo',
        body: `${atleta?.nome || 'Um atleta'} quer se vincular à sua escola`,
        url: '/conexoes',
        tag: 'conexao_solicitada',
        category: 'conexao_solicitada',
      },
    });
  } catch {
    // notificação é opcional
  }
}

export async function processarConviteRef(novoUserId: string): Promise<void> {
  const pending = lerPendingRefComEspelho();
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

    // Se quem está se cadastrando agora criou um perfil_atleta (ref=atleta),
    // pega o id dele pra a conexão ficar isolada nesse atleta específico e
    // não vazar pro irmão dele no futuro.
    let novoPerfilAtletaId: string | null = null;
    if (pending.ref === 'atleta') {
      const { data: meuPerfil } = await supabase
        .from('perfil_atleta')
        .select('id')
        .eq('user_id', novoUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      novoPerfilAtletaId = meuPerfil?.id || null;
    }

    // 3) Auto-follow no atleta (criança) cujo perfil foi compartilhado
    if (pending.atletaSlug) {
      const { data: atletaData } = await supabase
        .from('perfil_atleta')
        .select('id, user_id')
        .eq('slug', pending.atletaSlug)
        .maybeSingle();
      const atletaUserId = atletaData?.user_id;
      if (atletaUserId && atletaUserId !== novoUserId) {
        await supabase.from('rede_conexoes').insert({
          solicitante_id: novoUserId,
          destinatario_id: atletaUserId,
          status: 'aceita',
          solicitante_perfil_atleta_id: novoPerfilAtletaId,
          destinatario_perfil_atleta_id: atletaData?.id || null,
        });
      }
    } else if (convidanteUserId && convidanteUserId !== novoUserId) {
      // fallback: conecta com o convidante
      await supabase.from('rede_conexoes').insert({
        solicitante_id: novoUserId,
        destinatario_id: convidanteUserId,
        status: 'aceita',
        solicitante_perfil_atleta_id: novoPerfilAtletaId,
      });
    }

    // 4) Veio do card "Aluno da escola?": pedido de vínculo PENDENTE com a escola.
    // Só faz sentido pra atleta recém-criado (a conexão é do atleta, não da conta).
    if (pending.escolaSlug && novoPerfilAtletaId) {
      await solicitarVinculoComEscola(novoUserId, novoPerfilAtletaId, pending.escolaSlug, pending.unidade);
    }
  } catch (err) {
    console.error('[processarConviteRef] erro:', err);
  } finally {
    limparPendingRef();
  }
}
