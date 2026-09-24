import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Trophy, Plus, MoreVertical, Pencil, Trash2, Calendar, Loader2 } from 'lucide-react';
import { useTrofeusEscola, type ColocacaoTrofeuEscola, type TrofeuEscola } from '@/hooks/useSalaTrofeusEscola';

const COLOCACAO_META: Record<ColocacaoTrofeuEscola, { label: string; emoji: string; color: string }> = {
  campeao: { label: 'Campeão', emoji: '🏆', color: '#f59e0b' },
  vice: { label: 'Vice-campeão', emoji: '🥈', color: '#94a3b8' },
  semifinalista: { label: 'Semifinalista', emoji: '🥉', color: '#d97706' },
  terceiro: { label: '3º Lugar', emoji: '🥉', color: '#d97706' },
  quartas: { label: 'Quartas de final', emoji: '🎖️', color: '#3b82f6' },
  oitavas: { label: 'Oitavas de final', emoji: '🎖️', color: '#3b82f6' },
  fase_grupos: { label: 'Fase de grupos', emoji: '🎖️', color: '#64748b' },
};

interface Props {
  perfilRedeId: string;
  isOwner?: boolean;
  accentColor?: string;
  onAdd?: () => void;
  onEdit?: (item: TrofeuEscola) => void;
  onDelete?: (id: string) => void;
}

export function SalaTrofeusEscola({ perfilRedeId, isOwner, accentColor = '#3b82f6', onAdd, onEdit, onDelete }: Props) {
  const { data: trofeus, isLoading } = useTrofeusEscola(perfilRedeId);

  const byYear = useMemo(() => {
    const grouped: Record<number, TrofeuEscola[]> = {};
    (trofeus || []).forEach((t) => {
      (grouped[t.ano] ||= []).push(t);
    });
    return grouped;
  }, [trofeus]);
  const anos = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  const stats = useMemo(() => {
    const items = trofeus || [];
    return {
      total: items.length,
      titulos: items.filter((t) => t.colocacao === 'campeao').length,
      vices: items.filter((t) => t.colocacao === 'vice').length,
    };
  }, [trofeus]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if ((trofeus || []).length === 0 && !isOwner) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5" style={{ color: accentColor }} />
            Sala de Troféus
          </CardTitle>
          {isOwner && onAdd && (
            <Button variant="outline" size="sm" className="gap-1 border-dashed" onClick={onAdd}>
              <Plus className="w-4 h-4" />
              Adicionar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(trofeus || []).length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Trophy className="w-10 h-10 mx-auto mb-2 opacity-40" style={{ color: accentColor }} />
            <p className="text-sm">Nenhum troféu registrado ainda</p>
            {isOwner && <p className="text-xs mt-1">Adicione os títulos e conquistas da escola</p>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatBox label="Total" value={stats.total} accentColor={accentColor} />
              <StatBox label="Títulos" value={stats.titulos} color="#f59e0b" />
              <StatBox label="Vices" value={stats.vices} color="#94a3b8" />
            </div>
            <div className="space-y-4">
              {anos.map((ano) => (
                <div key={ano}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">{ano}</h4>
                    <Badge variant="secondary" className="text-[10px]">{byYear[ano].length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {byYear[ano].map((item) => (
                      <TrofeuRow key={item.id} item={item} isOwner={isOwner} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value, accentColor, color }: { label: string; value: number; accentColor?: string; color?: string }) {
  const c = color || accentColor || '#3b82f6';
  return (
    <div className="rounded-lg p-3 text-center border-2" style={{ borderColor: `${c}40`, backgroundColor: `${c}10` }}>
      <div className="text-2xl font-bold" style={{ color: c }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function TrofeuRow({ item, isOwner, onEdit, onDelete }: { item: TrofeuEscola; isOwner?: boolean; onEdit?: (item: TrofeuEscola) => void; onDelete?: (id: string) => void }) {
  const meta = COLOCACAO_META[item.colocacao];
  const subLinha = [meta.label, item.categoria].filter(Boolean).join(' • ');

  return (
    <div className="relative flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}10` }}>
      <span className="text-lg leading-none mt-0.5">{meta.emoji}</span>
      <div className="flex-1 min-w-0 pr-6">
        <h5 className="font-semibold text-sm leading-snug">{item.titulo}</h5>
        <p className="text-xs font-medium mt-0.5" style={{ color: meta.color }}>{subLinha}</p>
        {item.organizador && <p className="text-xs text-muted-foreground mt-0.5">{item.organizador}</p>}
      </div>
      {isOwner && (onEdit || onDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 absolute top-1.5 right-1.5">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem onClick={() => onDelete(item.id)} className="text-destructive focus:text-destructive">
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
