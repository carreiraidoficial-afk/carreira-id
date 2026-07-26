import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserPlus, Check, Clock, Loader2, UserMinus, MapPin } from 'lucide-react';

async function getDisplayName(userId: string): Promise<string> {
  // .limit(1) em vez de .maybeSingle(): um responsável pode ter mais de um
  // perfil_atleta (irmãos) -- .maybeSingle() erroraria com 2+ linhas.
  const { data: atletas } = await supabase.from('perfil_atleta').select('nome').eq('user_id', userId)
    .order('created_at', { ascending: true }).limit(1);
  if (atletas?.[0]?.nome) return atletas[0].nome;
  const { data: rede } = await supabase.from('perfis_rede').select('nome').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return rede?.nome || 'Alguém';
}

async function notifyPush(userIds: string[], title: string, body: string, category: string, url = '/conexoes') {
  try {
    await supabase.functions.invoke('send-carreira-push', {
      body: { user_ids: userIds, title, body, url, tag: category, category },
    });
  } catch { /* silencioso: notificação é best-effort, não deve travar o fluxo principal */ }
}

interface Unidade {
  nome: string;
  endereco?: string;
  bairro?: string;
  referencia?: string;
}

interface Props {
  targetUserId: string;
  currentUserId?: string | null;
  accentColor?: string;
  /** If the target is a dono_escola, pass their unidades so user can pick one */
  unidades?: Unidade[];
  /** Whether the target profile is a dono_escola */
  isDono?: boolean;
  /** Pre-selected unit name — skips the dialog */
  unidadeNome?: string;
  /**
   * ID do perfil_atleta ATIVO de quem está conectando (o filho selecionado no
   * seletor de irmãos), quando aplicável. Sem isso, a conexão fica "da conta"
   * em vez de "do atleta" -- e um irmão herdaria conexão do outro.
   */
  sourcePerfilAtletaId?: string | null;
  /** ID do perfil_atleta do alvo, quando o perfil visitado é de atleta */
  targetPerfilAtletaId?: string | null;
}

/** Uma linha de conexão corresponde a ESTE par específico (meu atleta ativo
 * + o atleta alvo sendo exibido), não só à conta -- checa os dois lados,
 * senão dois irmãos do mesmo alvo (ou do mesmo lado de quem pergunta)
 * aparecem com o mesmo status "Conectado" por engano. Coluna null em
 * qualquer lado é tratada como legada/sem distinção (passa). */
function pertenceAoAtivo(
  row: any,
  meuUserId: string,
  meuPerfilAtletaId: string | null | undefined,
  alvoPerfilAtletaId?: string | null,
): boolean {
  const souSolicitante = row.solicitante_id === meuUserId;
  const meuLado = souSolicitante ? row.solicitante_perfil_atleta_id : row.destinatario_perfil_atleta_id;
  const ladoAlvo = souSolicitante ? row.destinatario_perfil_atleta_id : row.solicitante_perfil_atleta_id;
  const meuLadoOk = !meuLado || meuLado === meuPerfilAtletaId;
  const ladoAlvoOk = !ladoAlvo || !alvoPerfilAtletaId || ladoAlvo === alvoPerfilAtletaId;
  return meuLadoOk && ladoAlvoOk;
}

export function ConectarButton({ targetUserId, currentUserId, accentColor = '#3b82f6', unidades, isDono, unidadeNome: preselectedUnidade, sourcePerfilAtletaId, targetPerfilAtletaId }: Props) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [showUnidadeDialog, setShowUnidadeDialog] = useState(false);

  const { data: conexao, isLoading: statusLoading } = useQuery({
    queryKey: ['conexao-status', currentUserId, targetUserId, preselectedUnidade || '__none__', sourcePerfilAtletaId],
    queryFn: async () => {
      if (!currentUserId) return null;
      let query = supabase
        .from('rede_conexoes')
        .select('*')
        .or(
          `and(solicitante_id.eq.${currentUserId},destinatario_id.eq.${targetUserId}),and(solicitante_id.eq.${targetUserId},destinatario_id.eq.${currentUserId})`
        );
      // When checking per-unit, filter by unidade_nome
      if (preselectedUnidade) {
        query = query.eq('unidade_nome', preselectedUnidade);
      } else {
        query = query.is('unidade_nome', null);
      }
      const { data, error } = await query
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar status da conexão:', error);
        return null;
      }

      const propria = (data || []).filter((row) => pertenceAoAtivo(row, currentUserId, sourcePerfilAtletaId, targetPerfilAtletaId));
      return propria[0] ?? null;
    },
    enabled: !!currentUserId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['conexao-status', currentUserId, targetUserId] });
    queryClient.invalidateQueries({ queryKey: ['conexoes-count'] });
    queryClient.invalidateQueries({ queryKey: ['user-connections'] });
    queryClient.invalidateQueries({ queryKey: ['pending-connection-requests'] });
    queryClient.invalidateQueries({ queryKey: ['connection-suggestions-smart'] });
    queryClient.invalidateQueries({ queryKey: ['connection-suggestions'] });
    queryClient.invalidateQueries({ queryKey: ['profile-suggestions'] });
    queryClient.invalidateQueries({ queryKey: ['profile-connections-list'] });
    queryClient.invalidateQueries({ queryKey: ['connections-count'] });
    queryClient.invalidateQueries({ queryKey: ['my-connections-accepted'] });
  };

  const handleConectar = async (unidadeNome?: string) => {
    if (!currentUserId) {
      toast.error('Faça login para conectar');
      return;
    }
    setLoading(true);
    const insertData: any = {
      solicitante_id: currentUserId,
      destinatario_id: targetUserId,
      status: 'pendente',
      solicitante_perfil_atleta_id: sourcePerfilAtletaId || null,
      destinatario_perfil_atleta_id: targetPerfilAtletaId || null,
    };
    if (unidadeNome) {
      insertData.unidade_nome = unidadeNome;
    }
    const { error } = await supabase.from('rede_conexoes').insert(insertData);
    if (error) {
      toast.error('Erro ao enviar solicitação');
    } else {
      toast.success(unidadeNome ? `Solicitação enviada para ${unidadeNome}!` : 'Solicitação enviada!');
      invalidate();
      getDisplayName(currentUserId).then((nome) => {
        notifyPush([targetUserId], '🔗 Nova solicitação de conexão', `${nome} quer se conectar com você`, 'conexao_solicitada');
      });
    }
    setLoading(false);
    setShowUnidadeDialog(false);
  };

  const handleClickConectar = () => {
    // If a unit name is pre-selected, use it directly
    if (preselectedUnidade) {
      handleConectar(preselectedUnidade);
    } else if (isDono && unidades && unidades.length > 0) {
      setShowUnidadeDialog(true);
    } else {
      handleConectar();
    }
  };

  const handleAceitar = async () => {
    if (!conexao) return;
    setLoading(true);
    await supabase
      .from('rede_conexoes')
      .update({ status: 'aceita' } as any)
      .eq('id', conexao.id);
    toast.success('Conexão aceita!');
    invalidate();
    if (currentUserId) {
      getDisplayName(currentUserId).then((nome) => {
        notifyPush([conexao.solicitante_id], '✅ Conexão aceita', `${nome} aceitou sua solicitação de conexão`, 'conexao_aceita');
      });
    }
    setLoading(false);
  };

  const handleRecusar = async () => {
    if (!conexao) return;
    setLoading(true);
    await supabase
      .from('rede_conexoes')
      .update({ status: 'rejeitada' } as any)
      .eq('id', conexao.id);
    toast.info('Solicitação recusada');
    invalidate();
    setLoading(false);
  };

  const handleDesconectar = async () => {
    if (!conexao) return;
    setLoading(true);
    await supabase
      .from('rede_conexoes')
      .delete()
      .eq('id', conexao.id);
    toast.info('Conexão desfeita');
    invalidate();
    setLoading(false);
  };

  if (loading || statusLoading) {
    return (
      <Button size="sm" disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  if (!conexao) {
    return (
      <>
        <Button size="sm" onClick={handleClickConectar} className="text-white border-0 shadow-sm"
          style={{ backgroundColor: accentColor }}>
          <UserPlus className="w-4 h-4 mr-1" /> Conectar
        </Button>

        {/* Branch selection dialog */}
        <Dialog open={showUnidadeDialog} onOpenChange={setShowUnidadeDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">Escolha a unidade</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-3">
              Selecione a unidade à qual deseja se conectar:
            </p>
            <div className="space-y-2">
              {/* Sede / Main option */}
              <button
                onClick={() => handleConectar('Sede')}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-medium text-foreground">🏫 Sede Principal</p>
              </button>
              {unidades?.map((u, idx) => (
                <button
                  key={idx}
                  onClick={() => handleConectar(u.nome || `Unidade ${idx + 1}`)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-sm font-medium text-foreground">📍 {u.nome || `Unidade ${idx + 1}`}</p>
                  {u.bairro && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{u.bairro}
                    </p>
                  )}
                  {u.endereco && (
                    <p className="text-xs text-muted-foreground mt-0.5">{u.endereco}</p>
                  )}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (conexao.status === 'pendente' && conexao.solicitante_id === currentUserId) {
    return (
      <Button size="sm" variant="secondary" disabled>
        <Clock className="w-4 h-4 mr-1" /> Enviada
        {(conexao as any).unidade_nome && (
          <span className="ml-1 text-[10px] opacity-70">({(conexao as any).unidade_nome})</span>
        )}
      </Button>
    );
  }

  if (conexao.status === 'pendente' && conexao.destinatario_id === currentUserId) {
    return (
      <div className="flex gap-1">
        <Button size="sm" onClick={handleAceitar}>
          Aceitar
        </Button>
        <Button size="sm" variant="outline" onClick={handleRecusar}>
          Recusar
        </Button>
      </div>
    );
  }

  if (conexao.status === 'aceita') {
    return (
      <Button size="sm" variant="secondary" onClick={handleDesconectar} className="group">
        <Check className="w-4 h-4 mr-1 group-hover:hidden" />
        <UserMinus className="w-4 h-4 mr-1 hidden group-hover:inline" />
        <span className="group-hover:hidden">
          Conectado
          {(conexao as any).unidade_nome && (
            <span className="ml-1 text-[10px] opacity-70">({(conexao as any).unidade_nome})</span>
          )}
        </span>
        <span className="hidden group-hover:inline">Desconectar</span>
      </Button>
    );
  }

  // Rejected - allow re-connect
  return (
    <Button size="sm" onClick={handleClickConectar} className="text-white border-0 shadow-sm"
      style={{ backgroundColor: accentColor }}>
      <UserPlus className="w-4 h-4 mr-1" /> Conectar
    </Button>
  );
}
