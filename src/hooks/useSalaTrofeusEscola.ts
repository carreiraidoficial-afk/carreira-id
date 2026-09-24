import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  created_at: string;
  updated_at: string;
}

export type TrofeuEscolaInput = {
  titulo: string;
  organizador?: string | null;
  colocacao: ColocacaoTrofeuEscola;
  categoria?: string | null;
  ano: number;
};

export function useTrofeusEscola(perfilRedeId: string | null | undefined) {
  return useQuery({
    queryKey: ['rede-trofeus', perfilRedeId],
    queryFn: async (): Promise<TrofeuEscola[]> => {
      if (!perfilRedeId) return [];
      const { data, error } = await (supabase as any)
        .from('rede_trofeus')
        .select('*')
        .eq('perfil_rede_id', perfilRedeId)
        .order('ano', { ascending: false });
      if (error) throw error;
      return (data || []) as TrofeuEscola[];
    },
    enabled: !!perfilRedeId,
  });
}

export function useCreateTrofeuEscola(perfilRedeId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TrofeuEscolaInput) => {
      if (!perfilRedeId) throw new Error('perfilRedeId ausente');
      const { error } = await (supabase as any).from('rede_trofeus').insert({
        perfil_rede_id: perfilRedeId,
        titulo: input.titulo,
        organizador: input.organizador || null,
        colocacao: input.colocacao,
        categoria: input.categoria || null,
        ano: input.ano,
      });
      if (error) throw error;
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
      const { error } = await (supabase as any).from('rede_trofeus').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rede-trofeus', perfilRedeId] });
    },
  });
}
