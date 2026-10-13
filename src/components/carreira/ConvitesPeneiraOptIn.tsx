import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarCheck, ShieldCheck } from 'lucide-react';
import { useAceitaConvitesPeneira, useSetAceitaConvitesPeneira } from '@/hooks/usePeneirasData';

interface Props {
  /** perfil_atleta do atleta ativo. Quem decide é o responsável pela conta. */
  perfilAtletaId: string | null | undefined;
  nomeAtleta?: string | null;
}

/** Consentimento do responsável: o atleta só recebe convites de peneira se isto estiver ligado (padrão: desligado). */
export function ConvitesPeneiraOptIn({ perfilAtletaId, nomeAtleta }: Props) {
  const { data: ativo, isLoading } = useAceitaConvitesPeneira(perfilAtletaId);
  const salvar = useSetAceitaConvitesPeneira(perfilAtletaId);
  if (!perfilAtletaId) return null;

  return (
    <Card className={ativo ? 'border-green-500/40' : 'border-primary/40'}>
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ativo ? 'bg-green-500/15 text-green-600' : 'bg-primary/15 text-primary'}`}>
            <CalendarCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {ativo ? 'Convites para peneiras ativados' : 'Convites para peneiras desativados'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {ativo
                ? `${nomeAtleta ? `${nomeAtleta} pode receber` : 'Seu atleta pode receber'} convites de técnicos, scouts e clubes verificados pelo Carreira ID. Você sempre decide se aceita ou recusa, e pode desativar quando quiser.`
                : 'Aqui você pode receber convites para peneiras de técnicos, scouts e clubes verificados pelo Carreira ID. Ative para começar a receber. Você sempre decide se aceita ou recusa.'}
            </p>
          </div>
          <Switch
            checked={!!ativo}
            disabled={isLoading || salvar.isPending}
            onCheckedChange={(v) => salvar.mutate(v)}
            aria-label="Receber convites para peneiras"
          />
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />
          Só organizadores verificados convidam, e o endereço só aparece depois que você confirma.
        </p>
      </CardContent>
    </Card>
  );
}
