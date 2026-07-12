import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Star, Zap, Trophy, Copy, CheckCircle, Loader2, CreditCard, QrCode, Crown } from 'lucide-react';
import { CarreiraLimitResult } from '@/hooks/useCarreiraFreemium';
import { PLANOS, CarreiraPlano, normalizePlano } from '@/config/carreiraPlanos';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface CarreiraPaywallProps {
  limitResult: CarreiraLimitResult;
  childName?: string;
  criancaId?: string;
  planoSelecionado?: string;
  onClose?: () => void;
  onSubscribed?: () => void;
}

type PaywallStep = 'info' | 'loading' | 'pix' | 'checking' | 'success';
type PaymentMethod = 'pix' | 'cartao';

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export function CarreiraPaywall({ limitResult, childName, criancaId, planoSelecionado, onClose, onSubscribed }: CarreiraPaywallProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<PaywallStep>('info');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cartao');
  const [cpfInput, setCpfInput] = useState('');
  const [selectedPlan] = useState<CarreiraPlano>(
    planoSelecionado ? normalizePlano(planoSelecionado) : 'premium'
  );
  const [pixData, setPixData] = useState<{
    paymentId: string;
    subscriptionId: string;
    brCode: string;
    qrCodeImage: string;
    expiresAt: string;
    valor: number;
  } | null>(null);
  const [checkoutData, setCheckoutData] = useState<{
    paymentId: string;
    subscriptionId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const cpfDigits = cpfInput.replace(/\D/g, '');
  const cpfValid = cpfDigits.length === 11;
  const planInfo = PLANOS[selectedPlan];
  const isPremium = selectedPlan === 'premium';

  const generatePix = async () => {
    const cleanCpf = cpfInput.replace(/\D/g, '');
    
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData.session?.user;
    const resolvedUser = user || (sessionUser ? { id: sessionUser.id, name: sessionUser.user_metadata?.nome || sessionUser.user_metadata?.full_name || 'Usuário', email: sessionUser.email || '' } : null);
    
    if (!resolvedUser || !criancaId || cleanCpf.length !== 11) {
      toast.error(!criancaId ? 'Atleta não identificado' : !resolvedUser ? 'Sessão expirada. Faça login novamente.' : 'Informe um CPF válido para gerar o pagamento');
      return;
    }

    setStep('loading');

    try {
      const { data, error } = await supabase.functions.invoke('generate-carreira-pix', {
        body: {
          user_id: resolvedUser.id,
          crianca_id: criancaId,
          cpf: cleanCpf,
          nome: resolvedUser.name,
          email: resolvedUser.email,
          plano: selectedPlan,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPixData(data.data);
      setStep('pix');
    } catch (err: any) {
      console.error('Erro ao gerar PIX:', err);
      toast.error(err.message || 'Erro ao gerar pagamento PIX');
      setStep('info');
    }
  };

  const generateCheckout = async () => {
    const cleanCpf = cpfInput.replace(/\D/g, '');
    
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData.session?.user;
    const resolvedUser = user || (sessionUser ? { id: sessionUser.id, name: sessionUser.user_metadata?.nome || sessionUser.user_metadata?.full_name || 'Usuário', email: sessionUser.email || '' } : null);
    
    if (!resolvedUser || !criancaId || cleanCpf.length !== 11) {
      toast.error(!criancaId ? 'Atleta não identificado' : !resolvedUser ? 'Sessão expirada. Faça login novamente.' : 'Informe um CPF válido');
      return;
    }

    setStep('loading');

    try {
      const { data, error } = await supabase.functions.invoke('create-carreira-checkout', {
        body: {
          user_id: resolvedUser.id,
          crianca_id: criancaId,
          cpf: cleanCpf,
          nome: resolvedUser.name,
          email: resolvedUser.email,
          callback_url: window.location.href,
          plano: selectedPlan,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const checkoutUrl = data.data?.checkoutUrl;
      const paymentId = data.data?.paymentId;
      if (checkoutUrl && paymentId) {
        window.open(checkoutUrl, '_blank');
        // Store checkout data and start polling
        setCheckoutData({ paymentId, subscriptionId: '' });
        setStep('checking');
      } else {
        throw new Error('URL de checkout não gerada');
      }
    } catch (err: any) {
      console.error('Erro ao gerar checkout:', err);
      toast.error(err.message || 'Erro ao gerar checkout');
      setStep('info');
    }
  };

  const handleSubscribe = () => {
    if (paymentMethod === 'pix') {
      generatePix();
    } else {
      generateCheckout();
    }
  };

  const checkPayment = useCallback(async (overridePaymentId?: string) => {
    const paymentId = overridePaymentId || pixData?.paymentId || checkoutData?.paymentId;
    if (!paymentId) return false;

    try {
      const { data, error } = await supabase.functions.invoke('check-carreira-payment', {
        body: {
          payment_id: paymentId,
          subscription_id: pixData?.subscriptionId || '',
        },
      });

      if (error) throw error;

      if (data?.data?.isPaid) {
        setStep('success');
        toast.success('Pagamento confirmado! Assinatura ativada.');
        // Invalidate plano and limit caches so badges and features update instantly
        queryClient.invalidateQueries({ queryKey: ['carreira-plano'] });
        queryClient.invalidateQueries({ queryKey: ['carreira-atividade-limit'] });
        onSubscribed?.();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao verificar pagamento:', err);
      return false;
    }
  }, [pixData, checkoutData, onSubscribed]);

  // Poll for PIX payment
  useEffect(() => {
    if (step !== 'pix' || !pixData) return;

    const interval = setInterval(async () => {
      setPollCount(prev => prev + 1);
      const paid = await checkPayment();
      if (paid) clearInterval(interval);
    }, 5000);

    return () => clearInterval(interval);
  }, [step, pixData, checkPayment]);

  // Poll for checkout (card) payment
  useEffect(() => {
    if (step !== 'checking' || !checkoutData) return;

    const interval = setInterval(async () => {
      setPollCount(prev => prev + 1);
      const paid = await checkPayment();
      if (paid) clearInterval(interval);
    }, 5000);

    // Stop polling after 10 minutes
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (step === 'checking') {
        toast.info('Tempo de verificação expirado. Use o botão para verificar manualmente.');
      }
    }, 10 * 60_000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [step, checkoutData, checkPayment]);

  const copyBrCode = () => {
    if (!pixData?.brCode) return;
    navigator.clipboard.writeText(pixData.brCode);
    setCopied(true);
    toast.success('Código PIX copiado!');
    setTimeout(() => setCopied(false), 3000);
  };

  if (step === 'success') {
    return (
      <div className="space-y-4 py-2 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Pagamento confirmado! 🎉</h3>
        <p className="text-sm text-muted-foreground">
          Obrigado pela confiança! O plano <strong className="text-foreground">{planInfo.nome}</strong> já está ativo{childName && <> para <strong className="text-foreground">{childName}</strong></>}.
        </p>
        <p className="text-xs text-muted-foreground">
          Todas as funcionalidades do plano já estão disponíveis.
        </p>
        {paymentMethod === 'pix' && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            💡 Em <strong>30 dias</strong> será gerado um novo PIX para renovação. Fique atento ao seu e-mail!
          </p>
        )}
        {paymentMethod === 'cartao' && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            💳 Sua assinatura é <strong>recorrente</strong>. A cobrança será feita automaticamente no seu cartão a cada mês.
          </p>
        )}
        {onClose && (
          <Button className="w-full" onClick={onClose}>
            Continuar
          </Button>
        )}
      </div>
    );
  }

  if (step === 'checking') {
    return (
      <div className="space-y-4 py-2 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <CreditCard className="w-8 h-8 text-amber-600" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Aguardando pagamento</h3>
        <p className="text-sm text-muted-foreground">
          Complete o pagamento na aba que foi aberta. Estamos verificando automaticamente.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Verificando pagamento...
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={() => checkPayment()}>
          Já paguei, verificar agora
        </Button>
        {onClose && (
          <Button variant="ghost" className="w-full" onClick={() => { setStep('info'); setCheckoutData(null); }}>
            Cancelar
          </Button>
        )}
      </div>
    );
  }

  if (step === 'pix' && pixData) {
    return (
      <div className="space-y-4 py-2">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold">Pague via PIX</h3>
          <p className="text-sm text-muted-foreground">
            Escaneie o QR Code ou copie o código abaixo
          </p>
        </div>

        <div className="flex justify-center">
          <img
            src={pixData.qrCodeImage}
            alt="QR Code PIX"
            className="w-48 h-48 rounded-lg border"
          />
        </div>

        <div className="text-center">
          <span className="text-2xl font-bold text-primary">
            R$ {pixData.valor.toFixed(2).replace('.', ',')}
          </span>
          <span className="text-sm text-muted-foreground block">pagamento único • 30 dias de acesso</span>
        </div>

        <Button variant="outline" className="w-full gap-2" onClick={copyBrCode}>
          {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copiado!' : 'Copiar código PIX'}
        </Button>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Aguardando pagamento...
        </div>

        <Button variant="ghost" size="sm" className="w-full" onClick={() => checkPayment()}>
          Já paguei, verificar agora
        </Button>

        {onClose && (
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Cancelar
          </Button>
        )}
      </div>
    );
  }

  const preco = planInfo.preco;

  return (
    <div className="space-y-4 py-2 max-h-[80vh] overflow-y-auto">
      {/* Header - only show limit info when there's a real limit */}
      {limitResult.limit > 0 && (
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${planInfo.cor}15` }}>
            <Lock className="w-7 h-7" style={{ color: planInfo.cor }} />
          </div>
          <h3 className="text-lg font-bold text-foreground">Limite atingido</h3>
          <p className="text-sm text-muted-foreground">
            Você já registrou <strong>{limitResult.count}</strong> de <strong>{limitResult.limit}</strong> atividades gratuitas
            {childName && <> para <strong>{childName}</strong></>}.
          </p>
        </div>
      )}
      {limitResult.limit === 0 && (
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${planInfo.cor}15` }}>
            <Trophy className="w-7 h-7" style={{ color: planInfo.cor }} />
          </div>
          <h3 className="text-lg font-bold text-foreground">Turbine o perfil{childName && <> de {childName}</>}</h3>
          <p className="text-sm text-muted-foreground">
            Escolha o plano ideal e desbloqueie recursos exclusivos.
          </p>
        </div>
      )}

      {/* Único plano pago: Premium */}
      <div className="rounded-lg border-2 p-3 text-center" style={{ borderColor: `${planInfo.cor}40`, backgroundColor: `${planInfo.cor}08` }}>
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg">{planInfo.icone}</span>
          <span className="text-sm font-bold" style={{ color: planInfo.cor }}>Plano {planInfo.nome}</span>
        </div>
        <p className="text-xs mt-1" style={{ color: planInfo.cor }}>
          R$ {planInfo.preco.toFixed(2).replace('.', ',')}/mês
        </p>
      </div>

      {/* Upgrade Card */}
      <Card className="border-2 bg-background text-foreground" style={{ borderColor: `${planInfo.cor}30` }}>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <Badge style={{ backgroundColor: planInfo.cor }} className="text-white">
              {isPremium ? <Crown className="w-3 h-3 mr-1" /> : <Star className="w-3 h-3 mr-1" />}
              {planInfo.nome}
            </Badge>
          </div>

          <ul className="space-y-1.5 text-sm">
            {planInfo.destaques.slice(0, 5).map((d, i) => (
              <li key={i} className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: planInfo.cor }} />
                <span className="text-foreground">{d}</span>
              </li>
            ))}
          </ul>

          {/* CPF Input */}
          <div className="space-y-1.5">
            <Label htmlFor="cpf-paywall" className="text-xs font-medium text-foreground">CPF do responsável</Label>
            <Input
              id="cpf-paywall"
              placeholder="000.000.000-00"
              value={cpfInput}
              onChange={(e) => setCpfInput(formatCpf(e.target.value))}
              maxLength={14}
              className="text-sm"
            />
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Forma de pagamento</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cartao')}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all ${
                  paymentMethod === 'cartao'
                    ? 'ring-1 border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <CreditCard className="w-4 h-4 flex-shrink-0" />
                <div className="text-left">
                  <div>Cartão</div>
                  <div className="text-[10px] font-normal text-muted-foreground">Recorrente</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('pix')}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all ${
                  paymentMethod === 'pix'
                    ? 'ring-1 border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <QrCode className="w-4 h-4 flex-shrink-0" />
                <div className="text-left">
                  <div>PIX</div>
                  <div className="text-[10px] font-normal text-muted-foreground">30 dias</div>
                </div>
              </button>
            </div>
          </div>

          <Button
            type="button"
            className="w-full text-white gap-2"
            style={{ backgroundColor: planInfo.cor }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSubscribe();
            }}
            disabled={step === 'loading' || !cpfValid}
          >
            {step === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : paymentMethod === 'cartao' ? (
              <CreditCard className="w-4 h-4" />
            ) : (
              <QrCode className="w-4 h-4" />
            )}
            {step === 'loading'
              ? 'Processando...'
              : paymentMethod === 'cartao'
                ? `Assinar por R$ ${preco.toFixed(2).replace('.', ',')}/mês`
                : `Pagar R$ ${preco.toFixed(2).replace('.', ',')} via PIX`}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {paymentMethod === 'cartao'
              ? 'Cartão de crédito • Cobrança mensal automática • Cancele quando quiser'
              : 'Pagamento via PIX • 30 dias de acesso • Cancele quando quiser'}
          </p>
        </CardContent>
      </Card>

      {onClose && (
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Voltar
        </Button>
      )}
    </div>
  );
}
