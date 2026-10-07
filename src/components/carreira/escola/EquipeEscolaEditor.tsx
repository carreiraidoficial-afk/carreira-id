import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEquipeEscola, type MembroEquipe } from '@/hooks/useEquipeEscola';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EquipeMembroDialog, type MembroEmEdicao } from './EquipeMembroDialog';

interface Props {
  escolaPerfilId: string;
}

/** Aba "Equipe" do editor da escola: lista compacta com adicionar, editar e remover.
 * Cada ação grava na hora (não depende do botão "Salvar Alterações" do formulário). */
export function EquipeEscolaEditor({ escolaPerfilId }: Props) {
  const { data: equipe = [], isLoading } = useEquipeEscola(escolaPerfilId);
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<MembroEmEdicao | null>(null);
  const [paraRemover, setParaRemover] = useState<MembroEquipe | null>(null);
  const [removendo, setRemovendo] = useState(false);

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
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Equipe técnica{equipe.length > 0 ? ` (${equipe.length})` : ''}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => { setEmEdicao(null); setDialogAberto(true); }}
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Professores, técnicos e preparadores que aparecem na página da escola. Se você também atua, adicione-se aqui.
        Estas alterações são salvas na hora, sem precisar clicar em "Salvar Alterações".
      </p>

      {isLoading ? null : equipe.length === 0 ? (
        <p className="py-2 text-center text-xs italic text-muted-foreground">Nenhum membro adicionado</p>
      ) : (
        <ul className="space-y-2">
          {equipe.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-2">
              {m.foto_url ? (
                <img src={m.foto_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover object-top" />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{m.nome}</p>
                <p className="truncate text-xs text-muted-foreground">{m.funcao}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label={`Editar ${m.nome}`}
                onClick={() => { setEmEdicao({ id: m.id, nome: m.nome, foto_url: m.foto_url, funcao: m.funcao }); setDialogAberto(true); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                aria-label={`Remover ${m.nome}`}
                onClick={() => setParaRemover(m)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <EquipeMembroDialog open={dialogAberto} onOpenChange={setDialogAberto} escolaPerfilId={escolaPerfilId} editando={emEdicao} />

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
    </div>
  );
}
