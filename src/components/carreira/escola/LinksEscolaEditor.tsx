import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import {
  LinkEscola, TipoLink, TIPOS_LINK, MAX_LINKS_ESCOLA, MAX_TITULO_LINK, MAX_DESCRICAO_LINK,
  normalizarUrl, proximoTipoSugerido,
} from '@/lib/links-escola';

interface Props {
  links: LinkEscola[];
  onChange: (proximos: LinkEscola[]) => void;
}

/** Edita a lista de links da escola. O tipo escolhido define ícone, texto do botão e
 * descrição padrão na página pública; o primeiro da lista vira o card de destaque. */
export function LinksEscolaEditor({ links, onChange }: Props) {
  const atualizar = (idx: number, parcial: Partial<LinkEscola>) =>
    onChange(links.map((l, i) => (i === idx ? { ...l, ...parcial } : l)));

  const trocarTipo = (idx: number, novo: TipoLink) => {
    const atual = links[idx];
    // Só troca o título sozinho se ele estiver vazio ou ainda for o padrão do tipo anterior.
    const tituloEraPadrao = !atual.titulo.trim() || atual.titulo === TIPOS_LINK[atual.tipo].tituloPadrao;
    atualizar(idx, {
      tipo: novo,
      ...(tituloEraPadrao ? { titulo: TIPOS_LINK[novo].tituloPadrao } : {}),
    });
  };

  const mover = (idx: number, direcao: -1 | 1) => {
    const destino = idx + direcao;
    if (destino < 0 || destino >= links.length) return;
    const copia = [...links];
    [copia[idx], copia[destino]] = [copia[destino], copia[idx]];
    onChange(copia);
  };

  const adicionar = () => {
    const tipo = proximoTipoSugerido(links);
    onChange([...links, { titulo: TIPOS_LINK[tipo].tituloPadrao, url: '', tipo, descricao: '' }]);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Cards de acesso rápido no topo da página da escola. Escolha o tipo e cole o endereço: o
        Carreira ID cuida do visual. O primeiro da lista ganha destaque. Máximo de {MAX_LINKS_ESCOLA}.
      </p>

      {links.map((link, idx) => {
        const urlInvalida = link.url.trim() !== '' && !normalizarUrl(link.url);
        const tipo = TIPOS_LINK[link.tipo];
        return (
          <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Select value={link.tipo} onValueChange={(v) => trocarTipo(idx, v as TipoLink)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPOS_LINK) as TipoLink[]).map((t) => (
                    <SelectItem key={t} value={t}>{TIPOS_LINK[t].rotulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              value={link.titulo}
              maxLength={MAX_TITULO_LINK}
              placeholder="Título do card"
              onChange={(e) => atualizar(idx, { titulo: e.target.value })}
            />
            <Input
              value={link.descricao || ''}
              maxLength={MAX_DESCRICAO_LINK}
              placeholder={tipo.descricaoPadrao ? `Descrição (opcional) — padrão: ${tipo.descricaoPadrao}` : 'Descrição (opcional)'}
              onChange={(e) => atualizar(idx, { descricao: e.target.value })}
            />
            <Input
              value={link.url}
              placeholder="https://..."
              inputMode="url"
              onChange={(e) => atualizar(idx, { url: e.target.value })}
            />
            {urlInvalida ? (
              <p className="text-[11px] text-destructive">Endereço inválido. Use um link que comece com https://</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Botão do card: “{tipo.cta}”</p>
            )}
          </div>
        );
      })}

      {links.length < MAX_LINKS_ESCOLA && (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={adicionar}>
          <Plus className="w-3.5 h-3.5" />Adicionar link
        </Button>
      )}
    </div>
  );
}
