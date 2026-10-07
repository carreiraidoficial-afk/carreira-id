import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { GetCountries } from 'react-country-state-city';
import { GEO_DATA_BASE_URL } from '@/lib/geoData';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

/** País escolhido: o objeto da lib (id, iso2, name em inglês...) mais o nome em português, que é o que se grava. */
export interface PaisEscolhido {
  id: number;
  iso2: string;
  /** Nome em inglês, como vem da base da lib (react-country-state-city). */
  name: string;
  /** Nome em português ("Suíça"); Brasil é sempre "Brasil". */
  nomePt: string;
  emoji?: string;
  [chave: string]: unknown;
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

let cache: Promise<PaisEscolhido[]> | null = null;

/** Países da base auto-hospedada, com nome em português (Intl) e Brasil primeiro. Carrega uma vez por sessão. */
function carregarPaises(): Promise<PaisEscolhido[]> {
  if (!cache) {
    cache = GetCountries(GEO_DATA_BASE_URL)
      .then((lista: any[]) => {
        let nomes: Intl.DisplayNames | null = null;
        try { nomes = new Intl.DisplayNames(['pt-BR'], { type: 'region' }); } catch { /* navegador sem Intl.DisplayNames: cai pro nome em inglês */ }
        const paises: PaisEscolhido[] = (lista || []).map((c) => ({
          ...c,
          nomePt: c.iso2 === 'BR' ? 'Brasil' : ((nomes?.of(c.iso2) as string | undefined) || c.name),
        }));
        return paises.sort((a, b) =>
          Number(b.iso2 === 'BR') - Number(a.iso2 === 'BR') || a.nomePt.localeCompare(b.nomePt, 'pt-BR'));
      })
      .catch((erro: unknown) => { cache = null; throw erro; });
  }
  return cache;
}

/** Pontua o quanto o país combina com o que foi digitado: quem COMEÇA com as letras vem primeiro
 * (digitar "su" mostra Suécia, Suíça, Sudão...), depois quem tem uma palavra começando com elas, e só então
 * trechos no meio (a partir de 3 letras). O nome em inglês e a sigla também valem, com menos peso. */
function pontuar(nomePt: string, busca: string, palavrasChave: string[] = []): number {
  const q = semAcento(busca);
  if (!q) return 1;
  const pt = semAcento(nomePt);
  if (pt.startsWith(q)) return 100;
  if (pt.split(/[\s-]+/).some((w) => w.startsWith(q))) return 60;
  // com 1 letra só vale o nome em português (senão o inglês e a sigla embaralham a lista)
  const outros = q.length >= 2 ? palavrasChave.map(semAcento) : [];
  if (outros.some((o) => o.startsWith(q))) return 30;
  if (outros.some((o) => o.split(/[\s-]+/).some((w) => w.startsWith(q)))) return 20;
  if (q.length >= 3 && (pt.includes(q) || outros.some((o) => o.includes(q)))) return 1;
  return 0;
}

/** Acha o país salvo, seja em português ("Suíça"), em inglês (cadastros antigos: "Switzerland") ou "Brasil". */
function encontrar(paises: PaisEscolhido[], valor: string | undefined): PaisEscolhido | undefined {
  if (!valor) return undefined;
  const v = semAcento(valor);
  return paises.find((p) => semAcento(p.nomePt) === v || semAcento(p.name) === v || (v === 'brasil' && p.iso2 === 'BR'));
}

interface Props {
  /** Nome salvo do país ("Brasil", "Suíça" ou o nome antigo em inglês). */
  value: string | null | undefined;
  onChange: (pais: PaisEscolhido) => void;
  className?: string;
}

/** Seletor de país com busca: ao digitar as primeiras letras (com ou sem acento) a lista já filtra. */
export function PaisSelect({ value, onChange, className }: Props) {
  const [paises, setPaises] = useState<PaisEscolhido[]>([]);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let ativo = true;
    carregarPaises().then((l) => { if (ativo) setPaises(l); }).catch(() => { /* sem a lista, o botão mostra só o nome salvo */ });
    return () => { ativo = false; };
  }, []);

  const atual = useMemo(() => encontrar(paises, value || undefined), [paises, value]);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          aria-label="País"
          className={`h-9 w-full justify-between font-normal ${className ?? ''}`}
        >
          <span className="truncate">
            {atual ? `${atual.emoji ? atual.emoji + ' ' : ''}${atual.nomePt}` : (value || 'Selecione o país')}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command filter={(valor, busca, palavrasChave) => pontuar(valor, busca, palavrasChave)}>
          <CommandInput placeholder="Digite o nome do país..." />
          <CommandList>
            <CommandEmpty>Nenhum país encontrado.</CommandEmpty>
            <CommandGroup>
              {paises.map((p) => (
                <CommandItem
                  key={p.iso2}
                  value={p.nomePt}
                  // o nome em inglês e a sigla também são buscáveis: "switz" e "ch" acham a Suíça
                  keywords={[p.name, p.iso2]}
                  onSelect={() => { onChange(p); setAberto(false); }}
                >
                  <Check className={`mr-2 h-4 w-4 ${atual?.iso2 === p.iso2 ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="mr-2">{p.emoji}</span>
                  {p.nomePt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
