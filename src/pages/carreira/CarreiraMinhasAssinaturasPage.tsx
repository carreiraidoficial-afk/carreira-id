import { Navigate } from 'react-router-dom';
import { Loader2, Users } from 'lucide-react';
import { CarreiraLayout } from '@/components/layout/CarreiraLayout';
import { AssinaturaCard } from '@/components/carreira/AssinaturaCard';
import { useCarreiraSession } from '@/hooks/useCarreiraSession';
import { useMinhasCriancas } from '@/hooks/useCriancaAtiva';

/**
 * Lista a assinatura de TODOS os filhos de um responsável lado a lado, sem
 * precisar trocar o "filho ativo" primeiro pra ver/gerenciar cada uma --
 * resolve a fricção de administrar mais de uma assinatura por família.
 */
export default function CarreiraMinhasAssinaturasPage() {
  const { sessionUserId, loading: sessionLoading } = useCarreiraSession();
  const { data: perfis, isLoading: perfisLoading } = useMinhasCriancas(sessionUserId);

  if (sessionLoading || perfisLoading) {
    return (
      <CarreiraLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </CarreiraLayout>
    );
  }

  if (!sessionUserId) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <CarreiraLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Minhas Assinaturas
          </h1>
          <p className="text-muted-foreground">
            Veja e gerencie o plano de cada atleta cadastrado, sem precisar trocar de perfil.
          </p>
        </div>

        {!perfis || perfis.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum perfil de atleta cadastrado ainda.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {perfis.map((perfil) => (
              <div key={perfil.crianca_id || perfil.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  {perfil.foto_url ? (
                    <img src={perfil.foto_url} alt={perfil.nome} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {perfil.nome?.[0]}
                    </div>
                  )}
                  <p className="font-semibold text-sm">{perfil.nome}</p>
                </div>
                {perfil.crianca_id ? (
                  <AssinaturaCard
                    userId={perfil.user_id}
                    criancaId={perfil.crianca_id}
                    accentColor={perfil.cor_destaque || '#3b82f6'}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Assinatura disponível apenas para perfis de atleta.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </CarreiraLayout>
  );
}
