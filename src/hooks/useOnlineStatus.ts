import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';

/** Reflete o onlineManager do React Query (navigator.onLine + eventos online/offline). */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(onlineManager.isOnline());

  useEffect(() => {
    return onlineManager.subscribe(setIsOnline);
  }, []);

  return isOnline;
}
