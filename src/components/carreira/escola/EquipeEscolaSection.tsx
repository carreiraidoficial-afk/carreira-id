import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';
import { UserCog, User, Star, Trophy, Dumbbell, LineChart, HeartPulse, Pencil, Plus, Trash2, Copy, Check, MessageCircle, Send, Clock, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useEquipeEscola, useEquipePendentes, type MembroEquipe } from '@/hooks/useEquipeEscola';
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
  /** Para o link de convite de professores (só o dono vê). */
  escolaSlug?: string | null;
  nomeEscola?: string;
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
export function EquipeEscolaSection({ escolaPerfilId, accentColor, podeGerenciar = false, escolaSlug = null, nomeEscola = 'a escola' }: Props) {
  const { data: equipe = [], isLoading } = useEquipeEscola(escolaPerfilId);
  const { data: pedidos = [] } = useEquipePendentes(escolaPerfilId, podeGerenciar);
  const [copiado, setCopiado] = useState(false);
  const [respondendo, setRespondendo] = useState<string | null>(null);
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
    setEmEdicao({ id: m.id, nome: m.nome, foto_url: m.foto_url, funcao: m.funcao, funcao_secundaria: m.funcao_secundaria });
    setDialogAberto(true);
  };

  const linkProfessores = escolaSlug ? `${window.location.origin}${carreiraPath('/cadastro')}?ref=equipe&escola=${escolaSlug}` : null;
  const mensagemProfessores = `Olá! A ${nomeEscola} está no Carreira ID. Crie seu perfil de professor(a) por este link para entrar na nossa equipe técnica: ${linkProfessores}`;

  const copiarLinkProfessores = async () => {
    if (!linkProfessores) return;
    try {
      await navigator.clipboard.writeText(linkProfessores);
      setCopiado(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie o link manualmente.');
    }
  };

  const responderPedido = async (id: string, aceitar: boolean) => {
    setRespondendo(id);
    const consulta = aceitar
      ? supabase.from('escola_equipe').update({ status: 'aceita' } as any).eq('id', id).select('id')
      : supabase.from('escola_equipe').delete().eq('id', id).select('id');
    const { data, error } = await consulta;
    setRespondendo(null);
    // RLS que bloqueia devolve 0 linhas sem erro.
    if (error || !data || data.length === 0) {
      toast.error('Não foi possível responder ao pedido. Tente novamente.');
      return;
    }
    toast.success(aceitar ? 'Profissional adicionado à equipe!' : 'Pedido recusado.');
    queryClient.invalidateQueries({ queryKey: ['equipe-escola', escolaPerfilId] });
    queryClient.invalidateQueries({ queryKey: ['equipe-escola-pendentes', escolaPerfilId] });
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

      {podeGerenciar && pedidos.length > 0 && (
        <div className="mb-4 rounded-xl border p-3" style={{ borderColor: '#f59e0b60', backgroundColor: '#f59e0b0f' }}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="w-4 h-4 shrink-0 text-amber-500" />
            Aguardando sua confirmação ({pedidos.length})
          </h3>
          <p className="mb-3 mt-0.5 text-xs text-muted-foreground">Estes profissionais pediram para entrar na equipe pelo seu convite. Só aparecem na vitrine depois que você confirmar.</p>
          <ul className="space-y-2">
            {pedidos.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border bg-background/40 p-2">
                {p.foto_url ? <img src={p.foto_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">{p.nome[0]}</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{p.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.funcao}</p>
                </div>
                <Button size="sm" className="gap-1" disabled={respondendo === p.id} onClick={() => responderPedido(p.id, true)}>
                  <Check className="w-3.5 h-3.5" />Confirmar
                </Button>
                <Button size="sm" variant="outline" className="gap-1" disabled={respondendo === p.id} onClick={() => responderPedido(p.id, false)}>
                  <X className="w-3.5 h-3.5" />Recusar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {podeGerenciar && linkProfessores && (
        <div className="mb-4 rounded-xl border p-3" style={{ borderColor: `${accentColor}40` }}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Send className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
            Convide seus professores
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Envie este link no WhatsApp. Quem criar o perfil por ele fica aguardando a sua confirmação para entrar na equipe. Só você vê este bloco.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly value={linkProfessores} onFocus={(e) => e.currentTarget.select()} aria-label="Link de convite para professores"
              className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-xs text-foreground"
            />
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={copiarLinkProfessores}>
              {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiado ? 'Copiado' : 'Copiar'}
            </Button>
            <Button asChild type="button" size="sm" className="gap-1.5" style={{ backgroundColor: '#25d366', color: '#fff' }}>
              <a href={`https://wa.me/?text=${encodeURIComponent(mensagemProfessores)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-3.5 h-3.5" />WhatsApp
              </a>
            </Button>
          </div>
        </div>
      )}

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
                    {m.funcao_secundaria && <p className="truncate text-[11px] text-muted-foreground">{m.funcao_secundaria}</p>}
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
