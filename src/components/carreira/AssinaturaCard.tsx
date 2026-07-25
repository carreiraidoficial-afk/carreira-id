import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, QrCode, Crown, Zap, ArrowUp, ArrowDown, Loader2, CheckCircle2, XCircle, Clock, Sparkles } from 'lucide-react';
import { PLANOS, CarreiraPlano, planoNivel, normalizePlano } from '@/config/carreiraPlanos';
import { toast } from 'sonner';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { selecionarCriancaAtiva } from '@/hooks/useCriancaAtiva';

interface AssinaturaCardProps {
  userId: string;
  criancaId: string;
  accentColor?: string;
}

interface Assinatura {
  id: string;
  plano: string;
  status: string;
  metodo_pagamento: string | null;
  valor: number | null;
  inicio_em: string;
  expira_em: string | null;
  familia_id: string | null;
}

const PLANO_ICONS: Record<string, React.ReactNode> = {
  base: <Zap className="w-4 h-4" />,
  premium: <Crown className="w-4 h-4" />,
};

const METODO_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  cartao_credito: { label: 'Cartão de Crédito', icon: <CreditCard className="w-3.5 h-3.5" /> },
  pix: { label: 'PIX', icon: <QrCode className="w-3.5 h-3.5" /> },
};

export function AssinaturaCard({ userId, criancaId, accentColor = '#3b82f6' }: AssinaturaCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<{ type: 'upgrade' | 'downgrade'; target: CarreiraPlano } | null>(null);

  const { data: assinatura, isLoading } = useQuery({
    queryKey: ['minha-assinatura', userId, criancaId],
    queryFn: async (): Promise<Assinatura | null> => {
      const { data, error } = await supabase
        .from('carreira_assinaturas')
        .select('id, plano, status, metodo_pagamento, valor, inicio_em, expira_em, familia_id')
        .eq('user_id', userId)
        .eq('crianca_id', criancaId)
        .in('status', ['ativa', 'trial'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ targetPlano, isUpgrade }: { targetPlano: CarreiraPlano; isUpgrade: boolean }) => {
      const planoInfo = PLANOS[targetPlano];
      
      if (isUpgrade) {
        // Upgrade: cancel old, create new immediately
        if (assinatura) {
          await supabase
            .from('carreira_assinaturas')
            .update({ status: 'cancelada', cancelada_em: new Date().toISOString() } as any)
            .eq('id', assinatura.id);
        }
        
        if (targetPlano === 'base') return; // No subscription needed for base
        
        // Create new subscription (in real flow, this would go through payment)
        await supabase.from('carreira_assinaturas').insert({
          user_id: userId,
          crianca_id: criancaId,
          plano: targetPlano,
          status: 'ativa',
          valor: planoInfo.preco,
          metodo_pagamento: assinatura?.metodo_pagamento || 'pix',
          inicio_em: new Date().toISOString(),
        } as any);
      } else {
        // Downgrade: schedule for end of period
        // If going to base, cancel subscription; current benefits continue until expira_em
        if (assinatura) {
          const expiraEm = assinatura.expira_em || 
            new Date(new Date(assinatura.inicio_em).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
          
          if (targetPlano === 'base') {
            await supabase
              .from('carreira_assinaturas')
              .update({ 
                status: 'cancelada', 
                cancelada_em: new Date().toISOString(),
                expira_em: expiraEm,
              } as any)
              .eq('id', assinatura.id);
          } else {
            // Downgrade to competidor: mark current as ending, create pending new one
            await supabase
              .from('carreira_assinaturas')
              .update({ 
                status: 'cancelada',
                cancelada_em: new Date().toISOString(),
                expira_em: expiraEm,
              } as any)
              .eq('id', assinatura.id);
            
            await supabase.from('carreira_assinaturas').insert({
              user_id: userId,
              crianca_id: criancaId,
              plano: targetPlano,
              status: 'ativa',
              valor: planoInfo.preco,
              metodo_pagamento: assinatura.metodo_pagamento || 'pix',
              inicio_em: expiraEm,
            } as any);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minha-assinatura'] });
      queryClient.invalidateQueries({ queryKey: ['carreira-plano'] });
      setConfirmAction(null);
      toast.success(
        confirmAction?.type === 'upgrade' 
          ? 'Plano atualizado com sucesso!' 
          : 'Downgrade agendado. Você mantém os benefícios até o fim do período.'
      );
    },
    onError: () => {
      toast.error('Erro ao alterar plano');
      setConfirmAction(null);
    },
  });

  const isTrialActive = !!assinatura && assinatura.status === 'trial'
    
    && assinatura?.expira_em && new Date(assinatura.expira_em) > new Date();
  const currentPlano: CarreiraPlano = assinatura
    ? (isTrialActive ? 'premium' : (assinatura.status === 'ativa' ? normalizePlano(assinatura.plano) : 'base'))
    : 'base';
  const currentPlanoInfo = PLANOS[currentPlano];
  const metodo = assinatura?.metodo_pagamento ? METODO_LABELS[assinatura.metodo_pagamento] : null;
  const currentLevel = planoNivel(currentPlano);
  // Assinatura satélite de uma assinatura Família -- cobrança e cancelamento
  // são geridos em conjunto, não faz sentido upgrade/downgrade individual aqui.
  const souFamilia = assinatura?.status !== 'trial' && !!assinatura?.familia_id;

  // Available plan changes
  const availablePlans = (['base', 'premium'] as CarreiraPlano[]).filter(p => p !== currentPlano);

  const diasRestantesTrial = isTrialActive
    ? Math.max(0, Math.ceil((new Date(assinatura.expira_em).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  if (isLoading) {
    return (
      <Card className="p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
      <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <CreditCard className="w-3.5 h-3.5" style={{ color: accentColor }} />
        Minha Assinatura
      </h3>

      {/* Current Plan */}
      <div className="rounded-lg p-3 border" style={{ borderColor: `${currentPlanoInfo.cor}40`, backgroundColor: `${currentPlanoInfo.cor}08` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{currentPlanoInfo.icone}</span>
            <div>
              <p className="text-sm font-bold" style={{ color: currentPlanoInfo.cor }}>
                Plano {currentPlanoInfo.nome}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentPlanoInfo.preco === 0 ? 'Gratuito' : `R$ ${currentPlanoInfo.preco.toFixed(2).replace('.', ',')}/mês`}
              </p>
            </div>
          </div>
          <Badge className="text-[10px]" style={{ backgroundColor: `${currentPlanoInfo.cor}20`, color: currentPlanoInfo.cor, border: `1px solid ${currentPlanoInfo.cor}40` }}>
            {isTrialActive ? (
              <><Clock className="w-3 h-3 mr-0.5" /> Trial</>
            ) : (
              <><CheckCircle2 className="w-3 h-3 mr-0.5" /> Ativo</>
            )}
          </Badge>
        </div>

        {isTrialActive && (
          <div className="mt-2 pt-2 border-t text-xs" style={{ borderColor: `${currentPlanoInfo.cor}20`, color: currentPlanoInfo.cor }}>
            <strong>{diasRestantesTrial} {diasRestantesTrial === 1 ? 'dia restante' : 'dias restantes'}</strong> — depois, R$ 12,00/mês para continuar.
          </div>
        )}

        {/* Payment method */}
        {metodo && (
          <div className="mt-2 pt-2 border-t flex items-center gap-1.5 text-xs text-muted-foreground" style={{ borderColor: `${currentPlanoInfo.cor}20` }}>
            {metodo.icon}
            <span>Pagamento via <strong className="text-foreground">{metodo.label}</strong></span>
          </div>
        )}

        {assinatura?.inicio_em && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Desde {new Date(assinatura.inicio_em).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>

      {/* Assinatura família: cobrança/cancelamento são geridos em conjunto pra
          todos os filhos cobertos, não faz sentido upgrade/downgrade aqui */}
      {souFamilia ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-xs text-foreground font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Faz parte da assinatura Família
          </p>
          <p className="text-[10px] text-muted-foreground">
            A cobrança e o cancelamento são feitos em conjunto para todos os filhos cobertos.
          </p>
          <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={() => navigate(carreiraPath('/minhas-assinaturas'))}>
            Gerenciar assinatura família
          </Button>
        </div>
      ) : (
      <>
      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs text-foreground font-medium">
            {confirmAction.type === 'upgrade' 
              ? `⬆️ Fazer upgrade para ${PLANOS[confirmAction.target].nome}?`
              : `⬇️ Fazer downgrade para ${PLANOS[confirmAction.target].nome}?`
            }
          </p>
          <p className="text-[10px] text-muted-foreground">
            {confirmAction.type === 'upgrade'
              ? `Seu plano será atualizado imediatamente para R$ ${PLANOS[confirmAction.target].preco.toFixed(2).replace('.', ',')}/mês.`
              : confirmAction.target === 'base'
                ? 'Sua assinatura será cancelada. Você mantém os benefícios até o fim do período atual.'
                : `Seu plano será alterado para R$ ${PLANOS[confirmAction.target].preco.toFixed(2).replace('.', ',')}/mês ao fim do período atual.`
            }
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-[10px] flex-1"
              disabled={changePlanMutation.isPending}
              style={{ backgroundColor: confirmAction.type === 'upgrade' ? accentColor : undefined }}
              variant={confirmAction.type === 'downgrade' ? 'destructive' : 'default'}
              onClick={() => changePlanMutation.mutate({ 
                targetPlano: confirmAction.target, 
                isUpgrade: confirmAction.type === 'upgrade' 
              })}>
              {changePlanMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmar'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setConfirmAction(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Plan change options */}
      {!confirmAction && (
        <div className="space-y-1.5">
          {availablePlans.map(targetPlano => {
            const targetInfo = PLANOS[targetPlano];
            const targetLevel = planoNivel(targetPlano);
            const isUpgrade = targetLevel > currentLevel;

            return (
              <button
                key={targetPlano}
                className="w-full flex items-center justify-between rounded-lg border p-2.5 hover:bg-muted/50 transition-colors text-left"
                style={{ borderColor: `${targetInfo.cor}30` }}
                onClick={() => {
                  if (targetPlano === 'base' && currentPlano === 'base') return;
                  // For upgrades that need payment, redirect to planos page.
                  // Garante que /planos resolva ESTE filho (não o "ativo"
                  // globalmente), já que este card pode estar sendo mostrado
                  // numa lista com vários irmãos (ver Minhas Assinaturas).
                  if (isUpgrade && targetPlano !== 'base') {
                    selecionarCriancaAtiva(userId, criancaId);
                    navigate(carreiraPath('/planos'));
                    return;
                  }
                  setConfirmAction({ type: isUpgrade ? 'upgrade' : 'downgrade', target: targetPlano });
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{targetInfo.icone}</span>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: targetInfo.cor }}>
                      {targetInfo.nome}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {targetInfo.preco === 0 ? 'Gratuito' : `R$ ${targetInfo.preco.toFixed(2).replace('.', ',')}/mês`}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] gap-0.5" style={{ borderColor: `${targetInfo.cor}50`, color: targetInfo.cor }}>
                  {isUpgrade ? <><ArrowUp className="w-2.5 h-2.5" /> Upgrade</> : <><ArrowDown className="w-2.5 h-2.5" /> Downgrade</>}
                </Badge>
              </button>
            );
          })}

          {/* Cancel subscription button */}
          {currentPlano !== 'base' && assinatura && (
            <button
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 p-2.5 hover:bg-destructive/5 transition-colors text-left"
              onClick={() => setConfirmAction({ type: 'downgrade', target: 'base' })}
            >
              <XCircle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-xs font-medium text-destructive">Cancelar assinatura</span>
            </button>
          )}
        </div>
      )}
      </>
      )}
    </Card>
  );
}
