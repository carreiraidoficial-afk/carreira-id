import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const CarreiraLandingV2Page = lazy(() => import('./carreira/CarreiraLandingV2Page'));

/** Fallback máximo antes de assumir "não autenticado" se o AuthContext demorar. */
const AUTH_TIMEOUT_MS = 3000;

export default function RootRoute() {
  // Reaproveita a resolução de sessão global feita pelo AuthProvider
  // (antes cada rota chamava seu próprio getSession, somando timeouts de 5s).
  const { session, isLoading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => setTimedOut(true), AUTH_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [isLoading]);

  if (isLoading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-theme="dark-orange">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session?.user) {
    return <Navigate to="/feed" replace />;
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background" data-theme="dark-orange">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <CarreiraLandingV2Page />
    </Suspense>
  );
}
