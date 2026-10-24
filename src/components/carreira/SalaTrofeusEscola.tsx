import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Trophy, Plus, MoreVertical, Pencil, Trash2, Calendar, Loader2, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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

/** Esportes que têm banner próprio; os demais usam o fundo dourado genérico. */
const IMAGEM_BANNER: Record<string, string> = {
  futebol: '/sala-trofeus/futebol.webp',
  volei: '/sala-trofeus/volei.webp',
};

export interface ModalidadeSala { slug: string; label: string }

/** "Vôlei" -> "volei": chave estável gravada no troféu. */
export const slugModalidade = (nome: string) => {
  const base = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  // Varia\u00e7\u00f5es do mesmo esporte (V\u00f4lei de Quadra/Areia, Futebol de Campo/7) dividem a mesma sala.
  if (base.includes('volei')) return 'volei';
  if (base.includes('futebol')) return 'futebol';
  return base.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

const ROTULO_ESPORTE: Record<string, string> = { futebol: 'Futebol', volei: 'V\u00f4lei' };
export const rotuloModalidade = (slug: string, nome?: string) => ROTULO_ESPORTE[slug] || nome || slug.charAt(0).toUpperCase() + slug.slice(1);

interface Props {
  perfilRedeId: string;
  /** Esportes da escola, na ordem do perfil. Vazio = só futebol. */
  modalidades?: string[];
  className?: string;
  isOwner?: boolean;
  /** Quem pode excluir -- por padrão igual a isOwner, mas em Modo Suporte
   * o admin edita/adiciona sem poder apagar (mesma régua do dono real). */
  podeExcluir?: boolean;
  accentColor?: string;
  onAdd?: (modalidade: string) => void;
  onEdit?: (item: TrofeuEscola) => void;
  onDelete?: (id: string) => void;
}

export function SalaTrofeusEscola({ perfilRedeId, modalidades, isOwner, podeExcluir, accentColor = '#3b82f6', onAdd, onEdit, onDelete }: Props) {
  const { data: trofeus, isLoading } = useTrofeusEscola(perfilRedeId);
  const [aberta, setAberta] = useState<string | null>(null);

  // Esportes da escola + qualquer esporte que já tenha troféu (mesmo que saia do perfil depois).
  const salas = useMemo<ModalidadeSala[]>(() => {
    const lista: ModalidadeSala[] = [];
    const add = (slug: string, label: string) => { if (slug && !lista.some((m) => m.slug === slug)) lista.push({ slug, label }); };
    (modalidades?.length ? modalidades : ['Futebol']).forEach((nome) => { const slug = slugModalidade(nome); add(slug, rotuloModalidade(slug, nome)); });
    (trofeus || []).forEach((t) => add(t.modalidade, rotuloModalidade(t.modalidade)));
    return lista;
  }, [modalidades, trofeus]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const doEsporte = (slug: string) => (trofeus || []).filter((t) => t.modalidade === slug);
  // Visitante só vê o banner do esporte que tem conquista; o dono vê todos para poder cadastrar.
  const visiveis = salas.filter((m) => isOwner || doEsporte(m.slug).length > 0);
  if (visiveis.length === 0) return null;
  const salaAberta = salas.find((m) => m.slug === aberta) || null;
  const faltantes = Object.keys(IMAGEM_BANNER).filter((slug) => !visiveis.some((m) => m.slug === slug));

  return (
    <div className="space-y-3">
      {visiveis.map((m) => (
        <BannerSala key={m.slug} sala={m} itens={doEsporte(m.slug)} isOwner={isOwner} onAbrir={() => setAberta(m.slug)} />
      ))}
      {isOwner && onAdd && faltantes.length > 0 && (
        <div className="rounded-xl border border-dashed p-3 space-y-2">
          <p className="text-sm font-medium">Criar uma sala de troféus</p>
          <p className="text-xs text-muted-foreground">Escolha o esporte. O banner aparece no perfil assim que você adicionar a primeira conquista.</p>
          <div className="grid grid-cols-2 gap-2">
            {faltantes.map((slug) => (
              <button key={slug} type="button" onClick={() => onAdd(slug)} className="group relative overflow-hidden rounded-lg border border-amber-500/30 h-20 text-left">
                <img src={IMAGEM_BANNER[slug]} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-right transition group-hover:scale-105" />
                <span className="absolute inset-0 bg-gradient-to-r from-black/85 to-black/10" />
                <span className="relative flex h-full flex-col justify-center gap-0.5 px-3">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">{rotuloModalidade(slug)}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-white"><Plus className="h-3.5 w-3.5" /> Criar sala</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <Dialog open={!!salaAberta} onOpenChange={(v) => { if (!v) setAberta(null); }}>
        <DialogContent className="max-w-2xl max-h-[calc(100dvh-8rem)] overflow-y-auto p-0 border-0 bg-transparent shadow-none [&>button]:hidden sm:[&>button]:flex">
          <DialogTitle className="sr-only">Sala de Troféus — {salaAberta?.label}</DialogTitle>
          <DialogDescription className="sr-only">Conquistas da escola neste esporte</DialogDescription>
          {salaAberta && (
            <ListaSala
              itens={doEsporte(salaAberta.slug)}
              titulo={`Sala de Troféus · ${salaAberta.label}`}
              isOwner={isOwner}
              podeExcluir={podeExcluir ?? isOwner}
              accentColor={accentColor}
              onAdd={onAdd ? () => onAdd(salaAberta.slug) : undefined}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BannerSala({ sala, itens, isOwner, onAbrir }: { sala: ModalidadeSala; itens: TrofeuEscola[]; isOwner?: boolean; onAbrir: () => void }) {
  const imagem = IMAGEM_BANNER[sala.slug];
  const titulos = itens.filter((t) => t.colocacao === 'campeao').length;
  const resumo = itens.length === 0
    ? 'Adicione os títulos e conquistas da escola.'
    : `${itens.length} ${itens.length === 1 ? 'conquista' : 'conquistas'}${titulos > 0 ? ` · ${titulos} ${titulos === 1 ? 'título' : 'títulos'}` : ''}. Veja todas as conquistas e momentos especiais da nossa escola.`;
  return (
    <section
      className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-black"
      style={imagem ? undefined : { backgroundImage: 'linear-gradient(120deg, #0b0b0f 0%, #1c1508 55%, #5a3d0a 100%)' }}
    >
      {imagem && <img src={imagem} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-right" />}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/10 sm:via-black/40" />
      <div className="relative flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-7 min-h-[170px]">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-amber-400/80 bg-black/40 sm:h-14 sm:w-14">
            <Trophy className="h-6 w-6 text-amber-400 sm:h-7 sm:w-7" />
          </div>
          <div className="leading-none">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-300/90">{sala.label}</p>
            <h3 className="mt-1 text-2xl font-black italic uppercase text-white sm:text-3xl" style={{ textShadow: '0 2px 10px rgba(0,0,0,.6)' }}>Sala de</h3>
            <h3 className="-mt-0.5 text-3xl font-black italic uppercase text-amber-400 sm:text-4xl" style={{ textShadow: '0 2px 10px rgba(0,0,0,.6)' }}>Troféus</h3>
          </div>
        </div>
        <div className="max-w-sm space-y-3">
          <p className="text-sm text-white/90">{resumo}</p>
          <button
            type="button"
            onClick={onAbrir}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-2 text-sm font-bold text-black shadow-lg transition hover:brightness-110"
          >
            {itens.length === 0 && isOwner ? 'Abrir e adicionar' : 'Acessar Sala de Troféus'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function ListaSala({ itens, titulo, isOwner, podeExcluir, accentColor, onAdd, onEdit, onDelete }: {
  itens: TrofeuEscola[]; titulo: string; isOwner?: boolean; podeExcluir?: boolean; accentColor: string;
  onAdd?: () => void; onEdit?: (item: TrofeuEscola) => void; onDelete?: (id: string) => void;
}) {
  const byYear = useMemo(() => {
    const grouped: Record<number, TrofeuEscola[]> = {};
    itens.forEach((t) => { (grouped[t.ano] ||= []).push(t); });
    return grouped;
  }, [itens]);
  const anos = Object.keys(byYear).map(Number).sort((a, b) => b - a);
  const stats = {
    total: itens.length,
    titulos: itens.filter((t) => t.colocacao === 'campeao').length,
    vices: itens.filter((t) => t.colocacao === 'vice').length,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CabecalhoSala
          icone={<Trophy className="w-5 h-5" style={{ color: accentColor }} />}
          titulo={titulo}
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
        {itens.length === 0 ? (
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
                      <TrofeuRow key={item.id} item={item} isOwner={isOwner} podeExcluir={podeExcluir} onEdit={onEdit} onDelete={onDelete} />
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
              className={`${i === 2 ? 'hidden sm:block' : ''} min-w-0 max-w-[110px] flex-1 aspect-[4/3] sm:aspect-auto sm:max-w-none sm:flex-none sm:h-16 sm:w-20 lg:h-20 lg:w-28 overflow-hidden rounded-lg border border-white/10 bg-muted`}
            >
              <img src={f.thumb_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform hover:scale-105" />
            </button>
          ))}
          {fotos.length > 2 && (
            <button
              type="button"
              onClick={() => abrir(fotos.length > 3 ? 3 : 2)}
              aria-label={`Ver mais fotos — ${item.titulo}`}
              className={`${fotos.length === 3 ? 'sm:hidden' : ''} flex min-w-0 max-w-[110px] flex-1 aspect-[4/3] sm:aspect-auto sm:max-w-none sm:flex-none sm:h-16 sm:w-20 lg:h-20 lg:w-28 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-sm font-semibold hover:bg-black/50`}
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
