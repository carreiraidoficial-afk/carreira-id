import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { cn } from '@/lib/utils';

interface CarreiraThemeToggleProps {
  isDarkTheme: boolean;
  onCheckedChange: (isDarkTheme: boolean) => void;
  className?: string;
  compact?: boolean;
}

export function CarreiraThemeToggle({
  isDarkTheme,
  onCheckedChange,
  className,
  compact = false,
}: CarreiraThemeToggleProps) {
  // Versão compacta: botão só com o ícone (sol/lua), cabe em qualquer cabeçalho, inclusive no celular.
  if (compact) {
    return <CarreiraThemeIconButton isDarkTheme={isDarkTheme} onToggle={() => onCheckedChange(!isDarkTheme)} className={className} />;
  }
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Sun className="h-4 w-4 text-muted-foreground" />
      <Switch
        checked={isDarkTheme}
        onCheckedChange={onCheckedChange}
        aria-label="Alternar tema da Carreira"
      />
      <Moon className="h-4 w-4 text-muted-foreground" />
      {!compact && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {isDarkTheme ? 'Fundo escuro' : 'Fundo claro'}
        </span>
      )}
    </div>
  );
}

function CarreiraThemeIconButton({ isDarkTheme, onToggle, className }: { isDarkTheme: boolean; onToggle: () => void; className?: string }) {
  const rotulo = isDarkTheme ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';
  return (
    <Button type="button" variant="ghost" size="icon" className={cn('h-9 w-9 shrink-0 rounded-full text-foreground', className)} onClick={onToggle} aria-label={rotulo} title={rotulo}>
      {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

/** Botão sol/lua pronto para colocar em qualquer cabeçalho (lê e grava o tema sozinho). */
export function CarreiraThemeButton({ className }: { className?: string }) {
  const { isDarkTheme, setDarkTheme } = useCarreiraTheme();
  return <CarreiraThemeIconButton isDarkTheme={isDarkTheme} onToggle={() => setDarkTheme(!isDarkTheme)} className={className} />;
}
