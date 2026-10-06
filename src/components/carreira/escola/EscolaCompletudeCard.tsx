import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { useComunidadeEscola } from '@/hooks/useCarreiraData';
import { useTrofeusEscola } from '@/hooks/useSalaTrofeusEscola';

interface Props {
  perfil: {
    id: string;
    user_id: string;
    foto_url: string | null;
    banner_url?: string | null;
    bio: string | null;
    instagram?: string | null;
    site?: string | null;
    dados_perfil?: Record<string, any> | null;
  };
  accentColor: string;
  onEditar?: () => void;
}

const temItens = (v: unknown) => Array.isArray(v) && v.length > 0;

/** Visível só pro dono da escola: mostra o quanto do perfil público já está montado
 * e o que ainda falta, pra ele saber o que preencher sem adivinhar. */
export function EscolaCompletudeCard({ perfil, accentColor, onEditar }: Props) {
  const dados = (perfil.dados_perfil || {}) as Record<string, any>;
  const { data: comunidade = [] } = useComunidadeEscola(perfil.user_id);
  const { data: trofeus = [] } = useTrofeusEscola(perfil.id);

  const itens: { rotulo: string; ok: boolean; dica?: string }[] = [
    { rotulo: 'Logo da escola', ok: !!perfil.foto_url },
    { rotulo: 'Capa do perfil', ok: !!perfil.banner_url },
    { rotulo: 'Descrição', ok: !!perfil.bio?.trim() },
    { rotulo: 'Modalidades', ok: temItens(dados.modalidades) },
    { rotulo: 'Categorias', ok: temItens(dados.categorias) },
    { rotulo: 'Unidades', ok: temItens(dados.unidades) },
    { rotulo: 'Instagram ou site', ok: !!(perfil.instagram || dados.arroba || perfil.site || dados.site) },
    { rotulo: 'Ano de fundação', ok: Number(dados.ano_fundacao) > 1900 },
    { rotulo: 'Conquistas', ok: trofeus.length > 0, dica: 'Adicione na Sala de Troféus abaixo' },
    { rotulo: 'Atletas conectados', ok: comunidade.length > 0, dica: 'Compartilhe seu link de convite' },
  ];

  const feitos = itens.filter((i) => i.ok).length;
  const percentual = Math.round((feitos / itens.length) * 100);
  if (percentual >= 100) return null;

  return (
    <Card className="p-4 sm:p-5" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
            Perfil {percentual}% completo
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Só você vê isso, não aparece na página pública. Quanto mais completo, mais profissional a página da escola aparece pros pais.
          </p>
        </div>
        {onEditar && (
          <Button size="sm" variant="outline" className="shrink-0 text-xs h-8" onClick={onEditar}
            style={{ borderColor: `${accentColor}50`, color: accentColor }}>
            Editar perfil
          </Button>
        )}
      </div>

      <Progress value={percentual} className="h-2 mb-4" />

      <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {itens.map((item) => (
          <div key={item.rotulo} className="flex items-start gap-2 text-xs">
            {item.ok
              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
            <span className={item.ok ? 'text-foreground' : 'text-muted-foreground'}>
              {item.rotulo}
              {!item.ok && item.dica ? <span className="block text-[11px] opacity-80">{item.dica}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
