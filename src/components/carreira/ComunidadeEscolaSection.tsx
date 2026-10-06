import { useState } from 'react';
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

const PREVIEW = 8;

/** "Maria Clara Souza" -> "Maria C." -- página pública, então não expõe nome completo de menor. */
function nomeAbreviado(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] || '';
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

/** Atletas da escola: só quem tem perfil público e conexão aceita com a escola
 * (mesma lógica de "seguidores de empresa" do LinkedIn), visível a qualquer visitante. */
export function ComunidadeEscolaSection({ escolaUserId, accentColor = '#16a34a' }: Props) {
  const { data: atletas = [], isLoading } = useComunidadeEscola(escolaUserId);
  const [mostrarTodos, setMostrarTodos] = useState(false);

  if (isLoading || atletas.length === 0) return null;

  const visiveis = mostrarTodos ? atletas : atletas.slice(0, PREVIEW);

  return (
    <Card className="p-4 sm:p-5" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: accentColor }} />
          Nossos atletas ({atletas.length})
        </h2>
        {atletas.length > PREVIEW && (
          <button
            type="button"
            onClick={() => setMostrarTodos((v) => !v)}
            className="text-xs font-medium hover:underline"
            style={{ color: accentColor }}
          >
            {mostrarTodos ? 'Ver menos' : `Ver todos (${atletas.length})`}
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {visiveis.map((atleta) => (
          <Link
            key={atleta.id}
            to={carreiraPath(`/${atleta.slug}`)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Avatar className="w-14 h-14">
              {atleta.foto_url ? (
                <AvatarImage src={atleta.foto_url} alt="" className="object-cover object-top" />
              ) : null}
              <AvatarFallback style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                <User className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div className="text-center min-w-0 w-full">
              <p className="text-xs font-medium truncate">{nomeAbreviado(atleta.nome)}</p>
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
