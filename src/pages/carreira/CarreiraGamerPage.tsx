import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GamificacaoHeroCard } from '@/components/carreira/GamificacaoHeroCard';
import { ComoJogarButton } from '@/components/carreira/ComoJogarButton';
import { TutorialAutoShow } from '@/components/carreira/TutorialAutoShow';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';
import { CarreiraThemeToggle } from '@/components/carreira/CarreiraThemeToggle';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, User, Zap, TableProperties, ChevronRight, Loader2 } from 'lucide-react';
import logoCarreira from '@/assets/logo-carreira-id-dark.png';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNiveisConfig, getLevelTitle, getLevelColor } from '@/hooks/useGamificacaoData';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { useCarreiraRanking } from '@/hooks/useCarreiraRanking';
import { useCarreiraSession } from '@/hooks/useCarreiraSession';
import { useCarreiraPlano } from '@/hooks/useCarreiraPlano';
import { FeatureGate } from '@/components/carreira/FeatureGate';
import { useCriancaAtiva, slugDoDono } from '@/hooks/useCriancaAtiva';

export default function CarreiraGamerPage() {
  const { sessionUserId: currentUserId, loading: sessionLoading } = useCarreiraSession();
  const navigate = useNavigate();
  const { theme: carreiraTheme, isDarkTheme, setDarkTheme } = useCarreiraTheme();

  // Um responsável pode ter mais de um atleta cadastrado (irmãos) -- usa a
  // criança "ativa" do seletor em vez de sempre pegar a mais antiga.
  const { perfilAtivo } = useCriancaAtiva(currentUserId);
  const meuSlugProprio = slugDoDono(perfilAtivo);
  const { data: perfilRede } = useQuery({
    queryKey: ['liga-page-perfil-rede', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return null;
      const { data } = await supabase.from('perfis_rede').select('slug').eq('user_id', currentUserId).order('created_at', { ascending: true }).limit(1).maybeSingle();
      return data;
    },
    // Busca o perfil de rede sempre que o ativo não for um perfil PRÓPRIO
    // (inclui o caso de colaborador: perfilAtivo existe mas é de outro
    // atleta, então "Meu Perfil" precisa cair pro perfil de rede da pessoa).
    enabled: !!currentUserId && !meuSlugProprio,
  });

  const accentColor = perfilAtivo?.cor_destaque || '#3b82f6';
  const mySlug = meuSlugProprio || perfilRede?.slug || null;
  const { data: ranking } = useCarreiraRanking();
  const { plano, temAcesso } = useCarreiraPlano(perfilAtivo?.crianca_id || null);
  const { data: niveis } = useNiveisConfig();

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-theme={carreiraTheme}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUserId) {
    return <Navigate to={carreiraPath('/cadastro')} replace />;
  }

  const MEDAL_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];

  return (
    <div className="min-h-screen bg-background" data-theme={carreiraTheme}>
      <div className="h-[2px] w-full" style={{ backgroundColor: accentColor }} />
      <header
        className={`sticky top-0 z-50 ${isDarkTheme ? 'bg-[hsl(0_0%_0%/0.97)]' : 'bg-background/95 backdrop-blur-sm'}`}
        style={{ borderBottom: `2px solid ${accentColor}50` }}
      >
        <div className="container flex items-center h-14 px-4 max-w-2xl">
          <Link to={carreiraPath('/feed')} className="flex items-center gap-2 shrink-0">
            <img src={logoCarreira} alt="Carreira" className="h-16 lg:h-20" />
          </Link>
          <h1 className="ml-4 text-lg font-semibold text-foreground">Liga</h1>
          <div className="ml-auto flex items-center gap-2">
            <ComoJogarButton variant="inline" accentColor={accentColor} />
            <CarreiraThemeToggle
              isDarkTheme={isDarkTheme}
              onCheckedChange={setDarkTheme}
              compact
            />
          </div>
        </div>
      </header>

      <main className="container max-w-2xl px-4 py-6 pb-24 space-y-4">
        <TutorialAutoShow tipoPerfil="atleta_filho" />
        <GamificacaoHeroCard accentColor={accentColor} />

        <FeatureGate
          planoAtual={plano}
          planoRequerido="premium"
          liberado={temAcesso('liga_conexoes')}
          mensagem="Participação na Liga de Conexões é um recurso Premium"
        >
          {/* Link para Tabela de Pontos */}
          <button
            onClick={() => navigate(carreiraPath('/liga/pontos'))}
            className="w-full"
          >
            <Card
              className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer"
              style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}
            >
              <div className="flex items-center gap-2">
                <TableProperties className="w-5 h-5" style={{ color: accentColor }} />
                <span className="text-sm font-semibold text-foreground">Tabela de Pontos</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Card>
          </button>

          {/* Ranking */}
          {ranking && ranking.length > 0 && (
            <Card className="p-3 mt-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Trophy className="w-4 h-4" style={{ color: accentColor }} />
                Ranking
              </h3>
              <ScrollArea className="max-h-[420px]">
                <div className="space-y-1 pr-1">
                  {ranking.map((player) => {
                    const isMe = player.user_id === currentUserId;
                    const medalColor = player.position <= 3 ? MEDAL_COLORS[player.position - 1] : undefined;
                    const levelTitle = getLevelTitle(player.nivel, niveis || []);
                    const levelColor = getLevelColor(player.nivel, niveis || []);
                    return (
                      <div
                        key={player.user_id}
                        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors cursor-pointer ${isMe ? 'ring-1' : 'hover:bg-muted/50'}`}
                        style={isMe ? { backgroundColor: `${accentColor}10`, outline: `1px solid ${accentColor}` } : undefined}
                        onClick={() => player.slug && navigate(carreiraPath(`/${player.slug}`))}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={medalColor
                            ? { backgroundColor: medalColor, color: '#000' }
                            : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }
                          }
                        >
                          {player.position}
                        </div>

                        <Avatar className="w-7 h-7 shrink-0">
                          {player.foto_url ? <AvatarImage src={player.foto_url} className="object-cover" /> : null}
                          <AvatarFallback className="text-[9px]"><User className="w-3 h-3" /></AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium truncate leading-tight">
                            {player.nome}
                            {isMe && <span className="text-[9px] text-muted-foreground ml-1">(você)</span>}
                          </p>
                          <p className="text-[9px] font-medium leading-tight" style={{ color: levelColor }}>
                            {levelTitle}
                          </p>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0" style={{ color: accentColor }}>
                          <Zap className="w-3 h-3" />
                          <span className="text-[11px] font-bold">{player.pontos.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>
          )}
        </FeatureGate>
      </main>

      <CarreiraBottomNav currentUserId={currentUserId} profileSlug={mySlug} />
    </div>
  );
}
