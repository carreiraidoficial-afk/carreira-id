import { ReactNode } from 'react';
import { Lock, Crown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CarreiraPlano, PLANOS, temAcessoAoPlano } from '@/config/carreiraPlanos';
import { useNavigate } from 'react-router-dom';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';

interface FeatureGateProps {
  /** The user's current plan */
  planoAtual: CarreiraPlano;
  /** Minimum plan required to access this feature */
  planoRequerido: CarreiraPlano;
  /** Content to render when unlocked */
  children: ReactNode;
  /** Optional: custom message */
  mensagem?: string;
  /** Show as inline badge instead of overlay (for small elements) */
  inline?: boolean;
  /** If true, completely hides content instead of showing blurred */
  hideContent?: boolean;
  /**
   * Optional explicit access override — when provided, this decides access
   * instead of the plan-tier comparison. Use with `temAcesso('feature')` from
   * useCarreiraPlano() to gate by the admin-configurable feature flag rather
   * than by plan tier alone.
   */
  liberado?: boolean;
}

export function FeatureGate({
  planoAtual,
  planoRequerido,
  children,
  mensagem,
  inline = false,
  hideContent = false,
  liberado,
}: FeatureGateProps) {
  const navigate = useNavigate();
  const temAcesso = liberado ?? temAcessoAoPlano(planoAtual, planoRequerido);

  if (temAcesso) return <>{children}</>;

  const planoInfo = PLANOS[planoRequerido];
  const isPremium = planoRequerido === 'premium';

  const handleUpgrade = () => {
    navigate(carreiraPath('/planos'));
  };

  if (inline) {
    return (
      <button
        onClick={handleUpgrade}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors bg-muted/80 text-muted-foreground hover:bg-primary/10 hover:text-primary"
      >
        {isPremium ? <Crown className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
        {planoInfo.nome}
      </button>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Blurred/dimmed content */}
      {!hideContent && (
        <div className="pointer-events-none select-none opacity-30 blur-[2px]">
          {children}
        </div>
      )}

      {/* Overlay */}
      <div className={`${hideContent ? '' : 'absolute inset-0'} flex flex-col items-center justify-center gap-3 p-4 bg-background/60 backdrop-blur-sm rounded-xl border border-dashed border-muted-foreground/20`}>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${planoInfo.cor}15` }}
        >
          <Lock className="w-5 h-5" style={{ color: planoInfo.cor }} />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold">
            {mensagem || `Disponível no plano ${planoInfo.nome}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {planoInfo.preco > 0
              ? `A partir de R$ ${planoInfo.preco.toFixed(2).replace('.', ',')}/mês`
              : 'Faça upgrade para desbloquear'}
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleUpgrade}
          className="gap-1.5"
          style={{ backgroundColor: planoInfo.cor }}
        >
          {isPremium ? <Crown className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
          Ver planos
        </Button>
      </div>
    </div>
  );
}

/** Small inline badge to indicate a feature requires a higher plan */
export function PlanBadge({ plano }: { plano: CarreiraPlano }) {
  const info = PLANOS[plano];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: `${info.cor}15`, color: info.cor }}
    >
      {plano === 'premium' ? <Crown className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
      {info.nome}
    </span>
  );
}
