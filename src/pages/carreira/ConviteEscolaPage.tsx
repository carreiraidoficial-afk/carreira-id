import { Navigate, useLocation, useParams } from 'react-router-dom';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';

/**
 * Link curto de convite com o nome da escola: /convite/nome-da-escola (alunos) e /convite/nome-da-escola/professor.
 * Leva ao mesmo cadastro dos links longos (?ref=atleta&escola=... e ?ref=equipe&escola=...), mantendo o resto da
 * URL (unidade, campanha). O slug da escola é público, então o link não expõe nenhum código.
 */
export default function ConviteEscolaPage({ professor = false }: { professor?: boolean }) {
  const { slug = '' } = useParams();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('ref', professor ? 'equipe' : 'atleta');
  params.set('escola', slug);
  return <Navigate to={`${carreiraPath('/cadastro')}?${params.toString()}`} replace />;
}
