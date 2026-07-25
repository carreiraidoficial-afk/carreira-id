import { Users, Check, ChevronDown, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import type { PerfilAtleta } from '@/hooks/useCarreiraData';

interface SeletorCriancaProps {
  perfis: PerfilAtleta[];
  perfilAtivoId: string | null;
  onSelecionar: (criancaId: string) => void;
}

/**
 * Seletor de "qual filho estou vendo/gerenciando agora", pra responsáveis
 * com mais de um atleta cadastrado (irmãos). Só é renderizado pela tela
 * quando existe mais de um perfil -- ver `temMultiplos` em useCriancaAtiva.
 */
export function SeletorCrianca({ perfis, perfilAtivoId, onSelecionar }: SeletorCriancaProps) {
  const navigate = useNavigate();
  const ativo = perfis.find((p) => p.crianca_id === perfilAtivoId) || perfis[0];
  if (!ativo) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors text-xs font-medium">
          <Avatar className="w-5 h-5">
            {ativo.foto_url ? <AvatarImage src={ativo.foto_url} className="object-cover" /> : null}
            <AvatarFallback className="text-[9px]"><Users className="w-2.5 h-2.5" /></AvatarFallback>
          </Avatar>
          <span className="max-w-[110px] truncate">{ativo.nome}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {perfis.map((p) => (
          <DropdownMenuItem key={p.crianca_id || p.id} onClick={() => p.crianca_id && onSelecionar(p.crianca_id)} className="gap-2">
            <Avatar className="w-6 h-6">
              {p.foto_url ? <AvatarImage src={p.foto_url} className="object-cover" /> : null}
              <AvatarFallback className="text-[10px]"><Users className="w-3 h-3" /></AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.nome}</p>
              {p.modalidade && <p className="text-[10px] text-muted-foreground truncate">{p.modalidade}</p>}
            </div>
            {p.crianca_id === perfilAtivoId && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(carreiraPath('/cadastro?novo=1'))} className="gap-2 text-primary">
          <UserPlus className="w-4 h-4" />
          <span className="text-sm font-medium">Adicionar outro atleta</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
