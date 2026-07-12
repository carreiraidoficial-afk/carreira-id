import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Home, ArrowLeft, Settings } from 'lucide-react';
import logoCarreira from '@/assets/logo-carreira-id-dark.png';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { EditContaDialog } from '@/components/carreira/EditContaDialog';
import { CarreiraThemeToggle } from '@/components/carreira/CarreiraThemeToggle';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { CarreiraBottomNav } from '@/components/carreira/CarreiraBottomNav';

interface CarreiraLayoutProps {
  children: React.ReactNode;
}

export function CarreiraLayout({ children }: CarreiraLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [editContaOpen, setEditContaOpen] = useState(false);
  const { theme, isDarkTheme, setDarkTheme } = useCarreiraTheme();

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background text-foreground" data-theme={theme}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container flex items-center justify-between h-20 px-4">
          {/* Logo e identidade */}
          <div className="flex items-center gap-3">
            <Link to={carreiraPath('/minha')} className="flex items-center gap-2">
              <img src={logoCarreira} alt="Carreira ID" className="h-14" />
            </Link>
            <span className="hidden sm:inline text-xs text-muted-foreground border-l pl-3">
              Carreira Esportiva
            </span>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2">
            {user && (
              <CarreiraThemeToggle
                isDarkTheme={isDarkTheme}
                onCheckedChange={setDarkTheme}
                compact
              />
            )}

            {/* Menu do usuário */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {user.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(carreiraPath('/minha'))}>
                    <User className="w-4 h-4 mr-2" />
                    Minha Carreira
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditContaOpen(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Editar Minha Conta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <EditContaDialog open={editContaOpen} onOpenChange={setEditContaOpen} />

      {/* Main Content */}
      <main className="container max-w-2xl py-6 px-4 pb-24 lg:pb-6">
        {children}
      </main>

      {user && <CarreiraBottomNav currentUserId={user.id} />}

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-8 bg-card">
        <div className="container flex flex-col items-center gap-3">
          <img src={logoCarreira} alt="Carreira ID" className="h-14" />
          <p className="text-xs text-muted-foreground">Carreira Esportiva — Sua trajetória no esporte</p>
        </div>
      </footer>
    </div>
  );
}