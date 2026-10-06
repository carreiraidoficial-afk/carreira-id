import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { LinkEscola, MAX_LINKS_ESCOLA, MAX_TITULO_LINK, normalizarUrl } from '@/lib/links-escola';

interface Props {
  links: LinkEscola[];
  onChange: (proximos: LinkEscola[]) => void;
}

/** Edita a lista de links da escola (matrícula, planos, aula experimental...).
 * O primeiro da lista vira o botão principal na página pública. */
export function LinksEscolaEditor({ links, onChange }: Props) {
  const atualizar = (idx: number, campo: keyof LinkEscola, valor: string) =>
    onChange(links.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));

  const mover = (idx: number, direcao: -1 | 1) => {
    const destino = idx + direcao;
    if (destino < 0 || destino >= links.length) return;
    const copia = [...links];
    [copia[idx], copia[destino]] = [copia[destino], copia[idx]];
    onChange(copia);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Botões que aparecem no topo da página da escola (ex: matrículas, planos, aula experimental).
        O primeiro da lista é o botão principal. Máximo de {MAX_LINKS_ESCOLA}.
      </p>

      {links.map((link, idx) => {
        const urlInvalida = link.url.trim() !== '' && !normalizarUrl(link.url);
        return (
          <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={link.titulo}
                maxLength={MAX_TITULO_LINK}
                placeholder="Título do botão (ex: Aula experimental)"
                onChange={(e) => atualizar(idx, 'titulo', e.target.value)}
              />
              <div className="flex shrink-0">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={idx === 0}
                  onClick={() => mover(idx, -1)} title="Subir">
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={idx === links.length - 1}
                  onClick={() => mover(idx, 1)} title="Descer">
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                  onClick={() => onChange(links.filter((_, i) => i !== idx))} title="Remover">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Input
              value={link.url}
              placeholder="https://..."
              inputMode="url"
              onChange={(e) => atualizar(idx, 'url', e.target.value)}
            />
            {urlInvalida && (
              <p className="text-[11px] text-destructive">Endereço inválido. Use um link que comece com https://</p>
            )}
          </div>
        );
      })}

      {links.length < MAX_LINKS_ESCOLA && (
        <Button type="button" variant="outline" size="sm" className="gap-1.5"
          onClick={() => onChange([...links, { titulo: '', url: '' }])}>
          <Plus className="w-3.5 h-3.5" />Adicionar link
        </Button>
      )}
    </div>
  );
}
