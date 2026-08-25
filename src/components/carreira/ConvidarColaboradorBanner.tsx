import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, X } from 'lucide-react';

interface Props {
  criancaId: string;
  onAbrirConvite: () => void;
}

/** Banner que aparece no perfil do próprio atleta (visão do responsável)
 * enquanto ninguém ainda foi convidado como colaborador -- é a forma da
 * família (inclusive o próprio atleta) postar e registrar jornada com
 * login próprio, sem precisar do login do responsável. */
export function ConvidarColaboradorBanner({ criancaId, onAbrirConvite }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const { data: temColaborador, isLoading } = useQuery({
    queryKey: ['tem-colaborador-ativo', criancaId],
    queryFn: async () => {
      const { data } = await supabase
        .from('perfil_atleta_colaboradores')
        .select('id')
        .eq('crianca_id', criancaId)
        .in('status', ['ativo', 'pendente'])
        .limit(1);
      return (data?.length || 0) > 0;
    },
    enabled: !!criancaId,
  });

  if (isLoading || temColaborador || dismissed) return null;

  return (
    <Card className="p-4 border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-700">
      <div className="flex items-start gap-3">
        <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-200">
            Deixe o atleta postar com o próprio login
          </h3>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
            Convide seu atleta (ou outro responsável) pra registrar jogos, campeonatos e postagens direto, sem precisar do seu login.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" className="gap-1.5" onClick={onAbrirConvite}>
              <UserPlus className="w-3.5 h-3.5" /> Convidar agora
            </Button>
            <Button size="sm" variant="ghost" className="text-blue-700 dark:text-blue-400" onClick={() => setDismissed(true)}>
              Depois
            </Button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-blue-500 hover:text-blue-700">
          <X className="w-4 h-4" />
        </button>
      </div>
    </Card>
  );
}
