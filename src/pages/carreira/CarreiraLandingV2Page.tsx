import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarreiraLandingV2 } from '@/components/carreira/CarreiraLandingV2';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useAuth } from '@/contexts/AuthContext';
import { useSEO } from '@/hooks/useSEO';

export default function CarreiraLandingV2Page() {
  const navigate = useNavigate();
  // Reaproveita a sessão global (evita 2º getSession() com timeout próprio).
  const { session, isLoading } = useAuth();

  useSEO({
    title: 'CARREIRA ID - Rede Social do Futebol de Base | Perfil do Atleta',
    description: 'A rede social da carreira esportiva no futebol de base. Crie o perfil do atleta, registre clubes, campeonatos e conquistas, e construa um histórico verificável desde a categoria de base até o profissional.',
    path: '/',
    jsonLd: {
      '@type': 'Organization',
      name: 'CARREIRA ID',
      url: 'https://carreiraid.com.br',
      logo: 'https://carreiraid.com.br/carreira-icon-512.png',
      description: 'Rede social e plataforma de identidade esportiva digital para atletas do futebol de base.',
    },
  });

  useEffect(() => {
    if (!isLoading && session?.user) {
      navigate(carreiraPath('/feed'), { replace: true });
    }
  }, [isLoading, session, navigate]);

  if (isLoading || session?.user) return null;
  return <CarreiraLandingV2 />;
}
