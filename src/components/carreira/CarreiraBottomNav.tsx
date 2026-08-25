import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, User, LogOut, Gamepad2, Search, Bell, CalendarDays, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { carreiraPath, isCarreiraDomain } from '@/hooks/useCarreiraBasePath';
import { useUnreadCarreiraComunicados } from '@/hooks/useCarreiraComunicadosData';

const ADMIN_EMAIL = 'carreiraidoficial@gmail.com';

interface CarreiraBottomNavProps {
  currentUserId?: string | null;
  profileSlug?: string | null;
}

const SCOUTING_TYPES = ['tecnico', 'scout', 'agente_clube', 'escola_esportes', 'empresario'];
const PENEIRA_TYPES = ['tecnico', 'scout', 'agente_clube', 'dono_escola'];

export function CarreiraBottomNav({ currentUserId, profileSlug }: CarreiraBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount: unreadComunicados } = useUnreadCarreiraComunicados();

  // Count pending connection requests
  const { data: pendingCount } = useQuery({
    queryKey: ['pending-connections-count', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return 0;
      const { count, error } = await supabase
        .from('rede_conexoes')
        .select('id', { count: 'exact', head: true })
        .eq('destinatario_id', currentUserId)
        .eq('status', 'pendente');
      if (error) return 0;
      return count || 0;
    },
    enabled: !!currentUserId,
  });

  // Check if user has a scouting profile type
  const { data: perfilRede } = useQuery({
    queryKey: ['nav-perfil-rede-tipo', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return null;
      const { data } = await supabase
        .from('perfis_rede')
        .select('tipo')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!currentUserId,
  });

  // Check if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ['nav-is-admin', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return false;
      const { data: { user } } = await supabase.auth.getUser();
      return user?.email === ADMIN_EMAIL;
    },
    enabled: !!currentUserId,
    staleTime: Infinity,
  });

  const isScoutingProfile = perfilRede ? SCOUTING_TYPES.includes(perfilRede.tipo) : false;
  const isPeneiraCreator = perfilRede ? PENEIRA_TYPES.includes(perfilRede.tipo) : false;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Você saiu da sua conta');
    if (isCarreiraDomain()) {
      navigate(carreiraPath('/cadastro'), { replace: true });
    } else {
      navigate('/auth', { replace: true });
    }
  };

  const goToProfile = async () => {
    if (profileSlug) {
      navigate(carreiraPath(`/${profileSlug}`), { replace: true });
    } else if (currentUserId) {
      const { data: pa } = await supabase
        .from('perfil_atleta')
        .select('slug')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: pr } = await supabase
        .from('perfis_rede')
        .select('slug')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      let foundSlug = pa?.slug || pr?.slug;

      // Não é dono de nenhum perfil -- pode ser colaborador de um atleta
      // (ex: o próprio atleta, ou outro responsável, com login próprio).
      if (!foundSlug) {
        const { data: colaboracao } = await supabase
          .from('perfil_atleta_colaboradores')
          .select('crianca_id')
          .eq('user_id', currentUserId)
          .eq('status', 'ativo')
          .limit(1)
          .maybeSingle();
        if (colaboracao?.crianca_id) {
          const { data: atletaColaborado } = await supabase
            .from('perfil_atleta')
            .select('slug')
            .eq('crianca_id', colaboracao.crianca_id)
            .maybeSingle();
          foundSlug = atletaColaborado?.slug;
        }
      }

      if (foundSlug) navigate(carreiraPath(`/${foundSlug}`), { replace: true });
      else navigate(carreiraPath(`/perfil/${currentUserId}`), { replace: true });
    }
  };

  const feedPath = carreiraPath('/feed');
  const conexoesPath = carreiraPath('/conexoes');
  const ligaPath = carreiraPath('/liga');
  const descobrirPath = carreiraPath('/descobrir');
  const eventosPath = carreiraPath('/eventos');
  const ligaAliasPath = carreiraPath('/gamer');

  const baseItems = [
    {
      icon: Home,
      label: 'Feed',
      onClick: () => navigate(feedPath, { replace: true }),
      active: location.pathname === feedPath || location.pathname === carreiraPath('/explorar'),
      badge: 0,
    },
    {
      icon: Users,
      label: 'Conexões',
      onClick: () => navigate(conexoesPath, { replace: true }),
      active: location.pathname === conexoesPath,
      badge: (pendingCount || 0),
    },
  ];

  // Conditionally show Liga OR Descobrir based on profile type
  const middleItem = isScoutingProfile
    ? {
        icon: Search,
        label: 'Descobrir',
        onClick: () => navigate(descobrirPath, { replace: true }),
        active: location.pathname === descobrirPath,
        badge: 0,
      }
    : {
        icon: Gamepad2,
        label: 'Liga',
        onClick: () => navigate(ligaPath, { replace: true }),
        active:
          location.pathname === ligaPath ||
          location.pathname.startsWith(`${ligaPath}/`) ||
          location.pathname === ligaAliasPath ||
          location.pathname.startsWith(`${ligaAliasPath}/`),
        badge: 0,
      };

  const adminPath = carreiraPath('/admin');

  // Build items - professionals get Eventos instead of Liga
  const navItems = [
    ...baseItems,
    ...(isPeneiraCreator ? [{
      icon: CalendarDays,
      label: 'Eventos',
      onClick: () => navigate(eventosPath, { replace: true }),
      active: location.pathname === eventosPath,
      badge: 0,
    }] : []),
    middleItem,
    {
      icon: User,
      label: 'Meu Perfil',
      onClick: goToProfile,
      active: !!profileSlug && location.pathname === carreiraPath(`/${profileSlug}`),
      badge: unreadComunicados || 0,
    },
    ...(isAdmin ? [{
      icon: Shield,
      label: 'Admin',
      onClick: () => navigate(adminPath, { replace: true }),
      active: location.pathname.startsWith(adminPath),
      badge: 0,
    }] : []),
    {
      icon: LogOut,
      label: 'Sair',
      onClick: handleLogout,
      active: false,
      badge: 0,
    },
  ];

  if (!currentUserId) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] bg-background border-t border-border lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              if (!item.active) item.onClick();
            }}
            className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              item.active
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="relative">
              <item.icon className="w-5 h-5" />
              {item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-orange-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}