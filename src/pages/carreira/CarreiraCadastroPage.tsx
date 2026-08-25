import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, User, ArrowLeft, LogOut, Rocket, Eye, EyeOff, CheckCircle2, Sparkles } from 'lucide-react';
import { z } from 'zod';
import { ProfileTypeSelector, type ProfileType } from '@/components/carreira/ProfileTypeSelector';
import { ProfileTypeForm } from '@/components/carreira/ProfileTypeForm';
import { AtletaFilhoForm } from '@/components/carreira/AtletaFilhoForm';
import { OnboardingTutorial } from '@/components/carreira/OnboardingTutorial';

import { CarreiraPaywall } from '@/components/carreira/CarreiraPaywall';
import { CarreiraFamiliaCheckout } from '@/components/carreira/CarreiraFamiliaCheckout';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PLANOS, PRECO_PREMIUM, PRECO_FAMILIA, TRIAL_DIAS } from '@/config/carreiraPlanos';
import logoAtletaId from '@/assets/logo-atleta-id.png';
import logoCarreiraId from '@/assets/logo-carreira-id-dark.png';
import { carreiraPath, isCarreiraDomain } from '@/hooks/useCarreiraBasePath';
import { PENDING_COLAB_KEY } from './ColaborarPage';
import PwaInstallButton from '@/components/shared/PwaInstallButton';
import { PwaInstallPopup } from '@/components/shared/PwaInstallPopup';
import { PushNotificationPopup } from '@/components/shared/PushNotificationPopup';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { trackCompleteRegistration, trackProfileCreated, trackInitiateCheckout, trackSubscribe, pushDataLayer } from '@/lib/fbPixel';
import { salvarPendingRef, processarConviteRef } from '@/lib/processar-convite-ref';
import { TERMOS_VERSAO } from '@/lib/termosVersao';
import { pickCriancaAtiva } from '@/hooks/useCriancaAtiva';
import type { PerfilAtleta } from '@/hooks/useCarreiraData';

type Step = 'tutorial' | 'auth' | 'recuperar-senha' | 'profile-type' | 'profile-form';

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const signupSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().trim().email('Email inválido').max(255),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

/**
 * Garante que o aceite dos Termos de Uso / Política de Privacidade fique
 * registrado pro usuário, na versão atual. Idempotente (upsert com
 * ignoreDuplicates) — seguro pra chamar tanto no cadastro por email quanto
 * como rede de segurança no login via Google, sem duplicar registro nem
 * sobrescrever um aceite já existente.
 */
async function ensureTermosAceite(userId: string, metodo: 'checkbox_explicito' | 'sessao_automatica') {
  try {
    await supabase.from('termos_aceites').upsert(
      { user_id: userId, versao: TERMOS_VERSAO, metodo },
      { onConflict: 'user_id,versao', ignoreDuplicates: true }
    );
  } catch (err) {
    console.error('[ensureTermosAceite] erro:', err);
  }
}

export default function CarreiraCadastroPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('convite');
  const refParam = searchParams.get('ref') as 'torcedor' | 'atleta' | 'rede' | null;
  const refConviteCodigo = searchParams.get('c');
  const refAtletaSlug = searchParams.get('a');
  // Cadastro intencional de mais um atleta (irmãos) pra um responsável que já
  // tem perfil -- ligado ao botão "Adicionar outro atleta" no painel.
  const wantsNewProfile = searchParams.get('novo') === '1';

  const [step, setStep] = useState<Step>('tutorial');
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(false);
  // Ref (não state) porque precisa estar disponível de forma síncrona pro
  // listener onAuthStateChange, que pode disparar antes do await de signUp()
  // resolver — evita corrida entre os dois pontos que registram o aceite.
  const justAcceptedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [selectedType, setSelectedType] = useState<ProfileType | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showSubscriptionPopup, setShowSubscriptionPopup] = useState(false);
  const [subscriptionConfirmed, setSubscriptionConfirmed] = useState(false);
  const [createdCriancaId, setCreatedCriancaId] = useState<string | null>(null);
  const [createdChildName, setCreatedChildName] = useState<string | null>(null);
  const [diasTrialConcedidos, setDiasTrialConcedidos] = useState(TRIAL_DIAS);
  const [showFamiliaOffer, setShowFamiliaOffer] = useState(false);
  const [familiaOfferCriancaIds, setFamiliaOfferCriancaIds] = useState<string[]>([]);
  const [familiaOfferCriancaNomes, setFamiliaOfferCriancaNomes] = useState<string[]>([]);
  const [familiaCheckoutAberto, setFamiliaCheckoutAberto] = useState(false);
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [showPwaPopup, setShowPwaPopup] = useState(false);
  const [showPushPopup, setShowPushPopup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recuperarEmail, setRecuperarEmail] = useState('');
  const [recuperarLoading, setRecuperarLoading] = useState(false);
  const [recuperarEnviado, setRecuperarEnviado] = useState(false);
  const [recuperarError, setRecuperarError] = useState<string | null>(null);
  const { isInstalled: pwaInstalled } = usePwaInstall();

  // Persist ?ref params so they survive OAuth redirect / email confirmation
  useEffect(() => {
    if (refParam) {
      salvarPendingRef({
        ref: refParam,
        conviteCodigo: refConviteCodigo || undefined,
        atletaSlug: refAtletaSlug || undefined,
      });
    }
  }, [refParam, refConviteCodigo, refAtletaSlug]);

  // Auto-seleciona tipo quando vem de ?ref=torcedor
  useEffect(() => {
    if (step === 'profile-type' && refParam === 'torcedor' && !selectedType) {
      setSelectedType('torcedor');
      setStep('profile-form');
    }
  }, [step, refParam, selectedType]);

  // Auth check + cross-domain session transfer
  useEffect(() => {
    const isPreviewDomain =
      window.location.hostname.includes('lovableproject.com') ||
      window.location.hostname.includes('lovable.app');
    const CANONICAL_ORIGINS = ['https://atletaid.com.br', 'https://carreiraid.com.br'];
    const isCanonical = isPreviewDomain || CANONICAL_ORIGINS.includes(window.location.origin)
      || window.location.origin.includes('localhost')
      || window.location.origin.includes('www.atletaid.com.br')
      || window.location.origin.includes('www.carreiraid.com.br');
    const isWrongDomain = !isCanonical;

    // Only do cross-domain redirect if there's a hash token in URL (OAuth callback from another domain)
    const hasHashToken = window.location.hash.includes('access_token');

    let handled = false;

    const handleSession = async (session: any): Promise<boolean> => {
      if (!session?.user) return false;
      if (handled) return true;
      handled = true;

      // Transfer session to canonical domain ONLY for OAuth callbacks on non-canonical, non-preview domains
      if (isWrongDomain && hasHashToken && session.access_token && session.refresh_token) {
          const { data: existing } = await supabase
            .from('perfis_rede')
            .select('id, slug')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const targetOrigin = 'https://carreiraid.com.br';
        const targetPath = existing?.slug ? carreiraPath(`/${existing.slug}`) : carreiraPath('/cadastro');
        const tokenHash = `#access_token=${session.access_token}&refresh_token=${session.refresh_token}&token_type=bearer&type=recovery`;
        window.location.href = `${targetOrigin}${targetPath}${inviteCode ? `?convite=${inviteCode}` : ''}${tokenHash}`;
        return true;
      }

      // Normal flow
      setUserId(session.user.id);

      // Se a pessoa veio de um convite de colaborador (precisou logar/criar
      // conta no meio do caminho), volta direto pro convite em vez de cair
      // no fluxo geral de criação de perfil.
      try {
        const pendingColabCodigo = sessionStorage.getItem(PENDING_COLAB_KEY);
        if (pendingColabCodigo) {
          sessionStorage.removeItem(PENDING_COLAB_KEY);
          navigate(carreiraPath(`/colaborar?codigo=${encodeURIComponent(pendingColabCodigo)}`), { replace: true });
          return true;
        }
      } catch { /* ignore */ }

      // Único ponto de registro do aceite: cobre tanto o cadastro por email
      // (justAcceptedRef.current fica true no handler do checkbox, síncrono,
      // antes deste listener disparar) quanto o login via Google, que não
      // passa pelo checkbox e por isso é sempre 'sessao_automatica'.
      ensureTermosAceite(session.user.id, justAcceptedRef.current ? 'checkbox_explicito' : 'sessao_automatica').catch(() => { /* silencioso */ });

      // Check if user is admin — redirect to admin panel
      try {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (roleData) {
          navigate('/carreira/admin', { replace: true });
          return true;
        }
      } catch (err) {
        console.error('Erro ao verificar role admin:', err);
      }

      try {
        if (!wantsNewProfile) {
          // Um responsável pode ter mais de um atleta cadastrado (irmãos) --
          // busca todos e respeita a última criança selecionada no seletor,
          // em vez de sempre cair na criada mais recentemente.
          const { data: perfisAtleta } = await supabase
            .from('perfil_atleta')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: true });

          const perfilAtivo = pickCriancaAtiva((perfisAtleta || []) as PerfilAtleta[], session.user.id);
          if (perfilAtivo?.slug) {
            navigate(carreiraPath(`/${perfilAtivo.slug}`), { replace: true });
            return true;
          }

          const { data: perfilRede } = await supabase
            .from('perfis_rede')
            .select('id, slug')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (perfilRede?.slug) {
            navigate(carreiraPath(`/${perfilRede.slug}`), { replace: true });
            return true;
          }
        }
      } catch (err) {
        console.error('Erro ao verificar perfil:', err);
      }

      const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.nome;
      if (fullName) setNome(fullName);
      setStep('profile-type');
      setCheckingAuth(false);
      return true;
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const result = await handleSession(session);
      if (!result) setCheckingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        const result = await handleSession(session);
        if (!result) setCheckingAuth(false);
      }
    });

    const timeout = setTimeout(() => {
      if (checkingAuth) {
        console.warn('[CarreiraCadastro] Auth check timed out, releasing UI');
        setCheckingAuth(false);
      }
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate, inviteCode, wantsNewProfile]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes('Email not confirmed')) {
            toast.error('Seu email ainda não foi confirmado. Verifique sua caixa de entrada.');
          } else if (error.message.includes('Invalid login')) {
            toast.error('Email ou senha incorretos');
          } else {
            toast.error(error.message);
          }
        } else if (data.user) {
          trackCompleteRegistration('email');
          pushDataLayer('login', { method: 'email' });
          setUserId(data.user.id);
          const { data: perfisAtleta } = await supabase
            .from('perfil_atleta')
            .select('*')
            .eq('user_id', data.user.id)
            .order('created_at', { ascending: true });
          const perfilAtivo = pickCriancaAtiva((perfisAtleta || []) as PerfilAtleta[], data.user.id);
          if (perfilAtivo?.slug) {
            navigate(carreiraPath(`/${perfilAtivo.slug}`), { replace: true });
          } else {
            const { data: perfilRede } = await supabase
              .from('perfis_rede')
              .select('id, slug')
              .eq('user_id', data.user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (perfilRede?.slug) {
              navigate(carreiraPath(`/${perfilRede.slug}`), { replace: true });
            } else {
              setStep('profile-type');
            }
          }
        }
      } else {
        const validation = signupSchema.safeParse({ nome, email, password });
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          setIsLoading(false);
          return;
        }
        if (!aceitouTermos) {
          toast.error('Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.');
          setIsLoading(false);
          return;
        }
        justAcceptedRef.current = true;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${carreiraPath('/cadastro')}`,
            data: { nome, full_name: nome },
          },
        });

        if (error) {
          const msg = error.message.includes('already registered') 
            ? 'Este email já está cadastrado. Faça login.' 
            : error.message;
          toast.error(msg, { duration: 6000 });
          if (error.message.includes('already registered')) {
            setIsLogin(true);
          }
        } else if (data.user) {
          trackCompleteRegistration('email');
          pushDataLayer('sign_up', { method: 'email' });
          if (data.session) {
            // Registro do aceite é feito pelo listener onAuthStateChange
            // (handleSession), que já sabe (via justAcceptedRef) que este
            // aceite veio do checkbox explícito, não de sessão automática.
            setUserId(data.user.id);
            setStep('profile-type');
          } else {
            toast.success('Conta criada! Verifique seu email para confirmar.');
            setIsLogin(true);
          }
        }
      }
    } catch {
      toast.error('Erro inesperado. Tente novamente.');
    }

    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    try {
      const basePath = carreiraPath('/cadastro');
      const inviteQuery = inviteCode ? `?convite=${inviteCode}` : '';
      const redirectUrl = `${window.location.origin}${basePath}${inviteQuery}`;

      // On custom domains, let Supabase handle the redirect natively
      // skipBrowserRedirect causes "OAuth state not found" on mobile
      const isCustomDomain =
        !window.location.hostname.includes('lovable.app') &&
        !window.location.hostname.includes('lovableproject.com') &&
        !window.location.hostname.includes('localhost');

      if (isCustomDomain) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
          },
        });
        if (error) throw error;
      } else {
        // Preview environment — use skipBrowserRedirect to avoid auth-bridge issues
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (!data?.url) throw new Error('Não foi possível iniciar o login com Google');
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      toast.error('Erro ao fazer login com Google');
    }
  };


  // Navega para o destino final. Se o PWA já estiver instalado, o popup de
  // instalação nunca renderiza (retorna null) — nesse caso não há como esperar
  // por ele fechar, então navegamos direto em vez de ficar preso.
  const finishOnboarding = (slugOverride?: string | null) => {
    // Aceita um slug explícito para evitar depender do state profileSlug,
    // que ainda não terá sido atualizado se chamado na mesma tick do setProfileSlug.
    const slug = slugOverride !== undefined ? slugOverride : profileSlug;
    const destino = slug ? carreiraPath(`/${slug}`) : carreiraPath('/feed');
    if (pwaInstalled) {
      navigate(destino);
    } else {
      setShowPwaPopup(true);
    }
  };

  const handleProfileCreated = async (cupomAplicado?: { diasTrial: number; cupomId: string }) => {
    if (userId) {
      // Processa convite/auto-follow vindos de ?ref&c&a (não bloqueia o fluxo)
      processarConviteRef(userId).catch(() => { /* silencioso */ });

      const { data: perfilAtleta } = await supabase
        .from('perfil_atleta')
        .select('slug, crianca_id, nome')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (perfilAtleta?.slug) {
        trackProfileCreated('atleta');
        pushDataLayer('profile_created', { type: 'atleta' });

        // Show PWA install popup after profile creation
        setProfileSlug(perfilAtleta.slug);

        // Auto-create trial subscription for new athlete (if none exists yet)
        if (perfilAtleta.crianca_id) {
          try {
            const { data: existing } = await supabase
              .from('carreira_assinaturas')
              .select('id')
              .eq('user_id', userId)
              .eq('crianca_id', perfilAtleta.crianca_id)
              .limit(1);
            if (!existing || existing.length === 0) {
              const trialEnd = new Date();
              trialEnd.setDate(trialEnd.getDate() + (cupomAplicado?.diasTrial || TRIAL_DIAS));
              await supabase.from('carreira_assinaturas').insert({
                user_id: userId,
                crianca_id: perfilAtleta.crianca_id,
                plano: 'premium',
                status: 'trial',
                valor: PRECO_PREMIUM,
                expira_em: trialEnd.toISOString().split('T')[0],
                metodo_pagamento: null,
                inicio_em: new Date().toISOString(),
                cupom_id: cupomAplicado?.cupomId || null,
              } as any);
              if (cupomAplicado) {
                setDiasTrialConcedidos(cupomAplicado.diasTrial);
                toast.success(`Cupom aplicado! Você ganhou ${cupomAplicado.diasTrial} dias grátis 🎉`);
              }
            }
          } catch (err) {
            console.error('Erro ao criar trial:', err);
          }
        }

        // Se o responsável já tem assinatura família ATIVA, o novo atleta
        // entra automaticamente nela (sem cobrança extra) -- substitui o
        // trial individual recém-criado por uma linha satélite da família.
        if (perfilAtleta.crianca_id) {
          const { data: familiaAtiva } = await supabase
            .from('carreira_assinaturas_familia')
            .select('id, metodo_pagamento, inicio_em, expira_em')
            .eq('user_id', userId)
            .eq('status', 'ativa')
            .maybeSingle();

          if (familiaAtiva) {
            await supabase.from('carreira_assinaturas')
              .update({ status: 'cancelada', cancelada_em: new Date().toISOString() })
              .eq('user_id', userId)
              .eq('crianca_id', perfilAtleta.crianca_id)
              .eq('status', 'trial');

            await supabase.from('carreira_assinaturas').insert({
              user_id: userId,
              crianca_id: perfilAtleta.crianca_id,
              plano: 'premium',
              status: 'ativa',
              familia_id: familiaAtiva.id,
              metodo_pagamento: familiaAtiva.metodo_pagamento,
              inicio_em: familiaAtiva.inicio_em,
              expira_em: familiaAtiva.expira_em,
            } as any);

            toast.success(`${perfilAtleta.nome} já entrou no plano Família! 🎉`);
            finishOnboarding(perfilAtleta.slug);
            return;
          }
        }

        // Se esse já é o 2º+ atleta desse responsável e ele ainda não tem
        // assinatura família, oferece a migração antes do popup de trial
        // individual -- é o momento em que a economia fica mais óbvia.
        if (perfilAtleta.crianca_id) {
          const { data: todosPerfis } = await supabase
            .from('perfil_atleta')
            .select('crianca_id, nome')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

          if (todosPerfis && todosPerfis.length >= 2) {
            const { data: familiaExistente } = await supabase
              .from('carreira_assinaturas_familia')
              .select('id')
              .eq('user_id', userId)
              .in('status', ['ativa', 'pendente'])
              .maybeSingle();

            if (!familiaExistente) {
              setFamiliaOfferCriancaIds(todosPerfis.map((p) => p.crianca_id).filter(Boolean) as string[]);
              setFamiliaOfferCriancaNomes(todosPerfis.map((p) => p.nome));
              setCreatedCriancaId(perfilAtleta.crianca_id);
              setCreatedChildName(perfilAtleta.nome);
              setShowFamiliaOffer(true);
              return;
            }
          }
        }

        // Sempre avisa sobre o trial e oferece a opção de ativar pagamento
        // agora — nunca navega em silêncio sem informar o usuário.
        if (perfilAtleta.crianca_id) {
          setCreatedCriancaId(perfilAtleta.crianca_id);
          setCreatedChildName(perfilAtleta.nome);
          setShowSubscriptionPopup(true);
          return;
        }

        finishOnboarding(perfilAtleta.slug);
        return;
      }

      const { data: perfilRede } = await supabase
        .from('perfis_rede')
        .select('slug, tipo')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (perfilRede?.slug) {
        trackProfileCreated(perfilRede.tipo || 'rede');
        pushDataLayer('profile_created', { type: perfilRede.tipo });
        setProfileSlug(perfilRede.slug);
        finishOnboarding(perfilRede.slug);
        return;
      }
    }
    // Fallback: no slug found, go to feed
    setProfileSlug(null);
    finishOnboarding(null);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'hsl(220 15% 6%)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'hsl(25 95% 55%)' }} />
      </div>
    );
  }

  const isCarreira = isCarreiraDomain();
  const currentLogo = isCarreira ? logoCarreiraId : logoAtletaId;
  const brandName = isCarreira ? 'CARREIRA ID' : 'Atleta ID';

  return (
    <div className="min-h-screen" data-theme="dark-orange" style={{ backgroundColor: 'hsl(220 15% 6%)' }}>
      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl" style={{ backgroundColor: 'hsl(25 95% 55% / 0.08)' }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl" style={{ backgroundColor: 'hsl(200 100% 50% / 0.06)' }} />
      </div>

      <header className="sticky top-0 z-50 backdrop-blur border-b" style={{ backgroundColor: 'hsl(220 15% 6% / 0.95)', borderColor: 'hsl(220 10% 18%)' }}>
        <div className="container flex items-center justify-between h-14 px-4">
          <button onClick={() => navigate(carreiraPath('/'))} className="flex items-center gap-2 transition-colors" style={{ color: 'hsl(0 0% 60%)' }}>
            <ArrowLeft className="w-4 h-4" />
            <img src={currentLogo} alt={brandName} className="h-7" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'hsl(0 0% 50%)' }}>
              {['Tutorial', 'Conta', 'Perfil'].map((label, i) => (
                <span key={label} className="flex items-center gap-1.5">
                  {i > 0 && <span style={{ color: 'hsl(220 10% 25%)' }}>›</span>}
                  <span className={
                    (i === 0 && step === 'tutorial') ||
                    (i === 1 && (step === 'auth' || step === 'recuperar-senha')) ||
                    (i === 2 && (step === 'profile-type' || step === 'profile-form'))
                      ? 'font-semibold' : ''
                  } style={
                    (i === 0 && step === 'tutorial') ||
                    (i === 1 && (step === 'auth' || step === 'recuperar-senha')) ||
                    (i === 2 && (step === 'profile-type' || step === 'profile-form'))
                      ? { color: 'hsl(25 95% 55%)' } : undefined
                  }>
                    {label}
                  </span>
                </span>
              ))}
            </div>
            {userId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs hover:text-destructive"
                style={{ color: 'hsl(0 0% 50%)' }}
                onClick={async () => {
                  await supabase.auth.signOut();
                  setUserId(null);
                  setStep('tutorial');
                  setSelectedType(null);
                  setNome('');
                  setEmail('');
                  setPassword('');
                  toast.success('Sessão encerrada');
                }}
              >
                <LogOut className="w-3 h-3 mr-1" />
                Sair
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container max-w-lg px-4 py-4 relative z-10">
        {step === 'tutorial' && (
          <OnboardingTutorial
            brandName={brandName}
            onStart={() => setStep('auth')}
          />
        )}

        {step === 'auth' && (
          <div className="animate-fade-in">
            <div className="text-center mb-3">
              <h1 className="text-xl font-bold" style={{ color: 'hsl(0 0% 95%)' }}>Entre na rede {brandName}</h1>
              <p className="text-sm" style={{ color: 'hsl(0 0% 55%)' }}>O LinkedIn do Esporte</p>
            </div>

            <div className="mb-3">
              <PwaInstallButton />
            </div>

            <Button variant="outline" size="lg" className="w-full mb-3 gap-2" onClick={handleGoogleLogin}
              style={{ borderColor: 'hsl(220 10% 25%)', backgroundColor: 'transparent', color: 'hsl(0 0% 90%)' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com Google
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full" style={{ borderTopWidth: '1px', borderColor: 'hsl(220 10% 20%)' }} /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="px-2" style={{ backgroundColor: 'hsl(220 15% 6%)', color: 'hsl(0 0% 45%)' }}>ou com email</span>
              </div>
            </div>

            <Card className="border" style={{ backgroundColor: 'hsl(220 12% 10%)', borderColor: 'hsl(25 95% 55% / 0.2)' }}>
              <CardContent className="pt-4 pb-4">
                <form onSubmit={handleEmailAuth} className="space-y-3">
                  {!isLogin && (
                    <div className="space-y-1">
                      <Label htmlFor="nome" style={{ color: 'hsl(0 0% 80%)' }}>Nome Completo</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(0 0% 40%)' }} />
                        <Input id="nome" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} className="pl-10" style={{ backgroundColor: 'hsl(220 15% 8%)', borderColor: 'hsl(220 10% 20%)', color: 'hsl(0 0% 95%)' }} disabled={isLoading} maxLength={100} />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="email" style={{ color: 'hsl(0 0% 80%)' }}>E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(0 0% 40%)' }} />
                      <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" style={{ backgroundColor: 'hsl(220 15% 8%)', borderColor: 'hsl(220 10% 20%)', color: 'hsl(0 0% 95%)' }} disabled={isLoading} maxLength={255} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password" style={{ color: 'hsl(0 0% 80%)' }}>Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(0 0% 40%)' }} />
                      <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10" style={{ backgroundColor: 'hsl(220 15% 8%)', borderColor: 'hsl(220 10% 20%)', color: 'hsl(0 0% 95%)' }} disabled={isLoading} />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'hsl(0 0% 55%)' }} tabIndex={-1} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {!isLogin && (
                    <div className="flex items-start gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="aceite-termos"
                        checked={aceitouTermos}
                        onChange={(e) => setAceitouTermos(e.target.checked)}
                        disabled={isLoading}
                        className="mt-0.5 w-4 h-4 shrink-0"
                      />
                      <label htmlFor="aceite-termos" className="text-xs leading-snug" style={{ color: 'hsl(0 0% 55%)' }}>
                        Li e aceito os{' '}
                        <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'hsl(200 90% 60%)' }}>Termos de Uso</a>
                        {' '}e a{' '}
                        <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'hsl(200 90% 60%)' }}>Política de Privacidade</a>.
                      </label>
                    </div>
                  )}
                  <Button type="submit" className="w-full" size="lg" disabled={isLoading || (!isLogin && !aceitouTermos)}
                    style={{ backgroundColor: 'hsl(25 95% 55%)', color: 'hsl(0 0% 100%)' }}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {isLogin ? 'Entrar' : 'Criar Conta'}
                  </Button>
                </form>
                {isLogin && (
                  <div className="mt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setRecuperarEmail(email);
                        setRecuperarError(null);
                        setRecuperarEnviado(false);
                        setStep('recuperar-senha');
                      }}
                      className="text-xs hover:underline"
                      style={{ color: 'hsl(0 0% 50%)' }}
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                )}
                <div className="mt-3 text-center text-sm" style={{ color: 'hsl(0 0% 55%)' }}>
                  {isLogin ? 'Não tem conta?' : 'Já tem conta?'}{' '}
                  <button onClick={() => setIsLogin(!isLogin)} className="hover:underline font-medium" style={{ color: 'hsl(25 95% 55%)' }}>
                    {isLogin ? 'Cadastre-se' : 'Faça login'}
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'recuperar-senha' && (
          <div className="animate-fade-in">
            <div className="text-center mb-3">
              <h1 className="text-xl font-bold" style={{ color: 'hsl(0 0% 95%)' }}>Recuperar senha</h1>
              <p className="text-sm" style={{ color: 'hsl(0 0% 55%)' }}>
                {recuperarEnviado ? 'Verifique seu e-mail' : 'Informe seu e-mail de cadastro'}
              </p>
            </div>

            <Card className="border" style={{ backgroundColor: 'hsl(220 12% 10%)', borderColor: 'hsl(25 95% 55% / 0.2)' }}>
              <CardContent className="pt-4 pb-4">
                {recuperarEnviado ? (
                  <div className="text-center space-y-4 py-2">
                    <CheckCircle2 className="w-14 h-14 mx-auto" style={{ color: 'hsl(142 70% 45%)' }} />
                    <div>
                      <p className="text-sm" style={{ color: 'hsl(0 0% 85%)' }}>
                        Enviamos um link de recuperação para <strong style={{ color: 'hsl(0 0% 100%)' }}>{recuperarEmail}</strong>.
                      </p>
                      <p className="text-xs mt-2" style={{ color: 'hsl(0 0% 55%)' }}>
                        Não encontrou? Confira também a caixa de spam/lixo eletrônico.
                      </p>
                    </div>
                    <Button
                      className="w-full"
                      size="lg"
                      style={{ backgroundColor: 'hsl(25 95% 55%)', color: 'hsl(0 0% 100%)' }}
                      onClick={() => {
                        setRecuperarEnviado(false);
                        setRecuperarError(null);
                        setStep('auth');
                      }}
                    >
                      Voltar ao login
                    </Button>
                  </div>
                ) : (
                  <form
                    className="space-y-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!recuperarEmail.trim()) {
                        setRecuperarError('Digite seu e-mail para recuperar a senha');
                        return;
                      }
                      setRecuperarError(null);
                      setRecuperarLoading(true);
                      try {
                        const { error } = await supabase.auth.resetPasswordForEmail(recuperarEmail.trim(), {
                          redirectTo: `${window.location.origin}/reset-password`,
                        });
                        if (error) throw error;
                        setRecuperarEnviado(true);
                      } catch (err: any) {
                        setRecuperarError(err.message || 'Erro ao enviar e-mail de recuperação. Tente novamente.');
                      } finally {
                        setRecuperarLoading(false);
                      }
                    }}
                  >
                    <div className="space-y-1">
                      <Label htmlFor="recuperar-email" style={{ color: 'hsl(0 0% 80%)' }}>E-mail</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(0 0% 40%)' }} />
                        <Input
                          id="recuperar-email"
                          type="email"
                          placeholder="seu@email.com"
                          value={recuperarEmail}
                          onChange={(e) => setRecuperarEmail(e.target.value)}
                          className="pl-10"
                          style={{ backgroundColor: 'hsl(220 15% 8%)', borderColor: 'hsl(220 10% 20%)', color: 'hsl(0 0% 95%)' }}
                          disabled={recuperarLoading}
                          maxLength={255}
                          autoFocus
                        />
                      </div>
                    </div>
                    {recuperarError && (
                      <p className="text-xs" style={{ color: 'hsl(0 70% 60%)' }}>{recuperarError}</p>
                    )}
                    <Button type="submit" className="w-full" size="lg" disabled={recuperarLoading}
                      style={{ backgroundColor: 'hsl(25 95% 55%)', color: 'hsl(0 0% 100%)' }}
                    >
                      {recuperarLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Enviar link de recuperação
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setRecuperarError(null); setStep('auth'); }}
                      className="w-full text-xs text-center hover:underline"
                      style={{ color: 'hsl(0 0% 50%)' }}
                    >
                      Voltar ao login
                    </button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'profile-type' && (
          <ProfileTypeSelector
            onSelect={(type) => {
              setSelectedType(type);
              setStep('profile-form');
            }}
          />
        )}

        {step === 'profile-form' && selectedType === 'atleta_filho' && userId && (
          <AtletaFilhoForm
            userId={userId}
            defaultName={nome}
            inviteCode={inviteCode}
            onBack={() => setStep('profile-type')}
            onComplete={handleProfileCreated}
            allowMultiple={wantsNewProfile}
          />
        )}

        {step === 'profile-form' && selectedType && selectedType !== 'atleta_filho' && userId && (
          <ProfileTypeForm
            type={selectedType}
            userId={userId}
            defaultName={nome}
            inviteCode={inviteCode}
            onBack={() => setStep('profile-type')}
            onComplete={handleProfileCreated}
          />
        )}
      </main>

      {/* Trial welcome / subscription popup after profile creation.
          Sempre aparece — nunca navega em silêncio sem avisar sobre o trial. */}
      <Dialog
        open={showSubscriptionPopup}
        onOpenChange={(open) => {
          if (!open) {
            setShowSubscriptionPopup(false);
            finishOnboarding();
          }
        }}
      >
        <DialogContent className="max-w-md border max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'hsl(220 15% 10%)', borderColor: 'hsl(220 10% 20%)', color: 'hsl(0 0% 95%)' }}>
          <DialogTitle className="sr-only">Assinar plano</DialogTitle>
          <DialogDescription className="sr-only">Escolha assinar o plano selecionado</DialogDescription>

          {!subscriptionConfirmed ? (
            // Pre-checkout: informa sobre o trial e oferece ativar pagamento agora
            <div className="text-center space-y-4 py-4">
              <Rocket className="w-12 h-12 mx-auto" style={{ color: PLANOS.premium.cor }} />
              <h3 className="text-xl font-bold">Perfil criado com sucesso! 🎉</h3>
              <p className="text-sm" style={{ color: 'hsl(0 0% 60%)' }}>
                Você ganhou <strong style={{ color: PLANOS.premium.cor }}>{diasTrialConcedidos} dias grátis</strong> do <strong style={{ color: PLANOS.premium.cor }}>{PLANOS.premium.icone} {PLANOS.premium.nome}</strong> para turbinar o perfil{createdChildName ? ` de ${createdChildName}` : ' do atleta'}. Depois do trial, R$ {PRECO_PREMIUM.toFixed(2).replace('.', ',')}/mês para continuar.
              </p>
              <p className="text-xs" style={{ color: 'hsl(0 0% 50%)' }}>
                Dica: o próprio atleta pode ter login próprio pra postar e registrar jornada — convide em Configurações → Colaboradores, dentro do perfil dele.
              </p>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  style={{ borderColor: 'hsl(220 10% 25%)', color: 'hsl(0 0% 70%)' }}
                  onClick={() => {
                    setShowSubscriptionPopup(false);
                    finishOnboarding();
                  }}
                >
                  Continuar no trial
                </Button>
                <Button
                  className="flex-1 font-bold text-white"
                  style={{ backgroundColor: PLANOS.premium.cor }}
                  onClick={() => {
                    trackInitiateCheckout('premium', PLANOS.premium.preco);
                    pushDataLayer('initiate_checkout', { plan: 'premium' });
                    setSubscriptionConfirmed(true);
                  }}
                >
                  Ativar agora
                </Button>
              </div>
            </div>
          ) : (
            // Paywall checkout
            <CarreiraPaywall
              limitResult={{ status: 'limit_reached', source: 'freemium', count: 0, limit: 0 }}
              childName={createdChildName || undefined}
              criancaId={createdCriancaId || undefined}
              planoSelecionado="premium"
              onClose={() => {
                setShowSubscriptionPopup(false);
                finishOnboarding();
              }}
              onSubscribed={() => {
                trackSubscribe('premium', PLANOS.premium.preco);
                pushDataLayer('purchase', { plan: 'premium' });
                setShowSubscriptionPopup(false);
                toast.success('Assinatura ativada! 🎉');
                finishOnboarding();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Oferta de assinatura Família ao cadastrar o 2º+ atleta -- some antes
          do popup de trial individual, quando a economia fica mais óbvia. */}
      <Dialog
        open={showFamiliaOffer}
        onOpenChange={(open) => {
          if (!open) {
            setShowFamiliaOffer(false);
            setFamiliaCheckoutAberto(false);
            setShowSubscriptionPopup(true);
          }
        }}
      >
        <DialogContent className="max-w-md border max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'hsl(220 15% 10%)', borderColor: 'hsl(220 10% 20%)', color: 'hsl(0 0% 95%)' }}>
          <DialogTitle className="sr-only">Assinatura Família</DialogTitle>
          <DialogDescription className="sr-only">Migre para a assinatura família e economize</DialogDescription>

          {!familiaCheckoutAberto ? (
            <div className="text-center space-y-4 py-4">
              <Sparkles className="w-12 h-12 mx-auto text-primary" />
              <h3 className="text-xl font-bold">Agora você tem {familiaOfferCriancaNomes.length} atletas! 🎉</h3>
              <p className="text-sm" style={{ color: 'hsl(0 0% 60%)' }}>
                Um valor fixo de <strong className="text-primary">R$ {PRECO_FAMILIA.toFixed(2).replace('.', ',')}/mês</strong> libera o Premium para todos eles — {familiaOfferCriancaNomes.join(', ')} — hoje e no futuro.
              </p>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  style={{ borderColor: 'hsl(220 10% 25%)', color: 'hsl(0 0% 70%)' }}
                  onClick={() => {
                    setShowFamiliaOffer(false);
                    setShowSubscriptionPopup(true);
                  }}
                >
                  Agora não
                </Button>
                <Button
                  className="flex-1 font-bold text-white"
                  style={{ backgroundColor: PLANOS.premium.cor }}
                  onClick={() => setFamiliaCheckoutAberto(true)}
                >
                  Assinar Família
                </Button>
              </div>
            </div>
          ) : (
            <CarreiraFamiliaCheckout
              criancaIds={familiaOfferCriancaIds}
              criancaNomes={familiaOfferCriancaNomes}
              onClose={() => {
                setFamiliaCheckoutAberto(false);
              }}
              onSubscribed={() => {
                setShowFamiliaOffer(false);
                setFamiliaCheckoutAberto(false);
                finishOnboarding();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* PWA Install Popup after profile creation -> em seguida, prompt de notificações */}
      <PwaInstallPopup
        open={showPwaPopup}
        onOpenChange={(open) => {
          setShowPwaPopup(open);
          if (!open) {
            setShowPushPopup(true);
          }
        }}
      />

      <PushNotificationPopup
        open={showPushPopup}
        onOpenChange={(open) => {
          setShowPushPopup(open);
          if (!open) {
            if (profileSlug) {
              navigate(carreiraPath(`/${profileSlug}`));
            } else {
              navigate(carreiraPath('/feed'));
            }
          }
        }}
      />
    </div>
  );
}