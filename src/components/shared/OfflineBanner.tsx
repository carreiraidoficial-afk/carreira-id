import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/** Barra fixa avisando que os dados na tela podem estar desatualizados. */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-amber-600 text-white text-xs sm:text-sm py-1.5 px-3 flex items-center justify-center gap-2 shadow-md">
      <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Você está offline — mostrando os últimos dados salvos.</span>
    </div>
  );
}
