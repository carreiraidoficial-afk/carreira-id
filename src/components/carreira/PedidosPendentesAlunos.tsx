import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, X, Clock, Link2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePendentesEscola, type ComunidadeAtleta } from '@/hooks/useCarreiraData';

/** "Maria Clara Souza" -> "Maria C." -- não expõe o nome completo de menor. */
export function nomeAbreviado(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] || '';
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

function dataCurta(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** Como o atleta chegou à escola, para o dono saber de onde veio cada vínculo. */
export function rotuloOrigem(atleta: ComunidadeAtleta) {
  const data = dataCurta(atleta.conectadoEm);
  const quando = data ? ` em ${data}` : '';
  return atleta.origem === 'convite' ? `Entrou pelo link da escola${quando}` : `Pediu vínculo pelo app${quando}`;
}

interface Props {
  escolaUserId: string;
  accentColor?: string;
  /** Mostra a mensagem "nenhum pedido" quando a lista está vazia (no painel); sem isso, some. */
  mostrarVazio?: boolean;
}

/** Alunos que entraram pelo link da escola (ou pediram vínculo) e esperam o dono confirmar que são alunos. */
export function PedidosPendentesAlunos({ escolaUserId, accentColor = '#3b82f6', mostrarVazio = false }: Props) {
  const { data: pendentes = [] } = usePendentesEscola(escolaUserId, true);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Confirma (ou recusa) que o atleta é aluno da escola. A conexão é do atleta, não da conta.
  const responder = async (atleta: ComunidadeAtleta, aceitar: boolean) => {
    setRespondendo(atleta.id);
    const { data, error } = await supabase
      .from('rede_conexoes')
      .update({ status: aceitar ? 'aceita' : 'rejeitada' } as any)
      .eq('status', 'pendente')
      .or(
        `and(destinatario_id.eq.${escolaUserId},destinatario_perfil_atleta_id.is.null,solicitante_perfil_atleta_id.eq.${atleta.id}),` +
        `and(solicitante_id.eq.${escolaUserId},solicitante_perfil_atleta_id.is.null,destinatario_perfil_atleta_id.eq.${atleta.id})`,
      )
      .select('id');
    setRespondendo(null);
    if (error || !data || data.length === 0) {
      toast.error('Não foi possível responder ao pedido. Tente novamente.');
      return;
    }
    toast.success(aceitar ? `${nomeAbreviado(atleta.nome)} agora faz parte dos alunos da escola.` : 'Pedido recusado.');
    ['comunidade-escola', 'comunidade-escola-pendentes', 'profile-connections-list', 'connections-count', 'user-connections', 'pending-connection-requests', 'my-connections-accepted', 'conexoes-count', 'conexao-status']
      .forEach((chave) => queryClient.invalidateQueries({ queryKey: [chave] }));
  };

  if (pendentes.length === 0) {
    return mostrarVazio ? (
      <p className="rounded-lg border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
        Nenhum aluno aguardando confirmação.
      </p>
    ) : null;
  }

  return (
    <div className="space-y-2">
      {pendentes.map((atleta) => (
        <div key={atleta.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-background/40 p-2.5" style={{ borderColor: '#f59e0b50' }}>
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
            {atleta.foto_url ? (
              <img src={atleta.foto_url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
            ) : (
              <div className="flex h-full w-full items-center justify-center" style={{ color: accentColor }}><User className="w-5 h-5" /></div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{nomeAbreviado(atleta.nome)}</p>
            <p className="truncate text-xs text-muted-foreground">{[atleta.categoria, atleta.modalidade].filter(Boolean).join(' · ')}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              {atleta.origem === 'convite' ? <Link2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {rotuloOrigem(atleta)}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={respondendo === atleta.id}
              onClick={() => responder(atleta, true)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: accentColor }}
            >
              <Check className="w-3.5 h-3.5" /> É aluno
            </button>
            <button
              type="button"
              disabled={respondendo === atleta.id}
              onClick={() => responder(atleta, false)}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-60"
            >
              <X className="w-3.5 h-3.5" /> Recusar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
