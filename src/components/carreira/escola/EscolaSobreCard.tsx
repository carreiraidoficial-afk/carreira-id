import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, Trophy, Users, MapPin } from 'lucide-react';

interface Props {
  nome: string;
  bio: string | null;
  dados: Record<string, any> | null;
  accentColor: string;
}

function lista(valor: unknown): string[] {
  return Array.isArray(valor)
    ? valor.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : [];
}

/** Bloco "Sobre" do perfil da escola: descrição + modalidades + categorias + unidades,
 * montado a partir dos dados já cadastrados (nada de preenchimento extra). */
export function EscolaSobreCard({ nome, bio, dados, accentColor }: Props) {
  const modalidades = lista(dados?.modalidades);
  const categorias = lista(dados?.categorias);
  const unidades: any[] = Array.isArray(dados?.unidades) ? dados!.unidades : [];
  const endereco = String(dados?.endereco || '').trim();

  const temAlgo = !!bio?.trim() || modalidades.length > 0 || categorias.length > 0 || unidades.length > 0 || !!endereco;
  if (!temAlgo) return null;

  return (
    <Card className="p-4 sm:p-5" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
      <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
        <Info className="w-4 h-4" style={{ color: accentColor }} />
        Sobre {nome}
      </h2>

      <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <div>
          {bio?.trim() ? (
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{bio}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Descrição ainda não cadastrada.</p>
          )}
          {endereco && (
            <p className="mt-3 text-xs text-muted-foreground flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Sede: {endereco}</span>
            </p>
          )}
        </div>

        <div className="space-y-4">
          {modalidades.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" style={{ color: accentColor }} />Modalidades
              </p>
              <div className="flex flex-wrap gap-1.5">
                {modalidades.map((m) => <Badge key={m} variant="secondary" className="text-[11px]">{m}</Badge>)}
              </div>
            </div>
          )}

          {categorias.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" style={{ color: accentColor }} />Categorias
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categorias.map((c) => <Badge key={c} variant="outline" className="text-[11px]">{c}</Badge>)}
              </div>
            </div>
          )}

          {unidades.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" style={{ color: accentColor }} />Unidades
              </p>
              <ul className="space-y-1.5">
                {unidades.map((u, i) => (
                  <li key={`${u.nome || u.bairro}-${i}`} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{u.nome || u.bairro}</span>
                    {u.nome && u.bairro ? ` · ${u.bairro}` : ''}
                    {u.endereco ? <span className="block text-[11px]">{u.endereco}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
