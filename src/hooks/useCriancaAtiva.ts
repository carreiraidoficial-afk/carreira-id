import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PerfilAtleta } from '@/hooks/useCarreiraData';

const STORAGE_PREFIX = 'carreira_crianca_ativa_id';
const AMBIENTE_STORAGE_PREFIX = 'carreira_ultimo_ambiente';

export type Ambiente = 'atleta' | 'rede';

export interface MeuPerfilAtleta extends PerfilAtleta {
  /** true quando o acesso vem de uma colaboração concedida (não é o dono) */
  souColaborador?: boolean;
}

/**
 * Slug do "Meu Perfil" de verdade -- NUNCA o de um filho colaborado. O
 * perfil ATIVO do seletor pode estar apontando pro filho de outro
 * responsável (ex: uma colaboradora que selecionou o atleta que ela ajuda
 * a gerenciar); "Meu Perfil" tem que continuar sendo a identidade da
 * própria pessoa, não o que está selecionado no momento pra postar/gerir.
 */
export function slugDoDono(perfil: MeuPerfilAtleta | null | undefined): string | null {
  return perfil && !perfil.souColaborador ? perfil.slug : null;
}

/**
 * Lista todos os perfis de atleta que esse usuário pode acessar: os que ele
 * é dono (filhos cadastrados por ele) MAIS os que ele colabora (acesso
 * concedido por outro responsável -- ex: mãe/pai/o próprio atleta com login
 * próprio). Ordenado por data de criação do vínculo.
 */
export function useMinhasCriancas(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['minhas-criancas', userId],
    queryFn: async (): Promise<MeuPerfilAtleta[]> => {
      if (!userId) return [];

      const { data: proprios, error } = await supabase
        .from('perfil_atleta')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const { data: colaboracoes } = await supabase
        .from('perfil_atleta_colaboradores')
        .select('crianca_id')
        .eq('user_id', userId)
        .eq('status', 'ativo');

      const criancaIdsColaborados = (colaboracoes || []).map((c) => c.crianca_id).filter(Boolean) as string[];
      const jaTenho = new Set((proprios || []).map((p) => p.crianca_id));
      const idsParaBuscar = criancaIdsColaborados.filter((id) => !jaTenho.has(id));

      let colaborados: MeuPerfilAtleta[] = [];
      if (idsParaBuscar.length > 0) {
        const { data: perfisColaborados } = await supabase
          .from('perfil_atleta')
          .select('*')
          .in('crianca_id', idsParaBuscar);
        colaborados = ((perfisColaborados || []) as PerfilAtleta[]).map((p) => ({ ...p, souColaborador: true }));
      }

      return [...((proprios || []) as PerfilAtleta[]), ...colaborados];
    },
    enabled: !!userId,
  });
}

/**
 * Versão "pura" (sem hook) de qual perfil deve ser considerado ativo,
 * usada em fluxos imperativos fora de componentes React (ex: redirecionar
 * logo após login em CarreiraCadastroPage.tsx). Mesma regra do hook:
 * respeita a última escolha salva, senão cai pro primeiro da lista.
 */
export function pickCriancaAtiva(perfis: PerfilAtleta[], userId: string): PerfilAtleta | null {
  if (perfis.length === 0) return null;
  const savedId = getSavedCriancaId(userId);
  return perfis.find((p) => p.crianca_id === savedId) || perfis[0];
}

function getSavedCriancaId(userId: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}_${userId}`);
  } catch {
    return null;
  }
}

/** Segue o mesmo padrão de `saveCriancaId`/`getSavedCriancaId` acima -- por
 * dispositivo/navegador, não sincronizado entre aparelhos. Só entra em jogo
 * pra contas com os dois tipos de perfil (atleta E rede); pra todo o resto
 * não muda nada. */
export function getUltimoAmbiente(userId: string): Ambiente | null {
  try {
    const v = localStorage.getItem(`${AMBIENTE_STORAGE_PREFIX}_${userId}`);
    return v === 'atleta' || v === 'rede' ? v : null;
  } catch {
    return null;
  }
}

export function salvarUltimoAmbiente(userId: string, ambiente: Ambiente) {
  try {
    localStorage.setItem(`${AMBIENTE_STORAGE_PREFIX}_${userId}`, ambiente);
  } catch {
    /* localStorage indisponível -- só não persiste entre sessões */
  }
}

/**
 * Decide pra onde mandar a pessoa depois de logar -- usada tanto no listener
 * de sessão quanto no login por senha em CarreiraCadastroPage.tsx (antes eram
 * duas cópias quase idênticas dessa lógica). Pra contas com um só tipo de
 * perfil o resultado é idêntico ao de sempre; só quando a conta tem
 * `perfil_atleta` E `perfis_rede` a última escolha salva entra em jogo.
 */
export async function resolverSlugPosLogin(userId: string): Promise<string | null> {
  const { data: perfisAtleta } = await supabase
    .from('perfil_atleta')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  const perfilAtivo = pickCriancaAtiva((perfisAtleta || []) as PerfilAtleta[], userId);

  const { data: perfilRede } = await supabase
    .from('perfis_rede')
    .select('id, slug')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (perfilAtivo?.slug && perfilRede?.slug) {
    return getUltimoAmbiente(userId) === 'rede' ? perfilRede.slug : perfilAtivo.slug;
  }
  if (perfilAtivo?.slug) return perfilAtivo.slug;
  if (perfilRede?.slug) return perfilRede.slug;

  // Não é dono de nenhum perfil -- pode ser colaborador (ex: o próprio
  // atleta, ou outro responsável, com login próprio).
  const { data: colaboracoes } = await supabase
    .from('perfil_atleta_colaboradores')
    .select('crianca_id')
    .eq('user_id', userId)
    .eq('status', 'ativo');

  const criancaIdsColaborados = (colaboracoes || []).map((c: any) => c.crianca_id).filter(Boolean);
  if (criancaIdsColaborados.length > 0) {
    const { data: perfisColaborados } = await supabase
      .from('perfil_atleta')
      .select('*')
      .in('crianca_id', criancaIdsColaborados)
      .order('created_at', { ascending: true });

    const colaboradorAtivo = pickCriancaAtiva((perfisColaborados || []) as PerfilAtleta[], userId);
    if (colaboradorAtivo?.slug) return colaboradorAtivo.slug;
  }

  return null;
}

/**
 * Diz se a conta logada tem os dois tipos de perfil (atleta E rede) --
 * usada pra decidir se mostra o seletor de ambiente / banner de aviso no
 * perfil. Pra maioria das contas (só um tipo) retorna `temMultiploAmbiente:
 * false` e nada muda na tela.
 */
export function useMeusAmbientes(userId: string | null | undefined) {
  const { perfilAtivo: atletaAtivo } = useCriancaAtiva(userId);

  const { data: rede } = useQuery({
    queryKey: ['meu-ambiente-rede', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('perfis_rede')
        .select('slug, tipo, nome')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data || null;
    },
    enabled: !!userId,
  });

  return {
    temAtleta: !!atletaAtivo?.slug,
    atletaSlug: atletaAtivo?.slug ?? null,
    atletaNome: atletaAtivo?.nome ?? null,
    temRede: !!rede?.slug,
    redeSlug: rede?.slug ?? null,
    redeNome: rede?.nome ?? null,
    temMultiploAmbiente: !!atletaAtivo?.slug && !!rede?.slug,
  };
}

/**
 * Verifica se o usuário logado é um colaborador ATIVO de uma criança
 * específica (não o dono) -- usado pra liberar botões de editar/apagar post
 * e pra exibir "postado por {nome}" quando quem publicou não foi o dono.
 */
export function useColaboradorInfo(criancaId: string | null | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: ['colaborador-info', criancaId, userId],
    queryFn: async () => {
      if (!criancaId || !userId) return null;
      const { data } = await supabase
        .from('perfil_atleta_colaboradores')
        .select('nome, status')
        .eq('crianca_id', criancaId)
        .eq('user_id', userId)
        .eq('status', 'ativo')
        .maybeSingle();
      return data;
    },
    enabled: !!criancaId && !!userId,
    staleTime: 60_000,
  });
}

/**
 * Versão imperativa (fora de componente) de selecionarCrianca -- usada quando
 * uma tela precisa "trocar o filho ativo" e navegar em seguida, sem estar
 * dentro do componente que realmente possui o hook (ex: AssinaturaCard.tsx
 * ao mandar o responsável pra /planos a partir de uma lista com vários filhos).
 */
export function selecionarCriancaAtiva(userId: string, criancaId: string) {
  saveCriancaId(userId, criancaId);
}

function saveCriancaId(userId: string, criancaId: string) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}_${userId}`, criancaId);
  } catch {
    /* localStorage indisponível (modo privado etc.) -- seleção não persiste entre sessões, mas segue funcionando na sessão atual */
  }
}

/**
 * Resolve qual filho está "ativo" no momento (o perfil que as telas do app
 * devem considerar "meu perfil"). Com um só filho cadastrado, sempre resolve
 * pra ele automaticamente -- comportamento idêntico ao de antes desse hook
 * existir. Com mais de um, respeita a última escolha do responsável
 * (guardada em localStorage) e cai pro primeiro cadastrado se a escolha
 * salva não existir mais na lista.
 */
export function useCriancaAtiva(userId: string | null | undefined) {
  const { data: perfis = [], isLoading, refetch } = useMinhasCriancas(userId);
  const [ativaId, setAtivaId] = useState<string | null>(() => (userId ? getSavedCriancaId(userId) : null));

  useEffect(() => {
    setAtivaId(userId ? getSavedCriancaId(userId) : null);
  }, [userId]);

  const perfilAtivo: PerfilAtleta | null =
    perfis.find((p) => p.crianca_id === ativaId) || perfis[0] || null;

  const selecionarCrianca = (criancaId: string) => {
    if (!userId) return;
    saveCriancaId(userId, criancaId);
    setAtivaId(criancaId);
  };

  return {
    perfis,
    perfilAtivo,
    isLoading,
    temMultiplos: perfis.length > 1,
    selecionarCrianca,
    refetchPerfis: refetch,
  };
}
