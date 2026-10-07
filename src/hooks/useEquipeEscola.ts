import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MembroEquipe {
  id: string;
  nome: string;
  foto_url: string | null;
  funcao: string;
  /** Segundo título opcional (ex.: "Diretor(a)" + "Professor(a) de Quadra"). */
  funcao_secundaria: string | null;
  /** Slug do perfil da pessoa, quando o membro é vinculado a um perfil do Carreira ID. */
  slug: string | null;
  ordem: number;
}

/** Função de coordenação/direção vem primeiro na vitrine; o resto por ordem e nome. */
const ehLideranca = (funcao: string) =>
  /diretor|fundador|coorden/.test(funcao.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());

/** Equipe aceita de uma escola (pública). Membro vinculado usa nome/foto do próprio perfil. */
export function useEquipeEscola(escolaPerfilId: string | undefined) {
  return useQuery({
    queryKey: ['equipe-escola', escolaPerfilId],
    queryFn: async (): Promise<MembroEquipe[]> => {
      if (!escolaPerfilId) return [];
      const { data, error } = await supabase
        .from('escola_equipe')
        .select('id, membro_perfil_id, nome, foto_url, funcao, funcao_secundaria, ordem')
        .eq('escola_perfil_id', escolaPerfilId)
        .eq('status', 'aceita');
      if (error) throw error;
      const linhas = data || [];

      const idsPerfis = linhas.map((l) => l.membro_perfil_id).filter((id): id is string => !!id);
      const perfisPorId: Record<string, { nome: string; foto_url: string | null; slug: string | null }> = {};
      if (idsPerfis.length > 0) {
        const { data: perfis } = await supabase.from('perfis_rede').select('id, nome, foto_url, slug').in('id', idsPerfis);
        for (const p of perfis || []) perfisPorId[p.id] = { nome: p.nome, foto_url: p.foto_url, slug: p.slug };
      }

      const membros: MembroEquipe[] = [];
      for (const l of linhas) {
        const perfil = l.membro_perfil_id ? perfisPorId[l.membro_perfil_id] : null;
        const nome = perfil?.nome || l.nome;
        if (!nome) continue;
        membros.push({
          id: l.id,
          nome,
          foto_url: perfil?.foto_url || l.foto_url || null,
          funcao: l.funcao,
          funcao_secundaria: l.funcao_secundaria || null,
          slug: perfil?.slug || null,
          ordem: l.ordem ?? 0,
        });
      }
      const lideranca = (m: MembroEquipe) => ehLideranca(`${m.funcao} ${m.funcao_secundaria ?? ''}`);
      return membros.sort((a, b) =>
        Number(lideranca(b)) - Number(lideranca(a)) || a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
    },
    enabled: !!escolaPerfilId,
    // Edição da equipe tem que aparecer ao abrir (o padrão do app segura cache por 24h).
    staleTime: 0,
    refetchOnMount: true,
  });
}
