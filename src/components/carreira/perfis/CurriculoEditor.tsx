import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MAX_CERTIFICACOES, MAX_CONQUISTAS, MAX_IDIOMAS, NIVEIS_IDIOMA, TIPOS_CONQUISTA,
  type Certificacao, type Conquista, type IdiomaNivel, type NivelIdioma, type StatusCertificacao, type TipoConquista,
} from '@/lib/perfil-profissional';

interface Props {
  certificacoes: Certificacao[];
  onCertificacoes: (v: Certificacao[]) => void;
  idiomas: IdiomaNivel[];
  onIdiomas: (v: IdiomaNivel[]) => void;
  conquistas: Conquista[];
  onConquistas: (v: Conquista[]) => void;
}

/** Edita uma lista simples: troca um campo de uma linha, adiciona e remove linhas. */
function atualizar<T>(lista: T[], idx: number, parcial: Partial<T>): T[] {
  return lista.map((item, i) => (i === idx ? { ...item, ...parcial } : item));
}

function Bloco({ titulo, ajuda, children, acao }: { titulo: string; ajuda: string; children: React.ReactNode; acao: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{titulo}</p>
        {acao}
      </div>
      <p className="text-xs text-muted-foreground">{ajuda}</p>
      {children}
    </div>
  );
}

/** Aba "Currículo" do editor de profissional: certificações, idiomas e conquistas.
 * Tudo grava junto com "Salvar Alterações" (linhas sem título/idioma são descartadas). */
export function CurriculoEditor({ certificacoes, onCertificacoes, idiomas, onIdiomas, conquistas, onConquistas }: Props) {
  return (
    <div className="space-y-4">
      <Bloco
        titulo="Certificações"
        ajuda="Cursos e licenças, um por linha. Aparecem como lista na página."
        acao={certificacoes.length < MAX_CERTIFICACOES && (
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs"
            onClick={() => onCertificacoes([...certificacoes, { titulo: '', instituicao: '', status: 'concluido' }])}>
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        )}
      >
        {certificacoes.length === 0 && <p className="py-1 text-center text-xs italic text-muted-foreground">Nenhuma certificação</p>}
        {certificacoes.map((c, i) => (
          <div key={i} className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="flex gap-2">
              <Input value={c.titulo} maxLength={100} placeholder="Título (ex.: Curso de treinadores nível 1)"
                onChange={(e) => onCertificacoes(atualizar(certificacoes, i, { titulo: e.target.value }))} />
              <Button type="button" variant="ghost" size="sm" className="h-9 w-9 shrink-0 p-0 text-destructive hover:text-destructive"
                aria-label="Remover certificação" onClick={() => onCertificacoes(certificacoes.filter((_, k) => k !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-[1fr_9rem] gap-2">
              <Input value={c.instituicao} maxLength={100} placeholder="Instituição (opcional)"
                onChange={(e) => onCertificacoes(atualizar(certificacoes, i, { instituicao: e.target.value }))} />
              <Select value={c.status} onValueChange={(v) => onCertificacoes(atualizar(certificacoes, i, { status: v as StatusCertificacao }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="andamento">Em andamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </Bloco>

      <Bloco
        titulo="Idiomas"
        ajuda="Mostra uma barra de nível. Útil para quem busca oportunidades no exterior."
        acao={idiomas.length < MAX_IDIOMAS && (
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs"
            onClick={() => onIdiomas([...idiomas, { idioma: '', nivel: 'Intermediário' }])}>
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        )}
      >
        {idiomas.length === 0 && <p className="py-1 text-center text-xs italic text-muted-foreground">Nenhum idioma</p>}
        {idiomas.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_9rem_auto] items-center gap-2">
            <Input value={it.idioma} maxLength={30} placeholder="Idioma (ex.: Inglês)"
              onChange={(e) => onIdiomas(atualizar(idiomas, i, { idioma: e.target.value }))} />
            <Select value={it.nivel} onValueChange={(v) => onIdiomas(atualizar(idiomas, i, { nivel: v as NivelIdioma }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NIVEIS_IDIOMA.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive hover:text-destructive"
              aria-label="Remover idioma" onClick={() => onIdiomas(idiomas.filter((_, k) => k !== i))}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </Bloco>

      <Bloco
        titulo="Conquistas"
        ajuda="Títulos, medalhas e cargos de destaque. O ícone muda conforme o tipo."
        acao={conquistas.length < MAX_CONQUISTAS && (
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs"
            onClick={() => onConquistas([...conquistas, { titulo: '', descricao: '', ano: '', tipo: 'estrela' }])}>
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        )}
      >
        {conquistas.length === 0 && <p className="py-1 text-center text-xs italic text-muted-foreground">Nenhuma conquista</p>}
        {conquistas.map((c, i) => (
          <div key={i} className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="flex gap-2">
              <Input value={c.titulo} maxLength={100} placeholder="Título (ex.: Olimpíadas de Atenas 2004)"
                onChange={(e) => onConquistas(atualizar(conquistas, i, { titulo: e.target.value }))} />
              <Button type="button" variant="ghost" size="sm" className="h-9 w-9 shrink-0 p-0 text-destructive hover:text-destructive"
                aria-label="Remover conquista" onClick={() => onConquistas(conquistas.filter((_, k) => k !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <Input value={c.descricao} maxLength={120} placeholder="Descrição (ex.: Treinador Olímpico)"
              onChange={(e) => onConquistas(atualizar(conquistas, i, { descricao: e.target.value }))} />
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <Input value={c.ano} inputMode="numeric" maxLength={4} placeholder="Ano"
                onChange={(e) => onConquistas(atualizar(conquistas, i, { ano: e.target.value.replace(/\D/g, '') }))} />
              <Select value={c.tipo} onValueChange={(v) => onConquistas(atualizar(conquistas, i, { tipo: v as TipoConquista }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_CONQUISTA.map((t) => <SelectItem key={t.id} value={t.id}>{t.rotulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </Bloco>
    </div>
  );
}
