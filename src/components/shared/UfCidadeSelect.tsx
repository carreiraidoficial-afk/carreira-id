import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ESTADOS, ESTADO_LABELS } from '@/constants/esportes';
import { useCidadesPorEstado } from '@/hooks/useCidadesPorEstado';
import { Loader2 } from 'lucide-react';
import { useRef } from 'react';

interface UfCidadeSelectProps {
  estado: string;
  cidade: string;
  onEstadoChange: (uf: string) => void;
  onCidadeChange: (cidade: string) => void;
  /** Show full state name in the select */
  showFullStateName?: boolean;
  className?: string;
}

export function UfCidadeSelect({
  estado,
  cidade,
  onEstadoChange,
  onCidadeChange,
  showFullStateName = false,
  className = 'grid grid-cols-2 gap-4',
}: UfCidadeSelectProps) {
  const { data: cidades, isLoading: loadingCidades } = useCidadesPorEstado(estado);

  // Valor MAIS RECENTE do estado: ao abrir um perfil já salvo, o estado chega depois da primeira renderização e o
  // Select pode avisar "mudou pra RJ" com o closure antigo (estado ''), o que zerava a cidade salva.
  const estadoAtual = useRef(estado);
  estadoAtual.current = estado;
  const handleEstadoChange = (uf: string) => {
    if (!uf) return;
    onEstadoChange(uf);
    // Clear cidade when UF changes
    if (uf !== estadoAtual.current) {
      onCidadeChange('');
    }
  };

  return (
    <div className={className}>
      <div className="space-y-2">
        <label className="text-sm font-medium">Estado</label>
        <Select value={estado} onValueChange={handleEstadoChange}>
          <SelectTrigger>
            <SelectValue placeholder="UF" />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map((uf) => (
              <SelectItem key={uf} value={uf}>
                {showFullStateName ? `${uf} - ${ESTADO_LABELS[uf]}` : uf}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Cidade</label>
        {/* Ignora o aviso "vazio": enquanto as cidades carregam, o Select reseta o valor salvo e avisaria ''. */}
        <Select value={cidade} onValueChange={(v) => { if (v) onCidadeChange(v); }} disabled={!estado}>
          <SelectTrigger>
            <SelectValue placeholder={loadingCidades ? 'Carregando...' : 'Selecione'} />
            {loadingCidades && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
          </SelectTrigger>
          <SelectContent>
            {(cidades || []).map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
