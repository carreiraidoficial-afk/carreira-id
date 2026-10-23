import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Trophy, Plus, MoreVertical, Pencil, Trash2, Calendar, Loader2 } from 'lucide-react';
import { CabecalhoSala, FaixaConquistas, SeloTrofeu, resumoConquistas, tipoDoSelo } from './trofeus-ui';
import { useTrofeusEscola, type ColocacaoTrofeuEscola, type TrofeuEscola } from '@/hooks/useSalaTrofeusEscola';
import { GaleriaFotosDialog } from './GaleriaFotosDialog';

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
  /** Quem pode excluir -- por padrão igual a isOwner, mas em Modo Suporte
   * o admin edita/adiciona sem poder apagar (mesma régua do dono real). */
  podeExcluir?: boolean;
  accentColor?: string;
  onAdd?: () => void;
  onEdit?: (item: TrofeuEscola) => void;
  onDelete?: (id: string) => void;
}

export function SalaTrofeusEscola({ perfilRedeId, isOwner, podeExcluir, accentColor = '#3b82f6', onAdd, onEdit, onDelete }: Props) {
  const podeMesmoExcluir = podeExcluir ?? isOwner;
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
        <CabecalhoSala
          icone={<Trophy className="w-5 h-5" style={{ color: accentColor }} />}
          resumo={resumoConquistas({ titulos: stats.titulos, vices: stats.vices, anoRecente: anos[0] })}
          direita={isOwner && onAdd ? (
            <Button variant="outline" size="sm" className="gap-1 border-dashed shrink-0" onClick={onAdd}>
              <Plus className="w-4 h-4" />
              Adicionar
            </Button>
          ) : undefined}
        />
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
            <FaixaConquistas itens={[
              { valor: stats.total, rotulo: 'Troféus', cor: accentColor },
              { valor: stats.titulos, rotulo: 'Títulos', cor: '#f59e0b', esconderSeZero: true },
              { valor: stats.vices, rotulo: 'Vices', cor: '#94a3b8', esconderSeZero: true },
            ]} />
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
                      <TrofeuRow key={item.id} item={item} isOwner={isOwner} podeExcluir={podeMesmoExcluir} onEdit={onEdit} onDelete={onDelete} />
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

function TrofeuRow({ item, isOwner, podeExcluir, onEdit, onDelete }: { item: TrofeuEscola; isOwner?: boolean; podeExcluir?: boolean; onEdit?: (item: TrofeuEscola) => void; onDelete?: (id: string) => void }) {
  const meta = COLOCACAO_META[item.colocacao];
  const subLinha = [meta.label, item.categoria].filter(Boolean).join(' • ');
  const fotos = item.fotos || [];
  const [galeria, setGaleria] = useState<number | null>(null);
  const abrir = (indice: number) => setGaleria(indice);

  return (
    <div className="relative flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 rounded-xl border" style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}10` }}>
      <SeloTrofeu tipo={tipoDoSelo(item.colocacao)} />
      <div className="flex-1 min-w-0 pr-6">
        <h5 className="font-semibold text-sm leading-snug">{item.titulo}</h5>
        <p className="text-xs font-medium mt-0.5" style={{ color: meta.color }}>{subLinha}</p>
        {item.organizador && <p className="text-xs text-muted-foreground mt-0.5">{item.organizador}</p>}
      </div>
      {fotos.length > 0 && (
        <div className="basis-full sm:basis-auto flex items-center gap-2 order-last sm:order-none">
          {fotos.slice(0, 3).map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => abrir(i)}
              aria-label={`Ver foto ${i + 1} de ${fotos.length} — ${item.titulo}`}
              className={`${i === 2 ? 'hidden sm:block' : ''} h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-muted`}
            >
              <img src={f.thumb_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform hover:scale-105" />
            </button>
          ))}
          {fotos.length > 2 && (
            <button
              type="button"
              onClick={() => abrir(fotos.length > 3 ? 3 : 2)}
              aria-label={`Ver mais fotos — ${item.titulo}`}
              className={`${fotos.length === 3 ? 'sm:hidden' : ''} flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-sm font-semibold hover:bg-black/50`}
            >
              <span className="sm:hidden">+{fotos.length - 2}</span>
              <span className="hidden sm:inline">+{fotos.length - 3}</span>
            </button>
          )}
        </div>
      )}
      {galeria !== null && (
        <GaleriaFotosDialog
          fotos={fotos.map((f) => ({ id: f.id, url: f.url }))}
          indiceInicial={galeria}
          aberto
          titulo={`${item.titulo} — ${subLinha}`}
          onFechar={() => setGaleria(null)}
        />
      )}
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
            {onDelete && podeExcluir && (
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
