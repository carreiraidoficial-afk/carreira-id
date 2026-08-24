import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, Users, FileText, CreditCard, Activity, LogOut, Loader2, Trophy, Shield, Landmark
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import logoCarreira from '@/assets/logo-carreira-id.webp';

import { Settings2, Megaphone, GraduationCap, Stethoscope, Bell, Star, Ticket } from 'lucide-react';

const navItems = [
  { title: 'Dashboard', url: '/carreira/admin', icon: LayoutDashboard },
  { title: 'Perfis', url: '/carreira/admin/perfis', icon: Users },
  { title: 'Posts', url: '/carreira/admin/posts', icon: FileText },
  { title: 'Titulares da Base', url: '/carreira/admin/titulares', icon: Star },
  { title: 'Cupons de Convite', url: '/carreira/admin/cupons', icon: Ticket },
  { title: 'Comunicados', url: '/carreira/admin/comunicados', icon: Megaphone },
  { title: 'Notificações Push', url: '/carreira/admin/push', icon: Bell },
  { title: 'Assinaturas', url: '/carreira/admin/assinaturas', icon: CreditCard },
  { title: 'Banco', url: '/carreira/admin/banco', icon: Landmark },
  { title: 'Planos & Features', url: '/carreira/admin/planos', icon: Settings2 },
  { title: 'Atividades Externas', url: '/carreira/admin/atividades', icon: Activity },
  { title: 'Gamificação', url: '/carreira/admin/gamificacao', icon: Trophy },
  { title: 'Performance', url: '/carreira/admin/performance', icon: Trophy },
  { title: 'Moderação', url: '/carreira/admin/moderacao', icon: Shield },
  { title: 'Tutoriais', url: '/carreira/admin/tutoriais', icon: GraduationCap },
  { title: 'Diagnóstico', url: '/carreira/admin/diagnostico', icon: Stethoscope },
];

function CarreiraAdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <div className="p-4 flex items-center gap-2">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" />
              <span className="font-bold text-sm">Carreira ID Admin</span>
            </div>
          )}
          {collapsed && <Trophy className="w-6 h-6 text-primary mx-auto" />}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/carreira/admin'}
                      className="hover:bg-muted/50"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default function CarreiraAdminLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate('/auth', { replace: true });
      } else if (user.role !== 'admin') {
        navigate('/', { replace: true });
      }
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') return null;

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <CarreiraAdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="ml-0" />
              <img src={logoCarreira} alt="Carreira ID" className="h-7 w-auto hidden sm:block" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:inline">{user.name}</span>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
