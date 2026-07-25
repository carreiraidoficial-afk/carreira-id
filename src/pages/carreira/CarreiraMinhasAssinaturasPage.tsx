import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Users, Sparkles, XCircle, Clock, CheckCircle2 } from 'lucide-react';
import { CarreiraLayout } from '@/components/layout/CarreiraLayout';
import { AssinaturaCard } from '@/components/carreira/AssinaturaCard';
import { CarreiraFamiliaCheckout } from '@/components/carreira/CarreiraFamiliaCheckout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCarreiraSession } from '@/hooks/useCarreiraSession';
import { useMinhasCriancas } from '@/hooks/useCriancaAtiva';
import { useAssinaturaFamilia } from '@/hooks/useCarreiraPlano';
import { PRECO_FAMILIA } from '@/config/carreiraPlanos';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Lista a assinatura de TODOS os filhos de um responsável lado a lado, sem
 * precisar trocar o "filho ativo" primeiro pra ver/gerenciar cada uma --
 * resolve a fricção de administrar mais de uma assinatura por família.
 */
export default function CarreiraMinhasAssinaturasPage() {
  const { sessionUserId, loading: sessionLoading } = useCarreiraSession();
  const { data: todosPerfis, isLoading: perfisLoading } = useMinhasCriancas(sessionUserId);
  // Colaboradores não têm acesso a assinatura/pagamento -- só perfis próprios aparecem aqui.
  const perfis = todosPerfis?.filter((p) => !p.souColaborador);
  const { data: familia, isLoading: familiaLoading } = useAssinaturaFamilia(sessionUserId);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const queryClient = useQueryClient();

  if (sessionLoading || perfisLoading || familiaLoading) {
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

  const criancaIds = (perfis || []).map((p) => p.crianca_id).filter(Boolean) as string[];
  const criancaNomes = (perfis || []).map((p) => p.nome);
  const podeOferecerFamilia = criancaIds.length >= 2 && !familia;

  const handleCancelarFamilia = async () => {
    if (!familia) return;
    if (!window.confirm('Cancelar a assinatura Família? Todos os filhos cobertos voltam pro plano Base.')) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-carreira-familia-subscription', {
        body: { familia_id: familia.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Assinatura Família cancelada.');
      queryClient.invalidateQueries({ queryKey: ['minha-assinatura-familia'] });
      queryClient.invalidateQueries({ queryKey: ['minha-assinatura'] });
      queryClient.invalidateQueries({ queryKey: ['carreira-plano'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cancelar assinatura família');
    } finally {
      setCancelling(false);
    }
  };

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

        {familia && (
          <Card className="p-4 space-y-3 border-2 border-primary/40 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-bold text-primary">Assinatura Família</p>
                  <p className="text-xs text-muted-foreground">
                    R$ {(familia.valor ?? PRECO_FAMILIA).toFixed(2).replace('.', ',')}/mês, para todos os filhos
                  </p>
                </div>
              </div>
              <Badge className="text-[10px]" style={{ backgroundColor: familia.status === 'ativa' ? '#10b98120' : '#f59e0b20', color: familia.status === 'ativa' ? '#10b981' : '#f59e0b' }}>
                {familia.status === 'ativa' ? <><CheckCircle2 className="w-3 h-3 mr-0.5" /> Ativa</> : <><Clock className="w-3 h-3 mr-0.5" /> Processando</>}
              </Badge>
            </div>
            {familia.status === 'ativa' && (
              <button
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 p-2.5 hover:bg-destructive/5 transition-colors"
                onClick={handleCancelarFamilia}
                disabled={cancelling}
              >
                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                <span className="text-xs font-medium text-destructive">Cancelar assinatura família</span>
              </button>
            )}
          </Card>
        )}

        {podeOferecerFamilia && (
          <Card className="p-4 space-y-2 border-2 border-dashed border-primary/40">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <p className="text-sm font-bold text-foreground">Economize com a Assinatura Família</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Um valor fixo de R$ {PRECO_FAMILIA.toFixed(2).replace('.', ',')}/mês libera o Premium pra todos os seus atletas cadastrados, hoje e no futuro.
            </p>
            <Button size="sm" onClick={() => setCheckoutOpen(true)}>Assinar Família</Button>
          </Card>
        )}

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

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assinatura Família</DialogTitle>
          </DialogHeader>
          <CarreiraFamiliaCheckout
            criancaIds={criancaIds}
            criancaNomes={criancaNomes}
            onClose={() => setCheckoutOpen(false)}
            onSubscribed={() => setCheckoutOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </CarreiraLayout>
  );
}
