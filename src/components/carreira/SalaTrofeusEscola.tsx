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

export type BannerSala = 'futebol' | 'volei' | 'padrao';

/** Opções de banner que o dono escolhe ao criar a sala. */
export const OPCOES_BANNER: { id: BannerSala; rotulo: string; imagem?: string }[] = [
  { id: 'futebol', rotulo: 'Futebol', imagem: '/sala-trofeus/futebol.webp' },
  { id: 'volei', rotulo: 'Vôlei', imagem: '/sala-trofeus/volei.webp' },
  { id: 'padrao', rotulo: 'Outro esporte' },
];

const FUNDO_PADRAO = 'linear-gradient(120deg, #0b0b0f 0%, #1c1508 55%, #5a3d0a 100%)';

const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Banner sugerido enquanto o dono não escolhe: pelo esporte do perfil da escola. */
export function bannerSugerido(modalidades?: string[]): BannerSala {
  const nomes = (modalidades || []).map(semAcento);
  const futebol = nomes.some((n) => n.includes('futebol'));
  const volei = nomes.some((n) => n.includes('volei'));
  if (volei && !futebol) return 'volei';
  if (futebol) return 'futebol';
  return nomes.length > 0 ? 'padrao' : 'futebol';
}

interface Props {
  perfilRedeId: string;
  /** Esportes do perfil da escola: só servem para sugerir o banner. */
  modalidades?: string[];
  /** Banner já escolhido pelo dono (guardado no perfil da escola). */
  bannerEscolhido?: string | null;
  /** Quem pode excluir -- por padrão igual a isOwner, mas em Modo Suporte
   * o admin edita/adiciona sem poder apagar (mesma régua do dono real). */
  podeExcluir?: boolean;
  isOwner?: boolean;
  accentColor?: string;
  onAdd?: () => void;
  onEdit?: (item: TrofeuEscola) => void;
  onDelete?: (id: string) => void;
  /** Grava o banner escolhido; o dono só consegue escolher quando isto vem preenchido. */
  onEscolherBanner?: (banner: BannerSala) => Promise<void>;
}

export function SalaTrofeusEscola({ perfilRedeId, modalidades, bannerEscolhido, isOwner, podeExcluir, accentColor = '#3b82f6', onAdd, onEdit, onDelete, onEscolherBanner }: Props) {
  const { data: trofeus, isLoading } = useTrofeusEscola(perfilRedeId);
  const [aberta, setAberta] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const itens = trofeus || [];
  // Visitante só vê a sala se houver conquista; o dono vê sempre, para criar.
  if (itens.length === 0 && !isOwner) return null;

  const atual = (OPCOES_BANNER.find((o) => o.id === bannerEscolhido)?.id ?? bannerSugerido(modalidades)) as BannerSala;
  const criando = itens.length === 0 && !bannerEscolhido;

  const escolher = async (banner: BannerSala) => {
    if (!onEscolherBanner) return;
    setSalvando(true);
    try {
      await onEscolherBanner(banner);
      setEscolhendo(false);
      // Sala nova: logo depois de escolher o banner, já abre o cadastro da primeira conquista.
      if (itens.length === 0) onAdd?.();
    } finally {
      setSalvando(false);
    }
  };

  const opcao = OPCOES_BANNER.find((o) => o.id === atual)!;
  const titulos = itens.filter((t) => t.colocacao === 'campeao').length;
  const resumo = itens.length === 0
    ? 'Adicione os títulos e conquistas da escola.'
    : `${itens.length} ${itens.length === 1 ? 'conquista' : 'conquistas'}${titulos > 0 ? ` · ${titulos} ${titulos === 1 ? 'título' : 'títulos'}` : ''}. Veja todas as conquistas e momentos especiais da nossa escola.`;

  return (
    <div className="space-y-3">
      {criando && isOwner && onEscolherBanner ? (
        <SeletorBanner sugerido={atual} salvando={salvando} onEscolher={escolher} />
      ) : (
        <section
          className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-black"
          style={opcao.imagem ? undefined : { backgroundImage: FUNDO_PADRAO }}
        >
          {opcao.imagem && <img src={opcao.imagem} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-right" />}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/10 sm:via-black/40" />
          {isOwner && onEscolherBanner && (
            <button type="button" onClick={() => setEscolhendo(true)} className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[11px] text-white/80 hover:bg-black/70">
              <Pencil className="h-3 w-3" /> Trocar banner
            </button>
          )}
          <div className="relative flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-7 min-h-[170px]">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-amber-400/80 bg-black/40 sm:h-14 sm:w-14">
                <Trophy className="h-6 w-6 text-amber-400 sm:h-7 sm:w-7" />
              </div>
              <div className="leading-none">
                <h3 className="text-2xl font-black italic uppercase text-white sm:text-3xl" style={{ textShadow: '0 2px 10px rgba(0,0,0,.6)' }}>Sala de</h3>
                <h3 className="-mt-0.5 text-3xl font-black italic uppercase text-amber-400 sm:text-4xl" style={{ textShadow: '0 2px 10px rgba(0,0,0,.6)' }}>Troféus</h3>
              </div>
            </div>
            <div className="max-w-sm space-y-3">
              <p className="text-sm text-white/90">{resumo}</p>
              <button
                type="button"
                onClick={() => setAberta(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-2 text-sm font-bold text-black shadow-lg transition hover:brightness-110"
              >
                {itens.length === 0 && isOwner ? 'Abrir e adicionar' : 'Acessar Sala de Troféus'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      <Dialog open={escolhendo} onOpenChange={setEscolhendo}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Banner da Sala de Troféus</DialogTitle>
          <DialogDescription>Escolha a imagem que aparece no perfil da escola.</DialogDescription>
          <SeletorBanner sugerido={atual} salvando={salvando} onEscolher={escolher} semMoldura />
        </DialogContent>
      </Dialog>

      <Dialog open={aberta} onOpenChange={setAberta}>
        <DialogContent className="max-w-2xl max-h-[calc(100dvh-8rem)] overflow-y-auto p-0 border-0 bg-transparent shadow-none [&>button]:hidden sm:[&>button]:flex">
          <DialogTitle className="sr-only">Sala de Troféus</DialogTitle>
          <DialogDescription className="sr-only">Conquistas da escola</DialogDescription>
          <ListaSala
            itens={itens}
            titulo="Sala de Troféus"
            isOwner={isOwner}
            podeExcluir={podeExcluir ?? isOwner}
            accentColor={accentColor}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Os banners lado a lado; o sugerido vem marcado. */
function SeletorBanner({ sugerido, salvando, onEscolher, semMoldura }: { sugerido: BannerSala; salvando: boolean; onEscolher: (b: BannerSala) => void; semMoldura?: boolean }) {
  const [marcado, setMarcado] = useState<BannerSala>(sugerido);
  return (
    <div className={semMoldura ? 'space-y-3' : 'space-y-3 rounded-xl border border-dashed p-4'}>
      {!semMoldura && (
        <div>
          <p className="text-sm font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Criar a Sala de Troféus</p>
          <p className="text-xs text-muted-foreground mt-0.5">Escolha o banner da sala da escola. Depois você cadastra a primeira conquista.</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OPCOES_BANNER.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setMarcado(o.id)}
            disabled={salvando}
            aria-pressed={marcado === o.id}
            className={`relative h-24 overflow-hidden rounded-lg border-2 text-left transition ${marcado === o.id ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-white/10 opacity-80 hover:opacity-100'}`}
            style={o.imagem ? undefined : { backgroundImage: FUNDO_PADRAO }}
          >
            {o.imagem && <img src={o.imagem} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-right" />}
            <span className="absolute inset-0 bg-gradient-to-r from-black/85 to-black/10" />
            <span className="relative flex h-full flex-col justify-end p-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">{o.rotulo}</span>
            </span>
          </button>
        ))}
      </div>
      <Button size="sm" className="gap-2" disabled={salvando} onClick={() => onEscolher(marcado)}>
        {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
        {semMoldura ? 'Salvar banner' : 'Continuar'}
      </Button>
    </div>
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
