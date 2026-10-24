import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

export interface CarreiraComunicado {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  destinatario_tipo: string;
  destinatario_filtro: any;
  enviar_push: boolean;
  criado_por: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Admin: list all comunicados
export function useAdminCarreiraComunicados() {
  return useQuery({
    queryKey: ['admin-carreira-comunicados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carreira_comunicados')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CarreiraComunicado[];
    },
  });
}

// Admin: create comunicado + optionally send push
export function useCreateCarreiraComunicado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      titulo: string;
      mensagem: string;
      tipo: string;
      destinatario_tipo: string;
      destinatario_filtro: any;
      enviar_push: boolean;
      criado_por: string;
    }) => {
      const { data, error } = await supabase
        .from('carreira_comunicados')
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;

      // O push sai do servidor: um gatilho do banco dispara quando o comunicado é gravado com enviar_push ligado.
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-carreira-comunicados'] });
    },
  });
}

// Admin: toggle ativo
export function useToggleCarreiraComunicado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('carreira_comunicados')
        .update({ ativo } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-carreira-comunicados'] });
    },
  });
}

// Admin: delete comunicado
export function useDeleteCarreiraComunicado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('carreira_comunicados')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-carreira-comunicados'] });
    },
  });
}

// User: get comunicados targeted at me, with read status
export function useMyCarreiraComunicados() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  return useQuery({
    queryKey: ['my-carreira-comunicados', userId],
    queryFn: async () => {
      if (!userId) return [];

      // Fetch all active comunicados
      const { data: comunicados, error } = await supabase
        .from('carreira_comunicados')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      // Fetch read status
      const { data: leituras } = await supabase
        .from('carreira_comunicados_leituras')
        .select('comunicado_id, dispensado_em')
        .eq('user_id', userId);
      const lidos = new Set((leituras || []).map((l: any) => l.comunicado_id));
      // Os que a pessoa excluiu da própria lista não voltam (e não contam como não lidos).
      const dispensados = new Set((leituras || []).filter((l: any) => l.dispensado_em).map((l: any) => l.comunicado_id));

      // Get user's profile type to filter. Um responsável pode ter mais de
      // um perfil_atleta (irmãos) -- .limit(1) em vez de .maybeSingle() puro,
      // que erroraria com 2+ linhas; aqui só importa SE existe algum.
      const { data: perfisAtleta } = await supabase
        .from('perfil_atleta')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      const { data: perfilRede } = await supabase
        .from('perfis_rede')
        .select('tipo')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const myTypes: string[] = [];
      if (perfisAtleta && perfisAtleta.length > 0) myTypes.push('atleta_filho');
      if (perfilRede) myTypes.push(perfilRede.tipo);

      // Filter comunicados targeted at me
      const filtered = (comunicados || []).filter((c: any) => {
        if (c.destinatario_tipo === 'todos') return true;
        if (c.destinatario_tipo === 'tipo_perfil') {
          const tipos = c.destinatario_filtro?.tipos || [];
          return tipos.some((t: string) => myTypes.includes(t));
        }
        if (c.destinatario_tipo === 'individual') {
          return c.destinatario_filtro?.user_id === userId;
        }
        return true;
      });

      return filtered.filter((c: any) => !dispensados.has(c.id)).map((c: any) => ({
        ...c,
        lido: lidos.has(c.id),
      }));
    },
    enabled: !!userId,
    refetchInterval: 60_000,
  });
}

// User: mark comunicado as read
export function useMarkComunicadoRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ comunicadoId, userId }: { comunicadoId: string; userId: string }) => {
      const { error } = await supabase
        .from('carreira_comunicados_leituras')
        .upsert({ comunicado_id: comunicadoId, user_id: userId } as any, { onConflict: 'comunicado_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-carreira-comunicados'] });
      qc.invalidateQueries({ queryKey: ['unread-carreira-comunicados'] });
    },
  });
}

// User: tira o comunicado da própria lista (já conta como lido)
export function useDismissComunicado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ comunicadoId, userId }: { comunicadoId: string; userId: string }) => {
      const { error } = await supabase
        .from('carreira_comunicados_leituras')
        .upsert({ comunicado_id: comunicadoId, user_id: userId, dispensado_em: new Date().toISOString() } as any, { onConflict: 'comunicado_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-carreira-comunicados'] });
      qc.invalidateQueries({ queryKey: ['unread-carreira-comunicados'] });
    },
  });
}

// Hook: unread count
export function useUnreadCarreiraComunicados() {
  const { data: comunicados = [], isLoading } = useMyCarreiraComunicados();
  const unreadCount = comunicados.filter((c: any) => !c.lido).length;
  return { unreadCount, isLoading };
}
