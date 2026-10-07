import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, UserPlus } from 'lucide-react';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';

interface Props {
  nomeEscola: string;
  slug: string;
  unidades: string[];
  accentColor: string;
}

/** Card pra quem visita a página pública sem conta: cria o perfil do atleta já pedindo o
 * vínculo com a escola (a escola confirma). Quem já tem conta usa o botão Conectar do topo. */
export function EscolaConviteAluno({ nomeEscola, slug, unidades, accentColor }: Props) {
  const [unidade, setUnidade] = useState<string>('');
  const precisaUnidade = unidades.length > 1;

  const params = new URLSearchParams({ ref: 'atleta', escola: slug });
  if (unidade) params.set('unidade', unidade);
  const href = `${carreiraPath('/cadastro')}?${params.toString()}`;

  return (
    <Card
      className="p-4 sm:p-5 border-dashed"
      style={{ borderColor: `${accentColor}80`, borderWidth: 2 }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: accentColor, color: '#ffffff' }}
          >
            <UserPlus className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Aluno do {nomeEscola}?</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Crie o perfil do atleta no Carreira ID e registre a trajetória. A escola confirma o vínculo.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end sm:shrink-0">
          {precisaUnidade && (
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Unidade em que treina">
                <SelectValue placeholder="Em qual unidade treina? (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <a
            href={href}
            className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
            style={{ backgroundColor: accentColor, color: '#ffffff' }}
          >
            Criar perfil
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </Card>
  );
}
