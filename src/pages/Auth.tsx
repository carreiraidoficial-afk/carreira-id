import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { SUPPORT_WHATSAPP_URL } from '@/lib/form-validators';
import { z } from 'zod';
import logoCarreiraId from '@/assets/logo-carreira-id-dark.png';
import PwaInstallButton from '@/components/shared/PwaInstallButton';
import { supabase } from '@/integrations/supabase/client';

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const signupSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, signup, user } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      const redirectUrl = `${window.location.origin}/auth`;
      const isCustomDomain =
        !window.location.hostname.includes('lovable.app') &&
        !window.location.hostname.includes('lovableproject.com') &&
        !window.location.hostname.includes('localhost');

      if (isCustomDomain) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: redirectUrl },
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
        });
        if (error) throw error;
        if (!data?.url) throw new Error('Não foi possível iniciar o login com Google');
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao fazer login com Google',
        variant: 'destructive',
      });
    }
  };

  // Redirecionar se ja estiver logado
  useEffect(() => {
    if (user && user.role) {
      if (user.role === 'admin') {
        navigate('/carreira/admin');
      } else if (['guardian', 'school', 'teacher'].includes(user.role) && user.escolinhaId) {
        navigate('/dashboard');
      } else {
        // Usuários sem escolinha (Carreira ID puro) vão para /minha
        navigate('/minha');
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const normalizedEmail = email.trim().toLowerCase();
        const validation = loginSchema.safeParse({ email: normalizedEmail, password });
        if (!validation.success) {
          toast({
            title: 'Dados invalidos',
            description: validation.error.errors[0].message,
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        const result = await login(normalizedEmail, password);
        
        if (result.success) {
          toast({
            title: 'Login realizado!',
            description: 'Bem-vindo ao sistema.',
          });
        } else {
          toast({
            title: 'Erro no login',
            description: result.error,
            variant: 'destructive',
          });
        }
      } else {
        const validation = signupSchema.safeParse({ nome, email, password });
        if (!validation.success) {
          toast({
            title: 'Dados invalidos',
            description: validation.error.errors[0].message,
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        const result = await signup(email, password, nome);
        
        if (result.success) {
          toast({
            title: 'Conta criada!',
            description: 'Sua conta foi criada com sucesso. Faca login para continuar.',
          });
          setIsLogin(true);
          setPassword('');
        } else {
          toast({
            title: 'Erro ao criar conta',
            description: result.error,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'hsl(220 15% 6%)' }}>
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-fade-in">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <img src={logoCarreiraId} alt="Carreira ID" className="h-32 w-auto mx-auto mb-4" />
          <p className="text-gray-400">Carreira Esportiva</p>
        </div>

        <Card variant="elevated" className="border border-orange-500/20" style={{ backgroundColor: 'hsl(220 12% 10%)' }}>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl text-white">
              {isLogin ? 'Entrar no Sistema' : 'Criar Conta'}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {isLogin 
                ? 'Use suas credenciais para acessar' 
                : 'Preencha os dados para se cadastrar'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-gray-300">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="nome"
                      type="text"
                      placeholder="Seu nome completo"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="pl-10 bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-500"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="email"
                    className="pl-10 bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-500"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    className="pl-10 pr-10 bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-500"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white" 
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isLogin ? 'Entrando...' : 'Criando conta...'}
                  </>
                ) : (
                  isLogin ? 'Entrar' : 'Criar Conta'
                )}
              </Button>
            </form>

            <div className="mt-4">
              <PwaInstallButton />
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700 text-center space-y-3">
              <p className="text-sm text-gray-400">
                {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                {' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-orange-500 hover:underline font-medium"
                >
                  {isLogin ? 'Cadastre-se' : 'Faça login'}
                </button>
              </p>
              <p className="text-xs text-gray-500">
                Dúvidas ou problemas?{' '}
                <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-orange-500/80 hover:underline">
                  Fale com o suporte via WhatsApp
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
