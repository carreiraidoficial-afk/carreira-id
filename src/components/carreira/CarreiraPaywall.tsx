import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Star, Zap, Trophy, Copy, CheckCircle, Loader2, CreditCard, QrCode, Crown } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { useRef } from 'react';
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

type PaywallStep = 'info' | 'loading' | 'pix' | 'checking' | 'card_form' | 'success';
type PaymentMethod = 'pix' | 'cartao';

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatCardNumber = (v: string) => v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
const formatCep = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};
const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
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
  const [cardForm, setCardForm] = useState({
    number: '', expiry: '', ccv: '', holderName: '',
    holderCpf: '', cep: '', addressNumber: '', phone: '',
  });
  const [cardSubmitting, setCardSubmitting] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const cardErrorRef = useRef<HTMLDivElement | null>(null);

  const updateCard = (patch: Partial<typeof cardForm>) => {
    setCardForm((f) => ({ ...f, ...patch }));
    if (cardError) setCardError(null);
  };

  useEffect(() => {
    if (cardError && cardErrorRef.current) {
      cardErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [cardError]);

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
      // Novo fluxo: capturar cartão dentro do app (assinatura recorrente real)
      setCardForm((f) => ({
        ...f,
        holderCpf: f.holderCpf || cpfInput,
      }));
      setStep('card_form');
    }
  };

  const submitCardSubscription = async () => {
    setCardError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData.session?.user;
    const resolvedUser = user || (sessionUser ? { id: sessionUser.id, name: sessionUser.user_metadata?.nome || sessionUser.user_metadata?.full_name || 'Usuário', email: sessionUser.email || '' } : null);
    console.log('[card-submit]', { hasUser: !!resolvedUser, hasCrianca: !!criancaId });
    if (!resolvedUser || !criancaId) {
      setCardError(!criancaId ? 'Atleta não identificado' : 'Sessão expirada. Faça login novamente.');
      return;
    }

    const numberDigits = cardForm.number.replace(/\D/g, '');
    const expiryDigits = cardForm.expiry.replace(/\D/g, '');
    const holderCpfDigits = cardForm.holderCpf.replace(/\D/g, '');
    const cepDigits = cardForm.cep.replace(/\D/g, '');
    const phoneDigits = cardForm.phone.replace(/\D/g, '');

    if (numberDigits.length < 13) return setCardError('Número do cartão inválido');
    if (expiryDigits.length !== 4) return setCardError('Validade inválida (use MM/AA)');
    if (cardForm.ccv.length < 3) return setCardError('CVV inválido');
    if (!cardForm.holderName.trim()) return setCardError('Informe o nome impresso no cartão');
    if (holderCpfDigits.length !== 11) return setCardError('CPF do titular inválido');
    if (cepDigits.length !== 8) return setCardError('CEP inválido');
    if (!cardForm.addressNumber.trim()) return setCardError('Informe o número do endereço');
    if (phoneDigits.length < 10) return setCardError('Telefone inválido (com DDD)');

    setCardSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-carreira-card-subscription', {
        body: {
          user_id: resolvedUser.id,
          crianca_id: criancaId,
          cpf: cpfInput.replace(/\D/g, ''),
          nome: resolvedUser.name,
          email: resolvedUser.email,
          card: {
            holderName: cardForm.holderName.trim().toUpperCase(),
            number: numberDigits,
            expiryMonth: expiryDigits.slice(0, 2),
            expiryYear: expiryDigits.slice(2, 4),
            ccv: cardForm.ccv,
          },
          holderInfo: {
            name: cardForm.holderName.trim(),
            email: resolvedUser.email,
            cpfCnpj: holderCpfDigits,
            postalCode: cepDigits,
            addressNumber: cardForm.addressNumber.trim(),
            phone: phoneDigits,
          },
        },
      });

      if (error) {
        // Tenta extrair mensagem detalhada do body 4xx
        let msg = error.message;
        try {
          const anyErr = error as any;
          const txt = anyErr?.context && typeof anyErr.context.text === 'function'
            ? await anyErr.context.text()
            : null;
          if (txt) {
            const parsed = JSON.parse(txt);
            if (parsed?.error) msg = parsed.error;
          }
        } catch (_) {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      toast.success('Assinatura ativada! Cobrança mensal automática configurada.');
      queryClient.invalidateQueries({ queryKey: ['carreira-plano'] });
      queryClient.invalidateQueries({ queryKey: ['carreira-atividade-limit'] });
      setStep('success');
      onSubscribed?.();
    } catch (err: any) {
      console.error('Erro ao assinar com cartão:', err);
      setCardError(err.message || 'Erro ao processar cartão. Tente novamente ou use outro cartão.');
    } finally {
      setCardSubmitting(false);
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

  if (step === 'card_form') {
    return (
      <div className="space-y-3 py-2 max-h-[80vh] overflow-y-auto">
        <div className="text-center space-y-1">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Dados do cartão</h3>
          <p className="text-xs text-muted-foreground">
            Cobrança mensal automática de <strong>R$ {planInfo.preco.toFixed(2).replace('.', ',')}</strong>. Cancele quando quiser.
          </p>
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Número do cartão</Label>
            <Input
              placeholder="0000 0000 0000 0000"
              inputMode="numeric"
              value={cardForm.number}
              onChange={(e) => updateCard({ number: formatCardNumber(e.target.value) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Validade (MM/AA)</Label>
              <Input
                placeholder="MM/AA"
                inputMode="numeric"
                value={cardForm.expiry}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '').slice(0, 4);
                  const formatted = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
                  updateCard({ expiry: formatted });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CVV</Label>
              <Input
                placeholder="123"
                inputMode="numeric"
                maxLength={4}
                value={cardForm.ccv}
                onChange={(e) => updateCard({ ccv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nome impresso no cartão</Label>
            <Input
              placeholder="Nome completo"
              value={cardForm.holderName}
              onChange={(e) => updateCard({ holderName: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CPF do titular</Label>
            <Input
              placeholder="000.000.000-00"
              inputMode="numeric"
              value={cardForm.holderCpf}
              onChange={(e) => updateCard({ holderCpf: formatCpf(e.target.value) })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">CEP</Label>
              <Input
                placeholder="00000-000"
                inputMode="numeric"
                value={cardForm.cep}
                onChange={(e) => updateCard({ cep: formatCep(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nº</Label>
              <Input
                placeholder="123"
                value={cardForm.addressNumber}
                onChange={(e) => updateCard({ addressNumber: e.target.value.slice(0, 10) })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Telefone do titular</Label>
            <Input
              placeholder="(00) 00000-0000"
              inputMode="tel"
              value={cardForm.phone}
              onChange={(e) => updateCard({ phone: formatPhone(e.target.value) })}
            />
          </div>
        </div>

        {cardError && (
          <div
            ref={cardErrorRef}
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{cardError}</span>
          </div>
        )}

        <Button
          type="button"
          className="w-full text-white gap-2 mb-4"
          style={{ backgroundColor: planInfo.cor }}
          disabled={cardSubmitting}
          onClick={submitCardSubscription}
        >
          {cardSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          {cardSubmitting ? 'Processando...' : `Assinar por R$ ${planInfo.preco.toFixed(2).replace('.', ',')}/mês`}
        </Button>
        <p className="text-[10px] text-center text-muted-foreground">
          Seus dados são enviados diretamente para a Asaas (PCI compliant). Não armazenamos número nem CVV.
        </p>
        <Button variant="ghost" className="w-full" onClick={() => setStep('info')} disabled={cardSubmitting}>
          Voltar
        </Button>
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
