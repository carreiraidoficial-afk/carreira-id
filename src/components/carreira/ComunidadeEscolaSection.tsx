import { useComunidadeEscola } from '@/hooks/useCarreiraData';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';

interface Props {
  escolaUserId: string;
  accentColor?: string;
}

/** Comunidade pública da escola: atletas com conexão aceita --
 * mesma lógica de "seguidores de empresa" do LinkedIn, exibida a qualquer visitante. */
export function ComunidadeEscolaSection({ escolaUserId, accentColor = '#16a34a' }: Props) {
  const { data: atletas = [], isLoading } = useComunidadeEscola(escolaUserId);

  if (isLoading || atletas.length === 0) return null;

  return (
    <Card className="p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Users className="w-4 h-4" style={{ color: accentColor }} />
        Comunidade da Escola ({atletas.length})
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {atletas.map((atleta) => (
          <Link
            key={atleta.id}
            to={carreiraPath(`/${atleta.slug}`)}
            className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Avatar className="w-12 h-12">
              {atleta.foto_url ? (
                <AvatarImage src={atleta.foto_url} alt={atleta.nome} className="object-cover" />
              ) : null}
              <AvatarFallback style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                <User className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div className="text-center min-w-0">
              <p className="text-xs font-medium truncate max-w-[100px]">{atleta.nome}</p>
              {atleta.modalidade && (
                <p className="text-[10px] text-muted-foreground truncate">{atleta.modalidade}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
