import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';
import { UserCog, User, Star, Trophy, Dumbbell, LineChart, HeartPulse, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useEquipeEscola, type MembroEquipe } from '@/hooks/useEquipeEscola';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EquipeMembroDialog, type MembroEmEdicao } from './EquipeMembroDialog';

interface Props {
  escolaPerfilId: string;
  accentColor: string;
  /** Dono da escola (ou admin em Modo Suporte): adiciona, edita e remove membros. */
  podeGerenciar?: boolean;
}

const PREVIEW = 6;
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Ícone pela palavra-chave da função; o que não for conhecido cai no ícone de pessoa. */
function iconeFuncao(funcao: string): LucideIcon {
  const f = semAcento(funcao);
  if (/diretor|fundador|coorden/.test(f)) return Star;
  if (/prepar|fisic/.test(f)) return Dumbbell;
  if (/analist/.test(f)) return LineChart;
  if (/fisio|saude|medic/.test(f)) return HeartPulse;
  if (/tecnic|treinador|professor/.test(f)) return Trophy;
  return User;
}

/** Equipe técnica da escola: vitrine pública (membros aceitos) + gestão pelo dono/suporte. */
export function EquipeEscolaSection({ escolaPerfilId, accentColor, podeGerenciar = false }: Props) {
  const { data: equipe = [], isLoading } = useEquipeEscola(escolaPerfilId);
  const queryClient = useQueryClient();
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<MembroEmEdicao | null>(null);
  const [paraRemover, setParaRemover] = useState<MembroEquipe | null>(null);
  const [removendo, setRemovendo] = useState(false);

  if (isLoading) return null;
  if (equipe.length === 0 && !podeGerenciar) return null;

  const visiveis = mostrarTodos ? equipe : equipe.slice(0, PREVIEW);

  const abrirNovo = () => { setEmEdicao(null); setDialogAberto(true); };
  const abrirEdicao = (m: MembroEquipe) => {
    setEmEdicao({ id: m.id, nome: m.nome, foto_url: m.foto_url, funcao: m.funcao });
    setDialogAberto(true);
  };

  const remover = async () => {
    if (!paraRemover) return;
    setRemovendo(true);
    const { data, error } = await supabase.from('escola_equipe').delete().eq('id', paraRemover.id).select('id');
    setRemovendo(false);
    // RLS que bloqueia devolve 0 linhas sem erro.
    if (error || !data || data.length === 0) {
      toast.error('Não foi possível remover. Tente novamente.');
      return;
    }
    toast.success('Membro removido da equipe.');
    setParaRemover(null);
    queryClient.invalidateQueries({ queryKey: ['equipe-escola', escolaPerfilId] });
  };

  return (
    <Card className="p-4 sm:p-5" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <UserCog className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
            Equipe técnica{equipe.length > 0 ? ` (${equipe.length})` : ''}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Profissionais que acompanham o desenvolvimento dos atletas.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {podeGerenciar && (
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={abrirNovo}>
              <Plus className="w-3.5 h-3.5" />Adicionar
            </Button>
          )}
          {equipe.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setMostrarTodos((v) => !v)}
              className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
              style={{ borderColor: `${accentColor}60`, color: accentColor }}
            >
              {mostrarTodos ? 'Ver menos' : `Ver todos (${equipe.length})`}
            </button>
          )}
        </div>
      </div>

      {equipe.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não há ninguém na equipe. Adicione professores e técnicos, e você mesmo, se também atua.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {visiveis.map((m) => {
            const Icone = iconeFuncao(m.funcao);
            const corpo = (
              <>
                <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                  {m.foto_url ? (
                    <img src={m.foto_url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold" style={{ color: accentColor }}>
                      {m.nome[0]}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                  >
                    <Icone className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{m.nome}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{m.funcao}</p>
                  </div>
                </div>
              </>
            );
            const classes = 'flex w-full flex-col overflow-hidden rounded-xl border';
            const estilo = { borderColor: `${accentColor}40`, backgroundColor: `${accentColor}0d` };
            return (
              <div key={m.id} className="relative flex">
                {podeGerenciar && (
                  <div className="absolute right-1.5 top-1.5 z-10 flex gap-1">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(m)}
                      aria-label={`Editar ${m.nome}`}
                      title="Editar"
                      className="rounded-full border bg-background/80 p-1.5 text-muted-foreground backdrop-blur hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setParaRemover(m)}
                      aria-label={`Remover ${m.nome}`}
                      title="Remover"
                      className="rounded-full border bg-background/80 p-1.5 text-muted-foreground backdrop-blur hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {m.slug ? (
                  <Link to={carreiraPath(`/${m.slug}`)} className={`${classes} transition-colors hover:brightness-110`} style={estilo}>{corpo}</Link>
                ) : (
                  <div className={classes} style={estilo}>{corpo}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {podeGerenciar && (
        <EquipeMembroDialog
          open={dialogAberto}
          onOpenChange={setDialogAberto}
          escolaPerfilId={escolaPerfilId}
          editando={emEdicao}
        />
      )}

      <AlertDialog open={!!paraRemover} onOpenChange={(aberto) => { if (!aberto && !removendo) setParaRemover(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {paraRemover?.nome} da equipe?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa deixa de aparecer na página da escola. Você pode adicioná-la de novo quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removendo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removendo}
              onClick={(e) => { e.preventDefault(); remover(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removendo ? 'Removendo…' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
