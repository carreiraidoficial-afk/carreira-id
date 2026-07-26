import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  userId: string;
  /** Perfil_atleta ativo (o filho selecionado no seletor de irmãos), quando
   * aplicável -- isola a contagem de cada atleta, sem somar a dos irmãos. */
  perfilAtletaId?: string | null;
}

export function ConexoesCount({ userId, perfilAtletaId }: Props) {
  const { data: count } = useQuery({
    queryKey: ['conexoes-count', userId, perfilAtletaId],
    queryFn: async () => {
      const { data } = await supabase
        .from('rede_conexoes')
        .select('solicitante_id, destinatario_id, solicitante_perfil_atleta_id, destinatario_perfil_atleta_id')
        .eq('status', 'aceita')
        .or(`solicitante_id.eq.${userId},destinatario_id.eq.${userId}`);
      const minhas = (data || []).filter((row) => {
        const souSolicitante = row.solicitante_id === userId;
        const meuLado = souSolicitante ? row.solicitante_perfil_atleta_id : row.destinatario_perfil_atleta_id;
        return !meuLado || meuLado === perfilAtletaId;
      });
      return minhas.length;
    },
  });

  return (
    <span className="text-xs text-muted-foreground">
      <strong className="text-foreground">{count ?? 0}</strong> conexões
    </span>
  );
}
