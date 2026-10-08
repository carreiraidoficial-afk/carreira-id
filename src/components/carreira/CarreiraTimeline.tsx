import { useEffect, useState, lazy, Suspense } from 'react';
import { PerfilAtleta, usePostsAtleta, useAtividadesPublicas, useEscolinhasCarreira } from '@/hooks/useCarreiraData';
import { useCarreiraExperiencias, useDeleteCarreiraExperiencia, CarreiraExperiencia } from '@/hooks/useCarreiraExperienciasData';
import { AtividadeExterna } from '@/hooks/useAtividadesExternasData';
// Carregado sob demanda: só o dono do perfil vê esse formulário, mas ele
// carrega heic2any (~1,3MB) -- import estático fazia todo visitante baixar
// essa biblioteca à toa.
const CreatePostForm = lazy(() => import('./CreatePostForm').then(m => ({ default: m.CreatePostForm })));
import { PostCard } from './PostCard';
import { AtividadePublicaCard } from './AtividadePublicaCard';
import { ExperienciaSection } from './ExperienciaSection';
import { CarreiraStatsCards } from './CarreiraStatsCards';
import { SalaTrofeusAtleta, useCarreiraCampeonatoTrofeus } from './SalaTrofeusAtleta';
import { CarreiraAtividadeFormDialog } from './CarreiraAtividadeFormDialog';
import { ExperienciaFormDialog } from './ExperienciaFormDialog';
import { JornadaEsportivaSection } from './JornadaEsportivaSection';
import { JornadaCampeonatoFormDialog } from './JornadaCampeonatoFormDialog';
import { JornadaJogoFormDialog } from './JornadaJogoFormDialog';
import { useJornada } from '@/hooks/useJornada';
import type { CampeonatoComJogos, JogoComMidia } from '@/types/jornada-esportiva';
import { useCarreiraAtividadeLimit } from '@/hooks/useCarreiraFreemium';
import { useCarreiraPlano } from '@/hooks/useCarreiraPlano';
import { PlanBadge } from './FeatureGate';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, Building2, BarChart3, Dumbbell, Swords, Medal, Plus, Pencil, Trash2, Save, ChevronRight, ChevronLeft, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { VisaoGeralAtleta } from './VisaoGeralAtleta';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CarreiraTimelineProps {
  perfil: PerfilAtleta;
  /** Pode criar/editar (dono real OU colaborador ativo). */
  isOwner?: boolean;
  /** Pode excluir jogos/campeonatos/experiências -- só o dono real, nunca
   * um colaborador, mesmo que ele tenha "isOwner" true pra poder postar. */
  podeExcluir?: boolean;
  /** 'tabs' (default) é o comportamento de sempre -- pills + publicações
   * sempre visíveis embaixo. 'grid' é a página dedicada de Currículo: vira
   * uma grade de cards grandes (Publicações incluída como card), sem nada
   * visível até a pessoa clicar em um. 'perfil' é o perfil público do atleta: seletor de abas com Visão Geral
   * (aberta por padrão) e sem publicações, que vivem só no Feed. */
  layout?: 'tabs' | 'grid' | 'perfil';
}

const GRID_TABS = [
  { value: 'jornada', label: 'Jornada Esportiva', icon: Swords, description: 'Registre seus jogos, treinos, campeonatos e evolução.', color: 'blue' },
  { value: 'publicacoes', label: 'Publicações', icon: FileText, description: 'Compartilhe suas conquistas, treinos e momentos especiais.', color: 'orange' },
  { value: 'estatisticas', label: 'Estatísticas', icon: BarChart3, description: 'Acompanhe seu desempenho em jogos e competições.', color: 'green' },
  { value: 'premiacoes', label: 'Premiações', icon: Medal, description: 'Seus títulos, medalhas e conquistas.', color: 'purple' },
  { value: 'experiencia', label: 'Experiência', icon: Building2, description: 'Clubes, escolinhas e eventos que participou.', color: 'indigo' },
  { value: 'atividades', label: 'Atividades Extras', icon: Dumbbell, description: 'Cursos, avaliações, peneiras e outras atividades.', color: 'red' },
] as const;

const GRID_COLOR_CLASSES: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-600' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-600' },
  green: { bg: 'bg-green-500/10', text: 'text-green-600' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-600' },
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-600' },
  red: { bg: 'bg-red-500/10', text: 'text-red-600' },
};

const GRID_COUNT_LABELS: Record<string, string> = {
  jornada: 'registros',
  publicacoes: 'publicações',
  estatisticas: 'jogos',
  premiacoes: 'premiações',
  experiencia: 'experiências',
  atividades: 'atividades',
};

const INSTITUTIONAL_TABS = [
  { value: 'experiencia', label: 'Experiência', icon: Building2, hint: 'Clubes, escolinhas e passagens do atleta' },
  { value: 'estatisticas', label: 'Estatísticas', icon: BarChart3, hint: 'Números consolidados de jogos, gols e assistências' },
  { value: 'atividades', label: 'Atividades Extras', icon: Dumbbell, hint: 'Treinos e atividades fora do clube' },
  { value: 'jornada', label: 'Jornada Esportiva', icon: Swords, hint: 'Campeonatos e jogos disputados' },
  { value: 'premiacoes', label: 'Premiações', icon: Medal, hint: 'Títulos e prêmios individuais' },
];

const CARREIRA_TABS = [
  { value: 'carreira-experiencia', label: 'Experiência', icon: Building2 },
  { value: 'carreira-atividades', label: 'Atividades', icon: Dumbbell },
];

export function CarreiraTimeline({ perfil, isOwner = false, podeExcluir = isOwner, layout = 'tabs' }: CarreiraTimelineProps) {
  const [activeTab, setActiveTab] = useState<string | null>(layout === 'perfil' ? 'visao' : null);
  const [atividadeFormOpen, setAtividadeFormOpen] = useState(false);
  const [experienciaFormOpen, setExperienciaFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<AtividadeExterna | null>(null);
  const [editingExperiencia, setEditingExperiencia] = useState<CarreiraExperiencia | null>(null);
  const [deleteExpId, setDeleteExpId] = useState<string | null>(null);
  const [campeonatoFormOpen, setCampeonatoFormOpen] = useState(false);
  const [jogoFormOpen, setJogoFormOpen] = useState(false);
  const [editingCampeonato, setEditingCampeonato] = useState<CampeonatoComJogos | null>(null);
  const [editingJogo, setEditingJogo] = useState<JogoComMidia | null>(null);

  const { data: posts, isLoading: postsLoading } = usePostsAtleta(perfil.id);
  const isPlatformProfile = perfil.modalidade === 'Plataforma' || !perfil.crianca_id;
  const { data: atividades, isLoading: atividadesLoading } = useAtividadesPublicas(isPlatformProfile ? undefined : perfil.crianca_id);
  const { data: escolinhas, isLoading: escolinhasLoading } = useEscolinhasCarreira(isPlatformProfile ? undefined : perfil.crianca_id);
  const { data: experiencias, isLoading: experienciasLoading } = useCarreiraExperiencias(isPlatformProfile ? undefined : perfil.crianca_id);
  const { data: limitResult } = useCarreiraAtividadeLimit(isOwner && perfil.crianca_id ? perfil.crianca_id : null);
  const deleteExperiencia = useDeleteCarreiraExperiencia();
  const jornada = useJornada(isPlatformProfile ? null : perfil.crianca_id);
  const { data: trofeus } = useCarreiraCampeonatoTrofeus(isPlatformProfile ? null : perfil.crianca_id);

  const gridCounts: Record<string, number> = {
    jornada: jornada.data.campeonatos.length + jornada.data.amistosos.length,
    publicacoes: posts?.length || 0,
    estatisticas: jornada.data.estatisticas?.totalJogos || 0,
    premiacoes: trofeus?.length || 0,
    experiencia: experiencias?.length || 0,
    atividades: atividades?.length || 0,
  };

  const dadosPublicos = (perfil as any).dados_publicos as {
    gols?: boolean; campeonatos?: boolean; amistosos?: boolean; premiacoes?: boolean; conquistas?: boolean;
  } | undefined;

  const accentColor = perfil.cor_destaque || '#3b82f6';
  const activeTabs = INSTITUTIONAL_TABS;


  useEffect(() => {
    if (editingCampeonato) {
      const atualizado = jornada.data.campeonatos.find((c) => c.id === editingCampeonato.id);
      if (atualizado && atualizado !== editingCampeonato) setEditingCampeonato(atualizado);
    }

    if (editingJogo) {
      const jogos = [...jornada.data.amistosos, ...jornada.data.campeonatos.flatMap((c) => c.jogos)];
      const atualizado = jogos.find((j) => j.id === editingJogo.id);
      if (atualizado && atualizado !== editingJogo) setEditingJogo(atualizado);
    }
  }, [editingCampeonato, editingJogo, jornada.data.amistosos, jornada.data.campeonatos]);

  const handleTabClick = (value: string) => {
    // No perfil sempre há uma aba aberta (a Visão Geral é o ponto de partida); nos outros layouts clicar de novo fecha.
    if (layout === 'perfil') {
      setActiveTab(value);
      return;
    }
    setActiveTab(prev => prev === value ? null : value);
  };

  const renderNewAtividadeButton = (label: string, onClick: () => void) => (
    isOwner && perfil.crianca_id && (
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={onClick}
        style={{ borderColor: `${accentColor}40`, color: accentColor }}
      >
        <Plus className="w-4 h-4" />
        {label}
        {limitResult?.source === 'freemium' && limitResult.limit > 0 && (
          <span className="text-xs opacity-70">
            ({limitResult.count}/{limitResult.limit})
          </span>
        )}
      </Button>
    )
  );

  const formatDateRange = (start: string, end?: string | null, isAtual?: boolean) => {
    const startFormatted = format(new Date(start), "MMM yyyy", { locale: ptBR });
    if (isAtual) return `${startFormatted} - Atual`;
    if (end) return `${startFormatted} - ${format(new Date(end), "MMM yyyy", { locale: ptBR })}`;
    return startFormatted;
  };

  const handleEditActivity = async (atv: any) => {
    if (atv?.origem === 'atleta_id') {
      toast.info('Essa atividade veio do Atleta ID e só pode ser editada lá.');
      return;
    }

    // Fetch full record for editing (public query only has subset of fields)
    try {
      const { data, error } = await supabase
        .from('atividades_externas')
        .select('*')
        .eq('id', atv.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('Atividade não encontrada para edição.');
        return;
      }

      setEditingActivity(data as AtividadeExterna);
      setAtividadeFormOpen(true);
    } catch {
      toast.error('Não foi possível abrir esta atividade para edição.');
    }
  };

  const handleEditExperiencia = (exp: CarreiraExperiencia) => {
    setEditingExperiencia(exp);
    setExperienciaFormOpen(true);
  };

  const handleDeleteExperiencia = async () => {
    if (!deleteExpId || !perfil.crianca_id) return;
    try {
      await deleteExperiencia.mutateAsync({ id: deleteExpId, criancaId: perfil.crianca_id });
      toast.success('Experiência removida');
      setDeleteExpId(null);
    } catch {
      toast.error('Erro ao remover experiência');
    }
  };

  const handleAtividadeFormClose = (open: boolean) => {
    if (!open) setEditingActivity(null);
    setAtividadeFormOpen(open);
  };

  const handleExperienciaFormClose = (open: boolean) => {
    if (!open) setEditingExperiencia(null);
    setExperienciaFormOpen(open);
  };

  const renderTabContent = () => {
    if (!activeTab) return null;

    switch (activeTab) {
      case 'carreira-experiencia':
        return experienciasLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {renderNewAtividadeButton('Nova Experiência', () => {
              setEditingExperiencia(null);
              setExperienciaFormOpen(true);
            })}
            {(experiencias?.length || 0) > 0 ? (
              experiencias?.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-start gap-3 p-3 rounded-lg transition-colors"
                  style={{ backgroundColor: `${accentColor}08`, borderLeft: `3px solid ${accentColor}50` }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                  >
                    {exp.nome_escola?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm" style={{ color: accentColor }}>{exp.nome_escola}</h4>
                    <p className="text-xs text-muted-foreground">
                      {formatDateRange(exp.data_inicio, exp.data_fim, exp.atual)}
                    </p>
                    {(exp.bairro || exp.cidade || exp.estado) && (
                      <p className="text-xs text-muted-foreground">
                        {[exp.bairro, exp.cidade, exp.estado].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {exp.observacoes && (
                      <p className="text-xs text-muted-foreground mt-1">{exp.observacoes}</p>
                    )}
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditExperiencia(exp)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteExpId(exp.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-10 h-10 mx-auto opacity-40 mb-2" />
                <p className="text-sm">Nenhuma experiência registrada.</p>
                <p className="text-xs mt-1">Adicione escolas e clubes onde treinou.</p>
              </div>
            )}
          </div>
        );

      case 'carreira-atividades':
        return atividadesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {renderNewAtividadeButton('Nova Atividade', () => {
              setEditingActivity(null);
              setAtividadeFormOpen(true);
            })}
            {(atividades?.length || 0) > 0 ? (
              atividades?.map((atv) => (
                <AtividadePublicaCard
                  key={atv.id}
                  atividade={atv}
                  isOwner={isOwner}
                  accentColor={accentColor}
                  onEdit={handleEditActivity}
                />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Dumbbell className="w-10 h-10 mx-auto opacity-40 mb-2" />
                <p className="text-sm">Nenhuma atividade registrada.</p>
                <p className="text-xs mt-1">Adicione clínicas, camps, torneios e treinos.</p>
              </div>
            )}
          </div>
        );

      case 'experiencia':
        return (escolinhasLoading || experienciasLoading) ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ExperienciaSection
            perfil={perfil}
            escolinhas={escolinhas}
            atividades={[]}
            experiencias={experiencias}
            isOwner={isOwner}
            accentColor={accentColor}
            onAddExperiencia={() => {
              setEditingExperiencia(null);
              setExperienciaFormOpen(true);
            }}
            onEditExperiencia={handleEditExperiencia}
            onDeleteExperiencia={podeExcluir ? (id) => setDeleteExpId(id) : undefined}
          />
        );
      case 'estatisticas':
        return <CarreiraStatsCards criancaId={perfil.crianca_id} accentColor={accentColor} />;
      case 'publicacoes':
        return (
          <div className="space-y-4">
            {isOwner && (
              <Suspense fallback={null}>
                <CreatePostForm perfil={perfil} accentColor={accentColor} />
              </Suspense>
            )}
            {postsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (posts?.length || 0) > 0 ? (
              <div className="space-y-4">
                {posts?.map((post) => (
                  <PostCard key={`post-${post.id}`} post={post} showAuthor={true} accentColor={accentColor} />
                ))}
              </div>
            ) : isOwner ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto opacity-40 mb-2" />
                <p className="text-sm">Nenhuma publicação ainda.</p>
                <p className="text-xs">Use o campo acima para compartilhar sua jornada!</p>
              </div>
            ) : null}
          </div>
        );
      case 'atividades':
        return atividadesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {renderNewAtividadeButton('Nova Atividade Extra', () => {
              setEditingActivity(null);
              setAtividadeFormOpen(true);
            })}
            {(atividades?.length || 0) > 0 ? (
              atividades?.map((atv) => (
                <AtividadePublicaCard key={atv.id} atividade={atv} isOwner={isOwner} accentColor={accentColor} onEdit={handleEditActivity} />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Dumbbell className="w-10 h-10 mx-auto opacity-40 mb-2" />
                <p className="text-sm">Nenhuma atividade extra registrada.</p>
              </div>
            )}
          </div>
        );
      case 'jornada':
        return jornada.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <JornadaEsportivaSection
            campeonatos={jornada.data.campeonatos}
            amistosos={jornada.data.amistosos}
            estatisticas={jornada.data.estatisticas}
            isOwner={isOwner}
            accentColor={accentColor}
            onAddCampeonato={() => { setEditingCampeonato(null); setCampeonatoFormOpen(true); }}
            onAddJogo={() => { setEditingJogo(null); setJogoFormOpen(true); }}
            onEditCampeonato={(c) => { setEditingCampeonato(c); setCampeonatoFormOpen(true); }}
            onEditJogo={(j) => { setEditingJogo(j); setJogoFormOpen(true); }}
            onDeleteCampeonato={podeExcluir ? async (id) => {
              if (!confirm('Excluir este campeonato e todos os seus jogos?')) return;
              try { await jornada.excluirCampeonato(id); toast.success('Campeonato excluído'); }
              catch (e: any) { toast.error(e.message || 'Erro ao excluir'); }
            } : undefined}
            onDeleteJogo={podeExcluir ? async (id) => {
              if (!confirm('Excluir este jogo?')) return;
              try { await jornada.excluirJogo(id); toast.success('Jogo excluído'); }
              catch (e: any) { toast.error(e.message || 'Erro ao excluir'); }
            } : undefined}
          />
        );
      case 'premiacoes':
        return (
          <SalaTrofeusAtleta
            criancaId={perfil.crianca_id}
            accentColor={accentColor}
            dadosPublicos={{
              premiacoes: dadosPublicos?.premiacoes !== false,
              campeonatos: dadosPublicos?.campeonatos !== false,
              conquistas: dadosPublicos?.conquistas !== false,
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {layout === 'perfil' ? (
        isPlatformProfile ? (
          <div className="rounded-xl border p-6 text-center" style={{ borderColor: `${accentColor}40` }}>
            <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" style={{ color: accentColor }} />
            <p className="text-sm text-muted-foreground">As novidades ficam no Feed.</p>
            <Link to={carreiraPath('/feed')} className="mt-2 inline-block text-sm font-semibold hover:underline" style={{ color: accentColor }}>
              Ir para o Feed
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[{ value: 'visao', label: 'Visão Geral', icon: Star }, ...INSTITUTIONAL_TABS].map(({ value, label, icon: Icon }, i, lista) => {
                const isActive = activeTab === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleTabClick(value)}
                    aria-pressed={isActive}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-xs font-semibold transition-all duration-200 ${value === 'visao' ? 'col-span-2 sm:col-span-3' : (lista.length - 1) % 2 === 1 && i === lista.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}
                    style={{
                      backgroundColor: isActive ? accentColor : `${accentColor}15`,
                      color: isActive ? '#fff' : accentColor,
                      borderColor: accentColor,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'visao' ? (
              <VisaoGeralAtleta
                perfil={perfil}
                experiencias={experiencias}
                accentColor={accentColor}
                isOwner={isOwner}
                onVerExperiencias={() => setActiveTab('experiencia')}
              />
            ) : activeTab ? (
              <div
                className="rounded-xl bg-card p-4 animate-in fade-in-0 slide-in-from-top-2 duration-200"
                style={{ border: `2px solid ${accentColor}50` }}
              >
                {renderTabContent()}
              </div>
            ) : null}
          </>
        )
      ) : layout === 'grid' ? (
        !isPlatformProfile && (
          activeTab ? (
            <div className="animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <button
                onClick={() => setActiveTab(null)}
                className="flex items-center gap-1 text-sm font-semibold mb-3"
                style={{ color: accentColor }}
              >
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>
              <div className="rounded-xl bg-card p-4" style={{ border: `2px solid ${accentColor}50` }}>
                {renderTabContent()}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {GRID_TABS.map(({ value, label, icon: Icon, description, color }) => {
                const cls = GRID_COLOR_CLASSES[color];
                return (
                  <button
                    key={value}
                    onClick={() => handleTabClick(value)}
                    className={`text-left rounded-2xl p-4 border transition-transform hover:scale-[1.02] ${cls.bg}`}
                    style={{ borderColor: `${accentColor}20` }}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${cls.text}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-sm text-foreground leading-tight">{label}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{description}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className={`text-sm font-bold ${cls.text}`}>
                        {gridCounts[value]}{' '}
                        <span className="font-normal text-muted-foreground">{GRID_COUNT_LABELS[value]}</span>
                      </span>
                      <ChevronRight className={`w-4 h-4 ${cls.text}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )
      ) : (
        <>
          {/* Tab buttons */}
          {!isPlatformProfile && (
          <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap gap-2 justify-center">
            {activeTabs.map(({ value, label, icon: Icon, hint }) => {
              const isActive = activeTab === value;
              return (
                <Tooltip key={value}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleTabClick(value)}
                      aria-label={hint}
                      className="flex items-center gap-1.5 text-xs font-semibold rounded-full border-2 px-4 py-2 transition-all duration-200"
                      style={{
                        backgroundColor: isActive ? accentColor : `${accentColor}15`,
                        color: isActive ? '#fff' : accentColor,
                        borderColor: accentColor,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{hint}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          </TooltipProvider>
          )}

          {/* Tab content */}
          {activeTab && (
            <div
              className="rounded-xl bg-card p-4 animate-in fade-in-0 slide-in-from-top-2 duration-200"
              style={{ border: `2px solid ${accentColor}50` }}
            >
              {renderTabContent()}
            </div>
          )}

          {/* Posts feed */}
          {isOwner && (
            <Suspense fallback={null}>
              <CreatePostForm perfil={perfil} accentColor={accentColor} />
            </Suspense>
          )}

          {postsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (posts?.length || 0) > 0 ? (
            <div className="space-y-4">
              {posts?.map((post) => (
                <PostCard key={`post-${post.id}`} post={post} showAuthor={true} accentColor={accentColor} />
              ))}
            </div>
          ) : isOwner ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto opacity-40 mb-2" />
              <p className="text-sm">Nenhuma publicação ainda.</p>
              <p className="text-xs">Use o campo acima para compartilhar sua jornada!</p>
            </div>
          ) : null}
        </>
      )}

      {/* Dialogs */}
      {isOwner && perfil.crianca_id && (
        <>
          <CarreiraAtividadeFormDialog
            open={atividadeFormOpen}
            onOpenChange={handleAtividadeFormClose}
            criancaId={perfil.crianca_id}
            childName={perfil.nome}
            editingActivity={editingActivity}
          />
          <ExperienciaFormDialog
            open={experienciaFormOpen}
            onOpenChange={handleExperienciaFormClose}
            criancaId={perfil.crianca_id}
            childName={perfil.nome}
            editingExperiencia={editingExperiencia}
          />
          <JornadaCampeonatoFormDialog
            open={campeonatoFormOpen}
            onOpenChange={(open) => { setCampeonatoFormOpen(open); if (!open) setEditingCampeonato(null); }}
            criancaId={perfil.crianca_id}
            modalidades={(perfil.modalidades && perfil.modalidades.length > 0) ? perfil.modalidades : [perfil.modalidade]}
            editingCampeonato={editingCampeonato}
            onSaved={jornada.fetchData}
          />
          <JornadaJogoFormDialog
            open={jogoFormOpen}
            onOpenChange={(open) => { setJogoFormOpen(open); if (!open) setEditingJogo(null); }}
            criancaId={perfil.crianca_id}
            campeonatos={jornada.data.campeonatos}
            modalidades={(perfil.modalidades && perfil.modalidades.length > 0) ? perfil.modalidades : [perfil.modalidade]}
            editingJogo={editingJogo}
            onSaved={jornada.fetchData}
          />
        </>
      )}

      {/* Delete experiência confirmation */}
      <AlertDialog open={!!deleteExpId} onOpenChange={(open) => !open && setDeleteExpId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover experiência?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O registro será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExperiencia}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteExperiencia.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
