import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface HistoricoProfissional {
  id: string;
  instituicao: string;
  cargo: string;
  data_inicio: string;
  data_fim: string | null;
  atual: boolean;
  observacoes: string | null;
}

interface Props {
  historico: HistoricoProfissional[];
  isOwner?: boolean;
  /** Quem pode excluir -- por padrão igual a isOwner, mas em Modo Suporte
   * o admin edita/adiciona sem poder apagar (mesma régua do dono real). */
  podeExcluir?: boolean;
  onAdd?: () => void;
  onEdit?: (item: HistoricoProfissional) => void;
  onDelete?: (id: string) => void;
  accentColor?: string;
}

function formatPeriod(inicio: string, fim: string | null, atual: boolean) {
  const startParts = inicio.split('-');
  const startDate = new Date(parseInt(startParts[0]), parseInt(startParts[1] || '1') - 1);
  const startStr = format(startDate, "MMM yyyy", { locale: ptBR });

  if (atual) return `${startStr} - Atual`;
  if (fim) {
    const endParts = fim.split('-');
    const endDate = new Date(parseInt(endParts[0]), parseInt(endParts[1] || '1') - 1);
    return `${startStr} - ${format(endDate, "MMM yyyy", { locale: ptBR })}`;
  }
  return startStr;
}

export function HistoricoProfissionalSection({ historico, isOwner, podeExcluir, onAdd, onEdit, onDelete, accentColor = '#3b82f6' }: Props) {
  const podeMesmoExcluir = podeExcluir ?? isOwner;
  if (historico.length === 0 && !isOwner) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5" style={{ color: accentColor }} />
            Histórico Profissional
          </CardTitle>
          {isOwner && onAdd && (
            <Button variant="outline" size="sm" className="gap-1 border-dashed" onClick={onAdd}>
              <Plus className="w-4 h-4" />
              Adicionar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {historico.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma experiência profissional</p>
            {isOwner && <p className="text-xs mt-1">Adicione locais onde você trabalhou</p>}
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
            {historico.map((item) => (
              <div key={item.id} className="relative pl-12 pb-4 last:pb-0">
                <div className="absolute left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}18`, borderColor: accentColor, color: accentColor }}>
                  <Building2 className="w-3 h-3" />
                </div>
                <div className="p-3 rounded-lg hover:bg-muted/30 transition-colors group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{item.instituicao}</h4>
                      <p className="text-sm text-muted-foreground">{item.cargo}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3" />
                        {formatPeriod(item.data_inicio, item.data_fim, item.atual)}
                        {item.atual && (
                          <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0">Atual</Badge>
                        )}
                      </div>
                      {item.observacoes && (
                        <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-line">{item.observacoes}</p>
                      )}
                    </div>
                    {isOwner && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEdit && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(item)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                        {onDelete && podeMesmoExcluir && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(item.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
