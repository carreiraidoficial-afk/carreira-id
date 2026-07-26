import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Zap, Share2, Gift } from 'lucide-react';
import { LevelIcon } from './LevelIcon';
import { useGamificacao, getLevelProgress, getLevelTitle, getLevelIcon, getLevelColor, getNextLevelXp } from '@/hooks/useGamificacaoData';
import { useCriancaAtiva } from '@/hooks/useCriancaAtiva';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { ComoJogarButton } from './ComoJogarButton';

interface GamificacaoHeroCardProps {
  accentColor?: string;
}

// Reliable clipboard fallback for iframe/preview contexts
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: textarea method
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }
}

export function GamificacaoHeroCard({ accentColor: propAccentColor }: GamificacaoHeroCardProps) {
  const { gamificacao, niveis, isLoading, userId } = useGamificacao();
  const [copied, setCopied] = useState(false);
  // Um responsável pode ter mais de um atleta cadastrado (irmãos) -- usa a
  // criança ativa do seletor em vez de .maybeSingle() puro em perfil_atleta,
  // que erroraria com 2+ perfis pro mesmo user_id.
  const { perfilAtivo } = useCriancaAtiva(userId);

  const { data: perfil } = useQuery({
    queryKey: ['gamificacao-perfil', userId, perfilAtivo?.crianca_id],
    queryFn: async () => {
      if (!userId) return null;
      const pa = perfilAtivo ? { id: perfilAtivo.id, cor_destaque: perfilAtivo.cor_destaque, slug: perfilAtivo.slug } : null;
      const { data: pr } = await supabase
        .from('perfis_rede')
        .select('convite_codigo, slug')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Um responsável pode ter mais de um perfil_atleta (irmãos) -- o
      // código de convite é da CONTA, não de um filho específico, então
      // procura em qualquer um deles antes de gerar um novo.
      const { data: paComCodigo } = await supabase
        .from('perfil_atleta')
        .select('convite_codigo')
        .eq('user_id', userId)
        .not('convite_codigo', 'is', null)
        .limit(1)
        .maybeSingle();

      let conviteCodigo = pr?.convite_codigo || paComCodigo?.convite_codigo || null;

      // If no convite_codigo exists, generate one and PERSIST it
      if (!conviteCodigo) {
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        if (pr) {
          // User has perfis_rede — update it
          await supabase
            .from('perfis_rede')
            .update({ convite_codigo: newCode } as any)
            .eq('user_id', userId);
        } else if (pa) {
          // User só tem perfil_atleta -- grava o código nele mesmo, sem
          // criar um perfil "pai_responsavel" fantasma só pra guardar uma
          // string (isso já causou perfis fantasma reais em produção).
          await supabase
            .from('perfil_atleta')
            .update({ convite_codigo: newCode } as any)
            .eq('id', pa.id);
        }
        conviteCodigo = newCode;
      }

      return {
        cor_destaque: pa?.cor_destaque || '#3b82f6',
        convite_codigo: conviteCodigo,
        slug: pa?.slug || pr?.slug || null,
      };
    },
    enabled: !!userId,
  });

  if (isLoading || !userId) return null;

  // Compute display level from niveis table (source of truth) rather than DB-stored nivel
  const computedNivel = niveis.length > 0
    ? (() => {
        let lvl = 1;
        for (const n of [...niveis].sort((a, b) => a.nivel - b.nivel)) {
          if (gamificacao.xp_atual >= n.xp_minimo) lvl = n.nivel;
        }
        return lvl;
      })()
    : gamificacao.nivel;

  const accentColor = propAccentColor || perfil?.cor_destaque || '#3b82f6';
  const levelTitle = getLevelTitle(computedNivel, niveis);
  const levelIcon = getLevelIcon(computedNivel, niveis);
  const levelColor = getLevelColor(computedNivel, niveis);
  const progress = getLevelProgress(gamificacao.xp_atual, computedNivel, niveis);
  const xpNext = getNextLevelXp(computedNivel, niveis);

  const inviteLink = perfil?.convite_codigo
    ? `${window.location.origin}${carreiraPath('/cadastro')}?convite=${perfil.convite_codigo}`
    : null;

  const handleCopyInvite = async () => {
    if (!inviteLink) {
      toast.error('Link de convite não encontrado. Verifique seu perfil.');
      return;
    }
    try {
      // Try native share first (mobile)
      if (navigator.share) {
        await navigator.share({
          title: 'Junte-se ao Carreira ID!',
          text: 'Crie seu perfil esportivo e conecte-se com a comunidade!',
          url: inviteLink,
        });
        return;
      }
    } catch {
      // Share cancelled or failed — fall through to copy
    }
    
    const success = await copyToClipboard(inviteLink);
    if (success) {
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Não foi possível copiar o link');
    }
  };

  return (
    <Card
      className="overflow-hidden relative"
      style={{
        borderColor: `${accentColor}50`,
        borderWidth: 2,
        backgroundColor: 'hsl(0 0% 4%)',
      }}
    >
      {/* Top accent bar — same 2px as page borders */}
      <div
        className="h-[2px]"
        style={{ backgroundColor: accentColor }}
      />

      <CardContent className="pt-3 pb-3 px-3">
        {/* Level display */}
        <div className="flex items-center gap-3 mb-3">
          {/* Level avatar */}
          <div className="relative shrink-0">
            {(() => {
              const isImage = levelIcon.startsWith('http') || levelIcon.startsWith('blob:') || levelIcon.startsWith('/');
              return (
                <div
                  className="flex items-center justify-center w-14 h-14 rounded-2xl text-[24px] shadow-lg overflow-hidden"
                  style={isImage ? {
                    boxShadow: `0 0 16px ${levelColor}30, 0 4px 10px rgba(0,0,0,0.3)`,
                  } : {
                    background: `linear-gradient(145deg, ${levelColor}, ${levelColor}cc)`,
                    boxShadow: `0 0 16px ${levelColor}30, 0 4px 10px rgba(0,0,0,0.3)`,
                  }}
                >
                  <LevelIcon icone={levelIcon} size={56} fill />
                </div>
              );
            })()}
            <div
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ backgroundColor: levelColor, borderWidth: 2, borderColor: 'hsl(0 0% 4%)' }}
            >
              {gamificacao.nivel}
            </div>
          </div>

          {/* Level info */}
          <div className="flex-1 min-w-0">
            <p className="text-foreground font-bold text-sm leading-tight truncate">{levelTitle}</p>
            <p className="text-[11px] mt-0.5" style={{ color: accentColor }}>
              Nível {computedNivel}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Zap className="w-3 h-3 shrink-0" style={{ color: levelColor }} />
              <span className="text-muted-foreground text-[10px]">
                {gamificacao.xp_atual.toLocaleString()} / {xpNext.toLocaleString()} XP
              </span>
            </div>
          </div>

          {/* Points */}
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1" style={{ color: accentColor }}>
              <Zap className="w-3.5 h-3.5" />
              <span className="font-bold text-base">{gamificacao.pontos_total.toLocaleString()}</span>
            </div>
            <p className="text-muted-foreground text-[9px] mt-0.5">pontos</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mb-2">
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${accentColor}15` }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${accentColor}99, ${accentColor})`,
                boxShadow: `0 0 8px ${accentColor}50`,
              }}
            />
          </div>
        </div>

        {/* Level progression icons */}
        {niveis.length > 0 && (
          <div className="flex items-center justify-between px-0.5 mb-3">
            {niveis.slice(0, 10).map((n) => {
              const isActive = computedNivel >= n.nivel;
              const isCurrent = computedNivel === n.nivel;
              return (
                <div
                  key={n.nivel}
                  className="flex flex-col items-center gap-0.5 transition-all duration-300"
                  title={`${n.nome} - ${n.xp_minimo} XP`}
                >
                  <div
                    style={{
                      opacity: isActive ? 1 : 0.25,
                      filter: isActive ? 'none' : 'grayscale(1)',
                      transform: isCurrent ? 'scale(1.3)' : 'scale(1)',
                    }}
                  >
                    <LevelIcon icone={n.icone} size={isCurrent ? 16 : 12} />
                  </div>
                  {isCurrent && (
                    <div
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: levelColor }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-1 mb-3">
          {[
            { value: gamificacao.convites_confirmados, label: 'Convites' },
            { value: gamificacao.posts_criados, label: 'Posts' },
            { value: gamificacao.conexoes_feitas, label: 'Conexões' },
            { value: gamificacao.atividades_registradas, label: 'Atividades' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center py-1 rounded-lg"
              style={{ backgroundColor: `${accentColor}08`, border: `1px solid ${accentColor}15` }}
            >
              <div className="text-foreground font-bold text-[11px]">{stat.value}</div>
              <div className="text-muted-foreground text-[8px] leading-tight">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Invite CTA button */}
        <Button
          onClick={handleCopyInvite}
          className="w-full h-9 text-[11px] font-bold rounded-xl gap-1.5 border-0 text-white"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
            boxShadow: `0 4px 12px ${accentColor}25`,
          }}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Link Copiado!
            </>
          ) : (
            <>
              <Gift className="w-3.5 h-3.5" />
              Convidar e Ganhar XP
              <Share2 className="w-3 h-3 ml-0.5 opacity-70" />
            </>
          )}
        </Button>

        {/* Como Jogar button */}
        <ComoJogarButton variant="card" accentColor={accentColor} />
      </CardContent>
    </Card>
  );
}
