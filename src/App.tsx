import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PWAUpdatePrompt } from "@/components/shared/PWAUpdatePrompt";
import { AnonymousGateProvider } from "@/hooks/useAnonymousGate";
const RootRoute = lazy(() => import("./pages/RootRoute"));

// Lazy load pages not needed on initial render
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CarreiraLinkedinPage = lazy(() => import("./pages/carreira/CarreiraLinkedinPage"));
const CarreiraMinhasAssinaturasPage = lazy(() => import("./pages/carreira/CarreiraMinhasAssinaturasPage"));
const CarreiraPerfilPage = lazy(() => import("./pages/carreira/CarreiraPerfilPage"));
const CarreiraExplorarPage = lazy(() => import("./pages/carreira/CarreiraExplorarPage"));
const CarreiraPostPage = lazy(() => import("./pages/carreira/CarreiraPostPage"));
const EscolaPerfilPage = lazy(() => import("./pages/carreira/EscolaPerfilPage"));
const CarreiraCadastroPage = lazy(() => import("./pages/carreira/CarreiraCadastroPage"));
const PerfilPage = lazy(() => import("./pages/carreira/PerfilPage"));
const CarreiraConexoesPage = lazy(() => import("./pages/carreira/CarreiraConexoesPage"));
const CarreiraGamerPage = lazy(() => import("./pages/carreira/CarreiraGamerPage"));
const CarreiraGamerPontosPage = lazy(() => import("./pages/carreira/CarreiraGamerPontosPage"));
const CarreiraDescobrirPage = lazy(() => import("./pages/carreira/CarreiraDescobrirPage"));
const ContatoPage = lazy(() => import("./pages/carreira/ContatoPage"));
const CarreiraAdminDashboard = lazy(() => import("./pages/carreira/admin/CarreiraAdminDashboard"));
const CarreiraAdminPerfisPage = lazy(() => import("./pages/carreira/admin/CarreiraAdminPerfisPage"));
const CarreiraAdminPostsPage = lazy(() => import("./pages/carreira/admin/CarreiraAdminPostsPage"));
const CarreiraAdminAssinaturasPage = lazy(() => import("./pages/carreira/admin/CarreiraAdminAssinaturasPage"));
const CarreiraAdminPlanosPage = lazy(() => import("./pages/carreira/admin/CarreiraAdminPlanosPage"));
const CarreiraAdminAtividadesPage = lazy(() => import("./pages/carreira/admin/CarreiraAdminAtividadesPage"));
const CarreiraAdminGamificacaoPage = lazy(() => import("./pages/carreira/admin/CarreiraAdminGamificacaoPage"));
const CarreiraAdminPerformancePage = lazy(() => import("./pages/carreira/admin/CarreiraAdminPerformancePage"));
const CarreiraAdminModeracaoPage = lazy(() => import("./pages/carreira/admin/CarreiraAdminModeracaoPage"));
const CarreiraAdminComunicadosPage = lazy(() => import("./pages/carreira/admin/CarreiraAdminComunicadosPage"));
const CarreiraAdminTutoriaisPage = lazy(() => import("./pages/carreira/admin/CarreiraAdminTutoriaisPage"));
const CarreiraAdminDiagnosticoPage = lazy(() => import("./pages/carreira/admin/CarreiraAdminDiagnosticoPage"));
const CarreiraAdminPushPage = lazy(() => import("./pages/carreira/admin/CarreiraAdminPushPage"));
const ResetPasswordPage = lazy(() => import("./pages/carreira/ResetPasswordPage"));
const CarreiraPlanosPage = lazy(() => import("./pages/carreira/CarreiraPlanosPage"));
const CarreiraEventosPage = lazy(() => import("./pages/carreira/CarreiraEventosPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds - keeps data fresh, avoids refetch flash on navigation
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  },
});

const LegacyAdminRedirect = () => {
  const location = useLocation();
  const redirectPath = location.pathname.replace(/^\/admin/, '/carreira/admin');
  return <Navigate to={`${redirectPath}${location.search}${location.hash}`} replace />;
};

const App = () => {
  // Limpa o numero no icone do app (Badging API) sempre que o app abre --
  // igual outros apps, o usuario nao deve ver contagem de notificacao
  // acumulada depois de ja ter aberto o app.
  useEffect(() => {
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PWAUpdatePrompt />
        <BrowserRouter>
          <AnonymousGateProvider enabled={true}>
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center bg-background" data-theme="dark-orange">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            }>
            <Routes>
              {/* Fallback global para lazy loading — mostra spinner em vez de tela branca */}
              {/* Carreira ID — rota principal */}
              <Route path="/" element={<RootRoute />} />
              <Route path="/cadastro" element={<CarreiraCadastroPage />} />
              {/* Alias legado para área administrativa */}
              <Route path="/admin/*" element={<LegacyAdminRedirect />} />
              <Route path="/minha" element={<CarreiraLinkedinPage />} />
              <Route path="/minhas-assinaturas" element={<CarreiraMinhasAssinaturasPage />} />
              <Route path="/feed" element={<CarreiraExplorarPage />} />
              <Route path="/explorar" element={<CarreiraExplorarPage />} /> {/* retrocompat */}
              <Route path="/post/:postId" element={<CarreiraPostPage />} />
              {/* Legacy alias: /p/:id (also used by social-share edge function) */}
              <Route path="/p/:postId" element={<CarreiraPostPage />} />
              <Route path="/conexoes" element={<CarreiraConexoesPage />} />
              <Route path="/liga" element={<CarreiraGamerPage />} />
              <Route path="/liga/pontos" element={<CarreiraGamerPontosPage />} />
              <Route path="/gamer" element={<Navigate to="/liga" replace />} />
              <Route path="/gamer/pontos" element={<Navigate to="/liga/pontos" replace />} />
              <Route path="/descobrir" element={<CarreiraDescobrirPage />} />
              <Route path="/contato" element={<ContatoPage />} />
              <Route path="/planos" element={<CarreiraPlanosPage />} />
              <Route path="/eventos" element={<CarreiraEventosPage />} />
              {/* Carreira ID — Admin */}
              <Route path="/carreira/admin" element={<CarreiraAdminDashboard />} />
              <Route path="/carreira/admin/perfis" element={<CarreiraAdminPerfisPage />} />
              <Route path="/carreira/admin/posts" element={<CarreiraAdminPostsPage />} />
              <Route path="/carreira/admin/assinaturas" element={<CarreiraAdminAssinaturasPage />} />
              <Route path="/carreira/admin/planos" element={<CarreiraAdminPlanosPage />} />
              <Route path="/carreira/admin/atividades" element={<CarreiraAdminAtividadesPage />} />
              <Route path="/carreira/admin/gamificacao" element={<CarreiraAdminGamificacaoPage />} />
              <Route path="/carreira/admin/performance" element={<CarreiraAdminPerformancePage />} />
              <Route path="/carreira/admin/moderacao" element={<CarreiraAdminModeracaoPage />} />
              <Route path="/carreira/admin/comunicados" element={<CarreiraAdminComunicadosPage />} />
              <Route path="/carreira/admin/tutoriais" element={<CarreiraAdminTutoriaisPage />} />
              <Route path="/carreira/admin/diagnostico" element={<CarreiraAdminDiagnosticoPage />} />
              <Route path="/carreira/admin/push" element={<CarreiraAdminPushPage />} />
              <Route path="/perfil/:userId" element={<PerfilPage />} />
              <Route path="/escola/:slug" element={<EscolaPerfilPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/login" element={<Auth />} />
              {/* Perfil público por slug — deve ficar por último */}
              <Route path="/:slug" element={<CarreiraPerfilPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </AnonymousGateProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
