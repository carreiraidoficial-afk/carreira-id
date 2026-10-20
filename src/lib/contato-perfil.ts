import { supabase } from '@/integrations/supabase/client';

/**
 * Colunas "abertas" dos perfis. CPF/CNPJ, tipo de documento e telefone NÃO entram aqui de propósito: ficam fora de
 * qualquer leitura em lista ou em tela pública e só chegam ao dono/admin pelas funções do banco (abaixo).
 * Se uma coluna nova for criada em perfil_atleta ou perfis_rede, inclua aqui para ela aparecer nas telas.
 */
export const COLUNAS_PERFIL_ATLETA =
  'id, user_id, slug, nome, foto_url, modalidade, categoria, cidade, estado, bio, is_public, created_at, updated_at, crianca_id, banner_url, modalidades, dados_publicos, instagram_url, cor_destaque, followers_count, conexoes_count, tema, status_conta, origem, atleta_app_id, pe_dominante, posicao_principal, posicao_secundaria, is_teste, pais, aceita_convites_peneira, aceita_convites_peneira_em, cadastro_proprio' as const;

export const COLUNAS_PERFIL_REDE =
  'id, user_id, tipo, nome, foto_url, bio, instagram, slug, dados_perfil, created_at, updated_at, tema, status_conta, whatsapp_publico, site, cidade, estado, pais, banner_url, verificado, verificado_em, verificado_por' as const;

export interface DadosPrivados {
  cpf_cnpj: string | null;
  tipo_documento: string | null;
  telefone_whatsapp: string | null;
}

const rpc = (nome: string, args: Record<string, unknown>) => (supabase as any).rpc(nome, args);

/** Telefone de quem marcou "WhatsApp público", por user_id. Quem não marcou não aparece. */
export async function carregarContatosPublicos(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const mapa = new Map<string, string>();
  if (ids.length === 0) return mapa;
  const { data } = await rpc('rede_contato_publico', { p_user_ids: ids });
  ((data || []) as { user_id: string; telefone_whatsapp: string }[]).forEach((r) => mapa.set(r.user_id, r.telefone_whatsapp));
  return mapa;
}

/** CPF/CNPJ e telefone de um perfil profissional: só o dono ou o admin recebem. */
export async function lerPrivadoRede(perfilId: string): Promise<DadosPrivados | null> {
  const { data } = await rpc('perfil_rede_privado', { p_perfil_id: perfilId });
  return ((data || [])[0] as DadosPrivados | undefined) ?? null;
}

/** CPF/CNPJ e telefone de um atleta: dono, colaborador ou admin. */
export async function lerPrivadoAtleta(perfilId: string): Promise<DadosPrivados | null> {
  const { data } = await rpc('perfil_atleta_privado', { p_perfil_id: perfilId });
  return ((data || [])[0] as DadosPrivados | undefined) ?? null;
}

export interface ContatoAdmin extends DadosPrivados {
  origem: 'atleta' | 'rede';
  id: string;
  crianca_id: string | null;
  user_id: string;
}

/** Contatos para as telas de admin (só admin recebe). */
export async function lerContatosAdmin(opcoes: { atletaIds?: string[]; redeIds?: string[]; criancaIds?: string[] }): Promise<ContatoAdmin[]> {
  const { atletaIds, redeIds, criancaIds } = opcoes;
  if (!atletaIds?.length && !redeIds?.length && !criancaIds?.length) return [];
  const { data } = await rpc('admin_contatos_perfis', {
    p_atleta_ids: atletaIds?.length ? atletaIds : null,
    p_rede_ids: redeIds?.length ? redeIds : null,
    p_crianca_ids: criancaIds?.length ? criancaIds : null,
  });
  return (data || []) as ContatoAdmin[];
}

/** Código de convite da CONTA (link "convide amigos"). O banco gera na primeira vez; só o próprio usuário ou o admin recebem. */
export async function lerCodigoConviteDaConta(userId?: string | null): Promise<string | null> {
  const { data } = await rpc('codigo_convite_da_conta', { p_user_id: userId ?? null });
  return (data as string | null) ?? null;
}

/** Código de convite de um perfil específico (escola, profissional ou atleta): dono ou admin. Gera se ainda não existe. */
export async function lerCodigoConvitePerfil(tipo: 'rede' | 'atleta', perfilId: string): Promise<string | null> {
  const { data } = await rpc('codigo_convite_do_perfil', { p_tipo: tipo, p_perfil_id: perfilId });
  return (data as string | null) ?? null;
}

export interface ConvidantePerfil {
  id: string;
  user_id: string;
  tipo: string;
  nome: string;
}

/** Quem convidou, a partir do código recebido por link. Só logado; devolve null se o código não existe. */
export async function resolverConvite(codigo: string): Promise<ConvidantePerfil | null> {
  const { data } = await rpc('resolver_convite', { p_codigo: codigo });
  return ((data || [])[0] as ConvidantePerfil | undefined) ?? null;
}
