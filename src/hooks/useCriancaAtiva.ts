import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PerfilAtleta } from '@/hooks/useCarreiraData';

const STORAGE_PREFIX = 'carreira_crianca_ativa_id';

/**
 * Lista todos os perfis de atleta (filhos) de um responsável, ordenados por
 * data de criação. Um responsável pode ter mais de um filho cadastrado
 * (irmãos), cada um com seu próprio perfil_atleta/crianca_id.
 */
export function useMinhasCriancas(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['minhas-criancas', userId],
    queryFn: async (): Promise<PerfilAtleta[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('perfil_atleta')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as PerfilAtleta[];
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
