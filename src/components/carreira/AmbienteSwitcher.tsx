import { Users, School, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
 */
export function AmbienteSwitcher({ userId, ambienteAtual, atletaSlug, atletaNome, redeSlug, redeNome }: AmbienteSwitcherProps) {
  const navigate = useNavigate();

  const irPara = (ambiente: Ambiente, slug: string) => {
    if (ambiente === ambienteAtual) return;
    salvarUltimoAmbiente(userId, ambiente);
    navigate(carreiraPath(`/${slug}`));
  };

  const pill = (ambiente: Ambiente, slug: string, nome: string, Icon: typeof Users) => {
    const ativo = ambiente === ambienteAtual;
    return (
      <button
        type="button"
        onClick={() => irPara(ambiente, slug)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-colors ${
          ativo
            ? 'bg-primary/10 border-primary text-primary'
            : 'border-border hover:bg-muted/50 text-muted-foreground'
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="max-w-[110px] truncate">{nome}</span>
        {ativo && <Check className="w-3 h-3" />}
      </button>
    );
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      {pill('atleta', atletaSlug, atletaNome, Users)}
      {pill('rede', redeSlug, redeNome, School)}
    </div>
  );
}
