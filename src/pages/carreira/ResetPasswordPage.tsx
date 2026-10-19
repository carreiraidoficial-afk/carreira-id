import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Lock, CheckCircle, Eye, EyeOff, AlertCircle } from 'lucide-react';
import logoCarreiraId from '@/assets/logo-carreira-id-dark.png';

import { pedirLinkRecuperacao, traduzirErroNovaSenha, ESPERA_RECUPERACAO_S } from '@/lib/recuperar-senha';
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { isPasswordRecovery, isLoading: authLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // O AuthContext (montado cedo, sem lazy loading) é quem detecta com segurança
  // o evento PASSWORD_RECOVERY do supabase-js. Esta página só espera esse estado
  // ficar pronto — nada de checar o hash da URL aqui, ele pode já ter sido limpo
  // pelo próprio supabase-js antes desta página (lazy-loaded) terminar de montar.
  const hadHashOnLoad = useRef(window.location.hash.includes('type=recovery'));

  // Lido uma vez ao abrir: o supabase-js limpa o hash da URL logo depois.
  const inicial = useRef((() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const consulta = new URLSearchParams(window.location.search);
    return {
      tokenHash: consulta.get('token_hash'),
      tipo: consulta.get('type'),
      erroDoLink: hash.get('error_description') || hash.get('error_code') || consulta.get('error_description') || consulta.get('error_code'),
    };
  })());

  // Pode haver sessão de recuperação mesmo que o evento tenha passado antes desta página montar.
  const [recuperacaoLocal, setRecuperacaoLocal] = useState(false);
  useEffect(() => {
    if (!hadHashOnLoad.current || isPasswordRecovery) return;
    let cancelado = false;
    supabase.auth.getSession().then(({ data }) => { if (!cancelado && data.session) setRecuperacaoLocal(true); });
    return () => { cancelado = true; };
  }, [isPasswordRecovery]);
  useEffect(() => { if (isPasswordRecovery) setRecuperacaoLocal(true); }, [isPasswordRecovery]);
  const emRecuperacao = isPasswordRecovery || recuperacaoLocal;

  // Link no formato novo (token_hash): só gasta o link quando a pessoa clica em "Continuar".
  // Assim o antivírus/leitor de links do provedor de e-mail, que abre o link antes, não o inutiliza.
  const [verificando, setVerificando] = useState(false);
  const [erroVerificacao, setErroVerificacao] = useState<string | null>(null);
  const continuarComToken = async () => {
    if (!inicial.current.tokenHash) return;
    setVerificando(true);
    setErroVerificacao(null);
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: inicial.current.tokenHash });
    setVerificando(false);
    if (error) setErroVerificacao('Este link venceu ou já foi usado. Peça um novo abaixo.');
    else setRecuperacaoLocal(true);
  };

  // Pedido de um novo link quando o atual não serve.
  const [emailNovoLink, setEmailNovoLink] = useState('');
  const [enviandoNovoLink, setEnviandoNovoLink] = useState(false);
  const [mensagemNovoLink, setMensagemNovoLink] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [esperaNovoLink, setEsperaNovoLink] = useState(0);
  useEffect(() => {
    if (esperaNovoLink <= 0) return;
    const t = setTimeout(() => setEsperaNovoLink((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [esperaNovoLink]);
  const pedirNovoLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviandoNovoLink(true);
    setMensagemNovoLink(null);
    const r = await pedirLinkRecuperacao(emailNovoLink);
    setEnviandoNovoLink(false);
    if (r.ok) {
      setEmailNovoLink(r.email || emailNovoLink);
      setEsperaNovoLink(ESPERA_RECUPERACAO_S);
      setMensagemNovoLink({ tipo: 'ok', texto: `Se ${r.email || emailNovoLink} estiver cadastrado, enviamos um novo link. Confira também Spam, Lixo eletrônico e Outros.` });
    } else {
      setMensagemNovoLink({ tipo: 'erro', texto: r.erro || 'Não foi possível enviar o link agora.' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 6) {
      setFormError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('As senhas não coincidem');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setFormError(traduzirErroNovaSenha(error.message));
      } else {
        // Encerra a sessão de recuperação imediatamente após trocar a senha,
        // para não deixá-la "pendurada" enquanto a navegação acontece
        // (evita corrida com o AuthContext processando essa sessão no meio
        // da troca de tela) e leva o usuário a um login limpo.
        // Marca como concluído ANTES de sair: o signOut dispara um evento que zera o estado de recuperação, e sem isso
        // a tela mostrava "link inválido ou expirado" logo depois de a senha ter sido trocada com sucesso.
        setDone(true);
        await supabase.auth.signOut();
        setTimeout(() => navigate('/cadastro'), 2500);
      }
    } catch {
      setFormError('Erro ao alterar senha. Tente novamente.');
    }
    setIsLoading(false);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">Senha alterada!</h2>
            <p className="text-muted-foreground">Redirecionando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Enquanto o AuthContext ainda está processando a sessão inicial (que é quando
  // o evento de recuperação é capturado), mostra um loading em vez de decidir
  // cedo demais que o link é inválido.
  if (authLoading && !emRecuperacao && hadHashOnLoad.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Link no formato novo: pede o clique antes de gastar o link.
  if (!emRecuperacao && inicial.current.tokenHash && inicial.current.tipo === 'recovery' && !erroVerificacao) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <img src={logoCarreiraId} alt="Carreira ID" className="h-20 mx-auto" />
            <h2 className="text-lg font-semibold">Criar nova senha</h2>
            <p className="text-sm text-muted-foreground">Toque em continuar para definir a nova senha da sua conta.</p>
            <Button className="w-full" size="lg" onClick={continuarComToken} disabled={verificando}>
              {verificando ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Verificando...</> : 'Continuar'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!emRecuperacao) {
    const vencido = !!inicial.current.erroDoLink || !!erroVerificacao || !!inicial.current.tokenHash;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center">
              <img src={logoCarreiraId} alt="Carreira ID" className="h-20 mx-auto mb-4" />
              <h2 className="text-lg font-semibold">Não conseguimos abrir este link</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {erroVerificacao
                  ? erroVerificacao
                  : vencido
                    ? 'O link venceu ou já foi usado. Isso acontece quando passa de 1 hora, quando é aberto duas vezes ou quando o programa de e-mail o abre antes de você.'
                    : 'O link não foi reconhecido. Ele só funciona uma vez, por até 1 hora, e deve ser aberto no mesmo aparelho em que você pediu.'}
              </p>
            </div>

            <form onSubmit={pedirNovoLink} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="novo-link-email">Pedir um novo link</Label>
                <Input
                  id="novo-link-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={emailNovoLink}
                  onChange={(e) => setEmailNovoLink(e.target.value)}
                  disabled={enviandoNovoLink}
                  maxLength={255}
                />
              </div>
              {mensagemNovoLink && (
                <p className={`text-sm rounded-md p-3 ${mensagemNovoLink.tipo === 'ok' ? 'bg-green-500/10 text-green-700' : 'bg-destructive/10 text-destructive'}`}>
                  {mensagemNovoLink.texto}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={enviandoNovoLink || esperaNovoLink > 0}>
                {enviandoNovoLink ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {esperaNovoLink > 0 ? `Enviar de novo em ${esperaNovoLink}s` : 'Enviar novo link'}
              </Button>
            </form>

            <Button variant="ghost" className="w-full" onClick={() => navigate('/cadastro')}>
              Voltar ao login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logoCarreiraId} alt="Carreira ID" className="h-20 mx-auto mb-4" />
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Nova Senha</CardTitle>
            <CardDescription>Digite sua nova senha abaixo</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={isLoading}
                    minLength={6}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={isLoading}
                    minLength={6}
                    required
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1} aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}>
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Alterando...
                  </>
                ) : (
                  'Alterar Senha'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
