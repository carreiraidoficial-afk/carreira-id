import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Gift } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { BONUS_PERFIL_COMPLETO_DIAS } from '@/config/carreiraPlanos';

interface Item { chave: string; rotulo: string; ok: boolean }
interface Status { itens: Item[]; completo: boolean; bonus_concedido: boolean; elegivel: boolean }

/** Progresso do perfil. Quem está no Elite experimental ganha mais dias ao completar (regra e conferência no banco). */
export function PerfilCompletoCard({ criancaId }: { criancaId: string | null | undefined }) {
  const { data } = useQuery({
    queryKey: ['perfil-completo-status', criancaId],
    queryFn: async (): Promise<Status | null> => {
      const { data, error } = await (supabase as any).rpc('carreira_perfil_completo_status', { p_crianca: criancaId });
      if (error) throw error;
      return (data as Status) || null;
    },
    enabled: !!criancaId,
    staleTime: 30_000,
  });

  if (!data || data.completo) return null;

  const feitos = data.itens.filter((i) => i.ok).length;
  const pct = Math.round((feitos / data.itens.length) * 100);
  const ganha = data.elegivel && !data.bonus_concedido;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Gift className="w-5 h-5 mt-0.5 shrink-0 text-violet-500" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {ganha ? `Complete o perfil e ganhe +${BONUS_PERFIL_COMPLETO_DIAS} dias de Elite` : 'Complete o perfil do atleta'}
          </p>
          <p className="text-xs text-muted-foreground">
            {ganha
              ? 'Perfil completo aparece melhor para quem importa. Ao terminar, os dias são liberados sozinhos.'
              : 'Um perfil completo aparece melhor para quem importa no esporte de base.'}
          </p>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {data.itens.map((i) => (
          <li key={i.chave} className={`flex items-center gap-1.5 text-xs ${i.ok ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {i.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
            {i.rotulo}
          </li>
        ))}
      </ul>
    </Card>
  );
}
