import { Users, School, Check, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { salvarUltimoAmbiente, type Ambiente } from '@/hooks/useCriancaAtiva';

interface AmbienteSwitcherProps {
  userId: string;
  ambienteAtual: Ambiente;
  atletaSlug: string;
  atletaNome: string;
  redeSlug: string;
  redeNome: string;
}

/**
 * Só aparece pra contas com os dois tipos de perfil (atleta E rede) --
 * ver `useMeusAmbientes`. Puramente navegacional: os dois cadastros
 * continuam independentes, isso só leva de um slug pro outro e lembra a
 * escolha pro próximo login (`resolverSlugPosLogin`).
 *
 * Dropdown único (em vez de dois pills sempre visíveis) pra não repetir o
 * nome do ambiente ativo ao lado do SeletorCrianca -- ficava confuso ter
 * dois elementos mostrando o mesmo nome na mesma barra.
 */
export function AmbienteSwitcher({ userId, ambienteAtual, atletaSlug, atletaNome, redeSlug, redeNome }: AmbienteSwitcherProps) {
  const navigate = useNavigate();

  const opcoes: { ambiente: Ambiente; slug: string; nome: string; Icon: typeof Users }[] = [
    { ambiente: 'atleta', slug: atletaSlug, nome: atletaNome, Icon: Users },
    { ambiente: 'rede', slug: redeSlug, nome: redeNome, Icon: School },
  ];
  const ativa = opcoes.find((o) => o.ambiente === ambienteAtual) || opcoes[0];

  const irPara = (ambiente: Ambiente, slug: string) => {
    if (ambiente === ambienteAtual) return;
    salvarUltimoAmbiente(userId, ambiente);
    navigate(carreiraPath(`/${slug}`));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors text-xs font-medium">
          <ativa.Icon className="w-3.5 h-3.5" />
          <span className="max-w-[110px] truncate">{ativa.nome}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {opcoes.map((o) => (
          <DropdownMenuItem key={o.ambiente} onClick={() => irPara(o.ambiente, o.slug)} className="gap-2">
            <o.Icon className="w-4 h-4" />
            <span className="flex-1 text-sm font-medium truncate">{o.nome}</span>
            {o.ambiente === ambienteAtual && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
