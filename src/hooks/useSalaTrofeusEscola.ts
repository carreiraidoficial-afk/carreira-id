import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { apagarArquivosFotos, type TrofeuFoto } from '@/lib/fotos-trofeu';

export type ColocacaoTrofeuEscola =
  | 'campeao'
  | 'vice'
  | 'semifinalista'
  | 'terceiro'
  | 'quartas'
  | 'oitavas'
  | 'fase_grupos';

export interface TrofeuEscola {
  id: string;
  perfil_rede_id: string;
  titulo: string;
  organizador: string | null;
  colocacao: ColocacaoTrofeuEscola;
  categoria: string | null;
  ano: number;
  /** Esporte do troféu (ex.: 'futebol', 'volei'). */
  modalidade: string;
  created_at: string;
  updated_at: string;
  /** Fotos da conquista (até 6), na ordem de exibição. */
  fotos: TrofeuFoto[];
}

export type TrofeuEscolaInput = {
  titulo: string;
  organizador?: string | null;
  colocacao: ColocacaoTrofeuEscola;
  categoria?: string | null;
  ano: number;
  modalidade: string;
};

export function useTrofeusEscola(perfilRedeId: string | null | undefined) {
  return useQuery({
    queryKey: ['rede-trofeus', perfilRedeId],
    queryFn: async (): Promise<TrofeuEscola[]> => {
      if (!perfilRedeId) return [];
      const { data, error } = await (supabase as any)
        .from('rede_trofeus')
        .select('*, fotos:rede_trofeu_fotos(id, trofeu_id, url, thumb_url, caminho, caminho_thumb, ordem)')
        .eq('perfil_rede_id', perfilRedeId)
        .order('ano', { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((t) => ({
        ...t,
        fotos: ([...(t.fotos || [])] as TrofeuFoto[]).sort((a, b) => a.ordem - b.ordem),
      })) as TrofeuEscola[];
    },
    enabled: !!perfilRedeId,
  });
}

export function useCreateTrofeuEscola(perfilRedeId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TrofeuEscolaInput): Promise<string> => {
      if (!perfilRedeId) throw new Error('perfilRedeId ausente');
      const { data, error } = await (supabase as any).from('rede_trofeus').insert({
        perfil_rede_id: perfilRedeId,
        titulo: input.titulo,
        organizador: input.organizador || null,
        colocacao: input.colocacao,
        categoria: input.categoria || null,
        ano: input.ano,
        modalidade: input.modalidade,
      }).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rede-trofeus', perfilRedeId] });
    },
  });
}

export function useUpdateTrofeuEscola(perfilRedeId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TrofeuEscolaInput }) => {
      const { error } = await (supabase as any)
        .from('rede_trofeus')
        .update({
          titulo: input.titulo,
          organizador: input.organizador || null,
          colocacao: input.colocacao,
          categoria: input.categoria || null,
          ano: input.ano,
          modalidade: input.modalidade,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rede-trofeus', perfilRedeId] });
    },
  });
}

export function useDeleteTrofeuEscola(perfilRedeId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // As fotos somem do banco junto com a conquista; os arquivos precisam ser apagados à parte (primeiro anotamos quais são).
      const { data: fotos } = await (supabase as any).from('rede_trofeu_fotos').select('caminho, caminho_thumb').eq('trofeu_id', id);
      const { error } = await (supabase as any).from('rede_trofeus').delete().eq('id', id);
      if (error) throw error;
      await apagarArquivosFotos((fotos || []) as Pick<TrofeuFoto, 'caminho' | 'caminho_thumb'>[]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rede-trofeus', perfilRedeId] });
    },
  });
}
