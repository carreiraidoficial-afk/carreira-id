import { useState } from 'react';
import { useComunidadeEscola, usePendentesEscola, type ComunidadeAtleta } from '@/hooks/useCarreiraData';
import { PedidosPendentesAlunos, nomeAbreviado, rotuloOrigem } from './PedidosPendentesAlunos';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card } from '@/components/ui/card';
import { Users, User, ChevronRight, ExternalLink, UserMinus, Clock, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';

interface Props {
  escolaUserId: string;
  nomeEscola?: string;
  accentColor?: string;
  /** Dono da escola (ou admin em Modo Suporte): pode desvincular atletas que saíram. */
  podeGerenciar?: boolean;
}

const PREVIEW = 10;

/** Atletas da escola: só quem tem perfil público e conexão aceita com a escola
 * (mesma lógica de "seguidores de empresa" do LinkedIn), visível a qualquer visitante. */
export function ComunidadeEscolaSection({ escolaUserId, nomeEscola, accentColor = '#16a34a', podeGerenciar = false }: Props) {
  const { data: atletas = [], isLoading } = useComunidadeEscola(escolaUserId);
  const { data: pendentes = [] } = usePendentesEscola(escolaUserId, podeGerenciar);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const queryClient = useQueryClient();
  const [paraDesvincular, setParaDesvincular] = useState<ComunidadeAtleta | null>(null);
  const [desvinculando, setDesvinculando] = useState(false);

  // Apaga o vínculo aceito entre a escola e ESTE atleta (a conexão é do atleta, não da conta:
  // irmãos em outras escolas não são afetados). O perfil do atleta continua existindo.
  const desvincular = async () => {
    if (!paraDesvincular) return;
    setDesvinculando(true);
    const atletaId = paraDesvincular.id;
    const { data, error } = await supabase
      .from('rede_conexoes')
      .delete()
      .eq('status', 'aceita')
      .or(
        `and(solicitante_id.eq.${escolaUserId},solicitante_perfil_atleta_id.is.null,destinatario_perfil_atleta_id.eq.${atletaId}),` +
        `and(destinatario_id.eq.${escolaUserId},destinatario_perfil_atleta_id.is.null,solicitante_perfil_atleta_id.eq.${atletaId})`,
      )
      .select('id');
    setDesvinculando(false);
    // RLS que bloqueia devolve 0 linhas sem erro: sem checar, o toast mentiria.
    if (error || !data || data.length === 0) {
      toast.error('Não foi possível desvincular. Tente novamente.');
      return;
    }
    toast.success(`${nomeAbreviado(paraDesvincular.nome, paraDesvincular.usa_nome_esportivo)} foi desvinculado da escola.`);
    setParaDesvincular(null);
    ['comunidade-escola', 'profile-connections-list', 'connections-count', 'user-connections', 'my-connections-accepted', 'conexoes-count', 'conexao-status']
      .forEach((chave) => queryClient.invalidateQueries({ queryKey: [chave] }));
  };

  const temPendentes = podeGerenciar && pendentes.length > 0;
  if (isLoading || (atletas.length === 0 && !temPendentes)) return null;

  const visiveis = mostrarTodos ? atletas : atletas.slice(0, PREVIEW);

  return (
    <Card className="p-4 sm:p-5" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
      {temPendentes && (
        <div className="mb-5 rounded-xl border p-3" style={{ borderColor: '#f59e0b60', backgroundColor: '#f59e0b0f' }}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="w-4 h-4 shrink-0 text-amber-500" />
            Aguardando sua confirmação ({pendentes.length})
          </h3>
          <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
            Estes atletas entraram pelo link da escola ou pediram vínculo. Eles só aparecem em "Nossos atletas" depois que você confirmar que são alunos.
          </p>
          <PedidosPendentesAlunos escolaUserId={escolaUserId} accentColor={accentColor} />
        </div>
      )}

      {atletas.length > 0 && (<>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
            Nossos atletas ({atletas.length})
          </h2>
          {nomeEscola && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Alunos do {nomeEscola} e suas trajetórias no Carreira ID.
            </p>
          )}
        </div>
        {atletas.length > PREVIEW && (
          <button
            type="button"
            onClick={() => setMostrarTodos((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
            style={{ borderColor: `${accentColor}60`, color: accentColor }}
          >
            {mostrarTodos ? 'Ver menos' : `Ver todos os atletas (${atletas.length})`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {visiveis.map((atleta) => (
          <div key={atleta.id} className="relative flex">
          {podeGerenciar && (
            <button
              type="button"
              onClick={() => setParaDesvincular(atleta)}
              title="Desvincular da escola"
              aria-label={`Desvincular ${nomeAbreviado(atleta.nome, atleta.usa_nome_esportivo)} da escola`}
              className="absolute right-2 top-2 z-10 rounded-full border bg-background/80 p-1.5 text-muted-foreground backdrop-blur transition-colors hover:text-destructive"
              style={{ borderColor: `${accentColor}40` }}
            >
              <UserMinus className="w-3.5 h-3.5" />
            </button>
          )}
          <Link
            to={carreiraPath(`/${atleta.slug}`)}
            className="group flex w-full flex-col rounded-xl border overflow-hidden transition-colors hover:brightness-110"
            style={{ borderColor: `${accentColor}40`, backgroundColor: `${accentColor}0d` }}
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
              {atleta.foto_url ? (
                <img src={atleta.foto_url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
              ) : (
                <div className="flex h-full w-full items-center justify-center" style={{ color: accentColor }}>
                  <User className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5 px-2.5 py-2">
              <p className="text-sm font-semibold text-foreground truncate w-full">
                {nomeAbreviado(atleta.nome, atleta.usa_nome_esportivo)}
              </p>
              {(atleta.categoria || atleta.modalidade) && (
                <div className="flex flex-wrap gap-1.5">
                  {atleta.categoria && (
                    <span
                      className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium text-foreground"
                      style={{ borderColor: `${accentColor}40` }}
                    >
                      {atleta.categoria}
                    </span>
                  )}
                  {atleta.modalidade && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
                    >
                      {atleta.modalidade}
                    </span>
                  )}
                </div>
              )}
            </div>
            {podeGerenciar && (
              <p className="mx-2.5 mb-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                {atleta.origem === 'convite' ? <Link2 className="w-3 h-3 shrink-0" /> : <Clock className="w-3 h-3 shrink-0" />}
                <span className="truncate">{rotuloOrigem(atleta)}</span>
              </p>
            )}
            <div
              className="mt-auto flex items-center justify-between gap-2 border-t px-2.5 py-2 text-xs font-medium text-foreground"
              style={{ borderColor: `${accentColor}30` }}
            >
              <span className="inline-flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" style={{ color: accentColor }} />
                Ver perfil
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
          </div>
        ))}
      </div>
      </>)}

      <AlertDialog open={!!paraDesvincular} onOpenChange={(aberto) => { if (!aberto && !desvinculando) setParaDesvincular(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular {paraDesvincular ? nomeAbreviado(paraDesvincular.nome, paraDesvincular.usa_nome_esportivo) : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              O atleta deixa de aparecer em "Nossos atletas" e perde o vínculo com {nomeEscola || 'a escola'}. O perfil dele no Carreira ID
              continua normal, e ele pode pedir o vínculo de novo quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desvinculando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={desvinculando}
              onClick={(e) => { e.preventDefault(); desvincular(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {desvinculando ? 'Desvinculando…' : 'Desvincular'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
