import { useQuery } from '@tanstack/react-query';
import { plataformaUserIds, conexaoComPlataforma } from '@/lib/perfil-plataforma';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  userId: string;
  /** Perfil_atleta ativo (o filho selecionado no seletor de irmãos), quando
   * aplicável -- isola a contagem de cada atleta, sem somar a dos irmãos. */
  perfilAtletaId?: string | null;
}

export function useConexoesCount(userId: string, perfilAtletaId?: string | null) {
  const { data: count } = useQuery({
    queryKey: ['conexoes-count', userId, perfilAtletaId],
    queryFn: async () => {
      const { data } = await supabase
        .from('rede_conexoes')
        .select('solicitante_id, destinatario_id, solicitante_perfil_atleta_id, destinatario_perfil_atleta_id')
        .eq('status', 'aceita')
        .or(`solicitante_id.eq.${userId},destinatario_id.eq.${userId}`);
      const plataforma = await plataformaUserIds();
      const minhas = (data || []).filter((row) => {
        const souSolicitante = row.solicitante_id === userId;
        const meuLado = souSolicitante ? row.solicitante_perfil_atleta_id : row.destinatario_perfil_atleta_id;
        return (!meuLado || meuLado === perfilAtletaId) && !conexaoComPlataforma(row, userId, plataforma);
      });
      return minhas.length;
    },
  });
  return count ?? 0;
}

export function ConexoesCount({ userId, perfilAtletaId }: Props) {
  const count = useConexoesCount(userId, perfilAtletaId);

  return (
    <span className="text-xs text-muted-foreground">
      <strong className="text-foreground">{count}</strong> conexões
    </span>
  );
}
