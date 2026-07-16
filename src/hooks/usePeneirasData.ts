import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Peneira {
  id: string;
  criador_id: string;
  criador_perfil_rede_id: string | null;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  data_fim: string | null;
  local_nome: string;
  local_endereco: string | null;
  cidade: string | null;
  estado: string | null;
  modalidade: string;
  categorias: string[];
  posicoes: string[];
  vagas: number | null;
  requisitos: string | null;
  contato_whatsapp: string | null;
  contato_email: string | null;
  banner_url: string | null;
  status: string;
  alcance: string;
  filtro_status_federado: string | null;
  created_at: string;
  criador_perfil_rede?: { nome: string; foto_url: string | null; tipo: string } | null;
}

export interface PeneiraConvite {
  id: string;
  peneira_id: string;
  atleta_perfil_id: string;
  atleta_user_id: string;
  status: string;
  respondido_em: string | null;
  created_at: string;
  peneira?: Peneira;
  atleta_perfil?: { nome: string; foto_url: string | null; categoria: string | null; posicao_principal: string | null; cidade: string | null; estado: string | null };
}

const PENEIRA_CREATOR_TYPES = ['tecnico', 'scout', 'agente_clube', 'dono_escola'];

export function useCanCreatePeneira(perfilRedeTipo: string | null) {
  return !!perfilRedeTipo && PENEIRA_CREATOR_TYPES.includes(perfilRedeTipo);
}

/** Fetch peneiras created by current user */
export function useMinhasPeneiras(userId: string | null) {
  return useQuery({
    queryKey: ['minhas-peneiras', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('peneiras')
        .select('*, criador_perfil_rede:perfis_rede(nome, foto_url, tipo)')
        .eq('criador_id', userId)
        .order('data_evento', { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        criador_perfil_rede: Array.isArray(p.criador_perfil_rede) ? p.criador_perfil_rede[0] : p.criador_perfil_rede,
      })) as Peneira[];
    },
    enabled: !!userId,
  });
}

/** Fetch open peneiras (for discovery) */
export function usePeneirasAbertas() {
  return useQuery({
    queryKey: ['peneiras-abertas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('peneiras')
        .select('*, criador_perfil_rede:perfis_rede(nome, foto_url, tipo)')
        .eq('status', 'aberta')
        .gte('data_evento', new Date().toISOString())
        .order('data_evento', { ascending: true });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        criador_perfil_rede: Array.isArray(p.criador_perfil_rede) ? p.criador_perfil_rede[0] : p.criador_perfil_rede,
      })) as Peneira[];
    },
  });
}

/** Fetch convites for the current athlete */
export function useMeusConvitesPeneira(userId: string | null) {
  return useQuery({
    queryKey: ['meus-convites-peneira', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('peneira_convites')
        .select('*, peneira:peneiras(*, criador_perfil_rede:perfis_rede(nome, foto_url, tipo))')
        .eq('atleta_user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((c: any) => {
        const peneira = Array.isArray(c.peneira) ? c.peneira[0] : c.peneira;
        if (peneira?.criador_perfil_rede) {
          peneira.criador_perfil_rede = Array.isArray(peneira.criador_perfil_rede) ? peneira.criador_perfil_rede[0] : peneira.criador_perfil_rede;
        }
        return { ...c, peneira } as PeneiraConvite;
      });
    },
    enabled: !!userId,
  });
}

/** Fetch convites for a specific peneira */
export function useConvitesPeneira(peneiraId: string | null) {
  return useQuery({
    queryKey: ['convites-peneira', peneiraId],
    queryFn: async () => {
      if (!peneiraId) return [];
      const { data, error } = await supabase
        .from('peneira_convites')
        .select('*, atleta_perfil:perfil_atleta(nome, foto_url, categoria, posicao_principal, cidade, estado)')
        .eq('peneira_id', peneiraId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((c: any) => ({
        ...c,
        atleta_perfil: Array.isArray(c.atleta_perfil) ? c.atleta_perfil[0] : c.atleta_perfil,
      })) as PeneiraConvite[];
    },
    enabled: !!peneiraId,
  });
}

/** Create a new peneira */
export function useCreatePeneira() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Peneira>) => {
      const { data: result, error } = await supabase
        .from('peneiras')
        .insert(data as any)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minhas-peneiras'] });
      toast.success('Peneira criada com sucesso!');
    },
    onError: (e: any) => toast.error('Erro ao criar peneira: ' + e.message),
  });
}

/** Update an existing peneira */
export function useUpdatePeneira() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Peneira> & { id: string }) => {
      const { error } = await supabase
        .from('peneiras')
        .update(data as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minhas-peneiras'] });
      queryClient.invalidateQueries({ queryKey: ['peneiras-abertas'] });
      toast.success('Peneira atualizada!');
    },
    onError: (e: any) => toast.error('Erro ao atualizar: ' + e.message),
  });
}

/** Cancel a peneira and notify all invited athletes */
export function useCancelPeneira() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ peneiraId, titulo }: { peneiraId: string; titulo: string }) => {
      // Update status to cancelada
      const { error } = await supabase
        .from('peneiras')
        .update({ status: 'cancelada' } as any)
        .eq('id', peneiraId);
      if (error) throw error;

      // Get all invited athlete user_ids to notify
      const { data: convites } = await supabase
        .from('peneira_convites')
        .select('atleta_user_id')
        .eq('peneira_id', peneiraId);

      if (convites && convites.length > 0) {
        const userIds = convites.map((c) => c.atleta_user_id);
        try {
          await supabase.functions.invoke('send-carreira-push', {
            body: {
              user_ids: userIds,
              title: '❌ Peneira Cancelada',
              body: `A peneira "${titulo}" foi cancelada pelo organizador.`,
              url: '/eventos',
              tag: 'peneira_convite',
              category: 'peneira_convite',
            },
          });
        } catch { /* silent */ }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minhas-peneiras'] });
      queryClient.invalidateQueries({ queryKey: ['meus-convites-peneira'] });
      queryClient.invalidateQueries({ queryKey: ['peneiras-abertas'] });
      toast.success('Peneira cancelada. Todos os convidados foram notificados.');
    },
    onError: (e: any) => toast.error('Erro ao cancelar: ' + e.message),
  });
}

/** Send convites to athletes matching filters */
export function useSendConvitesPeneira() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ peneiraId, atletaIds }: { peneiraId: string; atletaIds: { perfil_id: string; user_id: string }[] }) => {
      const rows = atletaIds.map((a) => ({
        peneira_id: peneiraId,
        atleta_perfil_id: a.perfil_id,
        atleta_user_id: a.user_id,
        status: 'pendente',
      }));
      const { error } = await supabase.from('peneira_convites').upsert(rows as any, { onConflict: 'peneira_id,atleta_perfil_id' });
      if (error) throw error;

      try {
        const { data: peneira } = await supabase.from('peneiras').select('titulo').eq('id', peneiraId).maybeSingle();
        await supabase.functions.invoke('send-carreira-push', {
          body: {
            user_ids: atletaIds.map((a) => a.user_id),
            title: '🎯 Convite para Peneira',
            body: peneira?.titulo ? `Você foi convidado para "${peneira.titulo}"` : 'Você recebeu um convite para uma peneira',
            url: '/eventos',
            tag: 'peneira_convite',
            category: 'peneira_convite',
          },
        });
      } catch { /* silent: notificacao e best-effort, nao deve travar o convite */ }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['convites-peneira'] });
      toast.success('Convites enviados!');
    },
    onError: (e: any) => toast.error('Erro ao enviar convites: ' + e.message),
  });
}

/** Respond to a peneira convite (confirmar/recusar) */
export function useRespondConvitePeneira() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conviteId, status }: { conviteId: string; status: 'confirmado' | 'recusado' | 'descartado' }) => {
      const { error } = await supabase
        .from('peneira_convites')
        .update({ status, respondido_em: new Date().toISOString() } as any)
        .eq('id', conviteId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['meus-convites-peneira'] });
      queryClient.invalidateQueries({ queryKey: ['convites-peneira'] });
      const msgs: Record<string, string> = {
        confirmado: 'Presença confirmada!',
        recusado: 'Convite recusado',
        descartado: 'Evento ocultado do perfil',
      };
      toast.success(msgs[vars.status] || 'Atualizado');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

/** Search athletes for inviting with filters */
export function useSearchAtletasForPeneira(filters: {
  cidade?: string;
  estado?: string;
  modalidade?: string;
  posicao?: string;
  categoria?: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['search-atletas-peneira', filters],
    queryFn: async () => {
      let query = supabase
        .from('perfil_atleta')
        .select('id, user_id, nome, foto_url, categoria, posicao_principal, cidade, estado, modalidade, modalidades')
        .eq('is_public', true)
        .order('nome');

      if (filters.estado) query = query.eq('estado', filters.estado);
      if (filters.cidade) query = query.ilike('cidade', `%${filters.cidade}%`);
      if (filters.modalidade) query = query.or(`modalidade.eq.${filters.modalidade},modalidades.cs.{${filters.modalidade}}`);
      if (filters.posicao) query = query.eq('posicao_principal', filters.posicao);
      if (filters.categoria) query = query.eq('categoria', filters.categoria);

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: filters.enabled !== false,
    staleTime: 30_000,
  });
}
