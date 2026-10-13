import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CarreiraLogo } from '@/components/carreira/CarreiraLogo';
import { CarreiraThemeButton } from '@/components/carreira/CarreiraThemeToggle';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { cn } from '@/lib/utils';

interface CarreiraPageHeaderProps {
  /** Título da tela. No celular fica numa segunda linha (a primeira é só logo e ações, para nunca estourar). */
  title?: string;
  /** Mostra a seta de voltar. Passe uma função ou um caminho. */
  onBack?: () => void;
  /** Botões da direita (antes do tema). Em telas estreitas, prefira só ícones. */
  actions?: ReactNode;
  /** Cor de destaque (borda inferior), usada na Liga. */
  accentColor?: string;
  /** Fundo preto sólido no tema escuro (estilo da Liga). */
  solidDark?: boolean;
  isDarkTheme?: boolean;
  maxWidth?: string;
  /** 'black': faixa preta fixa nos dois temas (a logo tem fundo preto próprio e fica perfeita aqui). */
  tone?: 'auto' | 'black';
  /** false: o cabeçalho rola junto com a página (use quando tem conteúdo extra embaixo, como números). */
  sticky?: boolean;
  /** Conteúdo extra dentro da faixa, abaixo do título. */
  children?: ReactNode;
}

/**
 * Cabeçalho padrão das telas internas do Carreira ID: [voltar] [logo] ......... [ações] [tema].
 * A logo e o botão de tema são sempre os mesmos; só o título e as ações mudam.
 */
export function CarreiraPageHeader({ title, onBack, actions, accentColor, solidDark, isDarkTheme, maxWidth = 'max-w-2xl', tone = 'black', sticky = true, children }: CarreiraPageHeaderProps) {
  const preto = tone === 'black';
  return (
    <header
      data-theme={preto ? 'dark-orange' : undefined}
      className={cn(
        sticky && 'sticky top-0 lg:top-14 z-50',
        'border-b border-border',
        preto ? 'bg-black text-foreground' : solidDark && isDarkTheme ? 'bg-[hsl(0_0%_0%/0.97)]' : 'bg-background/95 backdrop-blur',
      )}
      style={accentColor ? { borderBottom: `2px solid ${accentColor}50` } : undefined}
    >
      <div className={cn('container flex h-14 items-center gap-2 px-3 sm:px-4', maxWidth)}>
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Voltar" className={cn('-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', preto ? 'text-white hover:bg-white/15' : 'text-foreground hover:bg-muted/60')}>
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <Link to={carreiraPath('/feed')} className="shrink-0" aria-label="Ir para o feed">
          <CarreiraLogo />
        </Link>
        {title && <h1 className={cn('ml-2 hidden min-w-0 truncate border-l pl-3 text-base font-semibold sm:block', preto ? 'border-white/20 text-white' : 'border-border text-foreground')}>{title}</h1>}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {actions}
          <CarreiraThemeButton className={preto ? 'text-white hover:bg-white/15 hover:text-white' : undefined} />
        </div>
      </div>
      {title && (
        <div className={cn('container px-4 pb-2 sm:hidden', maxWidth)}>
          <h1 className={cn('truncate text-base font-semibold', preto ? 'text-white' : 'text-foreground')}>{title}</h1>
        </div>
      )}
      {children && <div className={cn('container px-4 pb-3', maxWidth)}>{children}</div>}
    </header>
  );
}
