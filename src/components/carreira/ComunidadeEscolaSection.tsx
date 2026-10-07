import { useState } from 'react';
import { useComunidadeEscola, type ComunidadeAtleta } from '@/hooks/useCarreiraData';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, User, ChevronRight, ExternalLink, UserMinus } from 'lucide-react';
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

/** "Maria Clara Souza" -> "Maria C." -- página pública, então não expõe nome completo de menor. */
function nomeAbreviado(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] || '';
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

/** Atletas da escola: só quem tem perfil público e conexão aceita com a escola
 * (mesma lógica de "seguidores de empresa" do LinkedIn), visível a qualquer visitante. */
export function ComunidadeEscolaSection({ escolaUserId, nomeEscola, accentColor = '#16a34a', podeGerenciar = false }: Props) {
  const { data: atletas = [], isLoading } = useComunidadeEscola(escolaUserId);
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
        `and(solicitante_id.eq.${escolaUserId},destinatario_perfil_atleta_id.eq.${atletaId}),` +
        `and(destinatario_id.eq.${escolaUserId},solicitante_perfil_atleta_id.eq.${atletaId})`,
      )
      .select('id');
    setDesvinculando(false);
    // RLS que bloqueia devolve 0 linhas sem erro: sem checar, o toast mentiria.
    if (error || !data || data.length === 0) {
      toast.error('Não foi possível desvincular. Tente novamente.');
      return;
    }
    toast.success(`${nomeAbreviado(paraDesvincular.nome)} foi desvinculado da escola.`);
    setParaDesvincular(null);
    ['comunidade-escola', 'profile-connections-list', 'connections-count', 'user-connections', 'my-connections-accepted', 'conexoes-count', 'conexao-status']
      .forEach((chave) => queryClient.invalidateQueries({ queryKey: [chave] }));
  };

  if (isLoading || atletas.length === 0) return null;

  const visiveis = mostrarTodos ? atletas : atletas.slice(0, PREVIEW);

  return (
    <Card className="p-4 sm:p-5" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {visiveis.map((atleta) => (
          <div key={atleta.id} className="relative flex">
          {podeGerenciar && (
            <button
              type="button"
              onClick={() => setParaDesvincular(atleta)}
              title="Desvincular da escola"
              aria-label={`Desvincular ${nomeAbreviado(atleta.nome)} da escola`}
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
            <div className="flex flex-col items-center gap-2 p-4 pb-3">
              <Avatar className="w-20 h-20" style={{ outline: `2px solid ${accentColor}`, outlineOffset: 2 }}>
                {atleta.foto_url ? (
                  <AvatarImage src={atleta.foto_url} alt="" className="object-cover object-top" />
                ) : null}
                <AvatarFallback style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                  <User className="w-7 h-7" />
                </AvatarFallback>
              </Avatar>
              <p className="mt-1 text-sm font-semibold text-foreground text-center truncate w-full">
                {nomeAbreviado(atleta.nome)}
              </p>
              {(atleta.categoria || atleta.modalidade) && (
                <div className="flex flex-wrap justify-center gap-1.5">
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
            <div
              className="mt-auto flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs font-medium text-foreground"
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

      <AlertDialog open={!!paraDesvincular} onOpenChange={(aberto) => { if (!aberto && !desvinculando) setParaDesvincular(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular {paraDesvincular ? nomeAbreviado(paraDesvincular.nome) : ''}?</AlertDialogTitle>
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
