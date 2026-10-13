import logoHeader from '@/assets/logo-carreira-id-header.png';
import { cn } from '@/lib/utils';

/**
 * Logo do Carreira ID para cabeçalhos e rodapés. O arquivo já é recortado no tamanho real da logo
 * (o antigo logo-carreira-id-dark.png é um quadrado de 500x500 com a logo pequena no meio, e por isso
 * cada tela precisava de um tamanho diferente). Use sempre este componente, sem mudar a altura.
 */
export function CarreiraLogo({ className }: { className?: string }) {
  return <img src={logoHeader} alt="Carreira ID" className={cn('h-9 w-auto shrink-0', className)} />;
}
