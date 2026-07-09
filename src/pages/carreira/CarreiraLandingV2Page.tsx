import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarreiraLandingV2 } from '@/components/carreira/CarreiraLandingV2';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useAuth } from '@/contexts/AuthContext';

export default function CarreiraLandingV2Page() {
  const navigate = useNavigate();
  // Reaproveita a sessão global (evita 2º getSession() com timeout próprio).
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && session?.user) {
      navigate(carreiraPath('/feed'), { replace: true });
    }
  }, [isLoading, session, navigate]);

  if (isLoading || session?.user) return null;
  return <CarreiraLandingV2 />;
}
