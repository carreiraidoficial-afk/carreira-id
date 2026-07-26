import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UserPlus, Check, X, Users, MapPin, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { ConectarButton } from './ConectarButton';

function useSearchParaConectar(query: string, meuUserId: string | null) {
  return useQuery({
    queryKey: ['search-para-conectar', query, meuUserId],
    queryFn: async () => {
      const termo = `%${query.trim()}%`;
      const { data: atletas } = await supabase
        .from('perfil_atleta')
        .select('id, user_id, nome, foto_url, slug, modalidade')
        .eq('is_public', true)
        .neq('user_id', meuUserId || '')
        .ilike('nome', termo)
        .limit(10);
      const { data: rede } = await supabase
        .from('perfis_rede')
        .select('id, user_id, nome, tipo, foto_url')
        .neq('user_id', meuUserId || '')
        .ilike('nome', termo)
        .limit(10);
      return [
        ...(atletas || []).map((a) => ({ ...a, tipo: 'Atleta', source: 'atleta' as const })),
        ...(rede || []).map((r) => ({ ...r, source: 'rede' as const })),
      ];
    },
    enabled: query.trim().length >= 2,
  });
}

const TYPE_LABELS: Record<string, string> = {
  professor: 'Professor',
  tecnico: 'Técnico',
  dono_escola: 'Escola de Esportes',
  preparador_fisico: 'Preparador Físico',
  empresario: 'Empresário',
  influenciador: 'Influenciador',
  pai_responsavel: 'Atleta',
  scout: 'Scout',
  agente_clube: 'Agente de Clube',
  fotografo: 'Fotógrafo',
};

interface Props {
  userId: string;
  currentUserId: string | null;
  /** Perfil_atleta ativo (o filho selecionado no seletor de irmãos), quando
   * aplicável -- isola conexões de cada atleta, sem vazar entre irmãos. */
  perfilAtletaId?: string | null;
}

/** Uma linha de conexão pertence ao atleta ativo (ou é legada/sem distinção
 * de irmão, coluna null) -- evita que o vínculo de um irmão vaze pro outro. */
function pertenceAoAtivo(row: any, meuUserId: string, meuPerfilAtletaId: string | null | undefined): boolean {
  const souSolicitante = row.solicitante_id === meuUserId;
  const meuLado = souSolicitante ? row.solicitante_perfil_atleta_id : row.destinatario_perfil_atleta_id;
  return !meuLado || meuLado === meuPerfilAtletaId;
}

export function ConnectionsSection({ userId, currentUserId, perfilAtletaId }: Props) {
  const navigate = useNavigate();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isOwnProfile = userId === currentUserId;
  const { data: searchResults, isLoading: searchLoading } = useSearchParaConectar(searchQuery, currentUserId);

  const { data: connections, isLoading } = useQuery({
    queryKey: ['user-connections', userId, perfilAtletaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rede_conexoes')
        .select('solicitante_id, destinatario_id, unidade_nome, solicitante_perfil_atleta_id, destinatario_perfil_atleta_id')
        .or(`solicitante_id.eq.${userId},destinatario_id.eq.${userId}`)
        .eq('status', 'aceita');
      if (error) throw error;
      const propria = (data || []).filter((row) => pertenceAoAtivo(row, userId, perfilAtletaId));
      const connectionDetails = propria.map(c => {
        const souSolicitante = c.solicitante_id === userId;
        return {
          connectedUserId: souSolicitante ? c.destinatario_id : c.solicitante_id,
          // Perfil ESPECÍFICO do outro lado, quando conhecido -- essencial
          // quando esse user_id tem mais de um perfil_atleta (irmãos), senão
          // a busca abaixo por user_id pode trazer o irmão errado.
          connectedPerfilAtletaId: (souSolicitante ? c.destinatario_perfil_atleta_id : c.solicitante_perfil_atleta_id) || null,
          unidade_nome: (c as any).unidade_nome || null,
        };
      });
      const connectedUserIds = [...new Set(connectionDetails.map(c => c.connectedUserId))];
      if (connectedUserIds.length === 0) return [];
      const { data: redeProfiles } = await supabase
        .from('perfis_rede')
        .select('id, user_id, nome, tipo, foto_url')
        .in('user_id', connectedUserIds);
      const { data: atletaProfiles } = await supabase
        .from('perfil_atleta')
        .select('id, user_id, nome, foto_url, slug')
        .eq('is_public', true)
        .in('user_id', connectedUserIds);
      const redeByUser = new Map((redeProfiles || []).map((p) => [p.user_id, p]));
      const atletaById = new Map((atletaProfiles || []).map((p) => [p.id, { ...p, tipo: 'Atleta' }]));
      const atletaByUserFallback = new Map<string, any>();
      for (const p of (atletaProfiles || [])) {
        if (!atletaByUserFallback.has(p.user_id)) atletaByUserFallback.set(p.user_id, { ...p, tipo: 'Atleta' });
      }
      // Build final list with unidade_nome attached
      return connectionDetails.map(cd => {
        const profile = (cd.connectedPerfilAtletaId && atletaById.get(cd.connectedPerfilAtletaId))
          || redeByUser.get(cd.connectedUserId)
          || atletaByUserFallback.get(cd.connectedUserId);
        if (!profile) return null;
        return { ...profile, unidade_nome: cd.unidade_nome };
      }).filter(Boolean);
    },
  });

  const { data: pendingRequests } = useQuery({
    queryKey: ['pending-connection-requests', userId, perfilAtletaId],
    queryFn: async () => {
      if (!isOwnProfile) return [];
      const { data, error } = await supabase
        .from('rede_conexoes')
        .select('id, solicitante_id, unidade_nome, destinatario_perfil_atleta_id, solicitante_perfil_atleta_id')
        .eq('destinatario_id', userId)
        .eq('status', 'pendente');
      if (error) throw error;
      const minhas = (data || []).filter((r) => !r.destinatario_perfil_atleta_id || r.destinatario_perfil_atleta_id === perfilAtletaId);
      if (minhas.length === 0) return [];
      const senderIds = minhas.map(r => r.solicitante_id);
      const { data: redeProfiles2 } = await supabase
        .from('perfis_rede')
        .select('id, user_id, nome, tipo, foto_url')
        .in('user_id', senderIds);
      const { data: atletaProfiles2 } = await supabase
        .from('perfil_atleta')
        .select('id, user_id, nome, foto_url, slug')
        .eq('is_public', true)
        .in('user_id', senderIds);
      const redeByUser2 = new Map((redeProfiles2 || []).map((p) => [p.user_id, p]));
      const atletaById2 = new Map((atletaProfiles2 || []).map((p) => [p.id, { ...p, tipo: 'Atleta' }]));
      const atletaByUserFallback2 = new Map<string, any>();
      for (const p of (atletaProfiles2 || [])) {
        if (!atletaByUserFallback2.has(p.user_id)) atletaByUserFallback2.set(p.user_id, { ...p, tipo: 'Atleta' });
      }
      // Return one entry per connection row (not per user) so unit info is preserved
      return minhas.map(r => {
        const profile = (r.solicitante_perfil_atleta_id && atletaById2.get(r.solicitante_perfil_atleta_id))
          || redeByUser2.get(r.solicitante_id)
          || atletaByUserFallback2.get(r.solicitante_id);
        if (!profile) return null;
        return {
          ...profile,
          connectionId: r.id,
          unidade_nome: (r as any).unidade_nome || null,
        };
      }).filter(Boolean);
    },
    enabled: isOwnProfile,
  });

  const { data: suggestions } = useQuery({
    queryKey: ['connection-suggestions-smart', userId],
    queryFn: async () => {
      if (!isOwnProfile) return [];
      const { data: existing } = await supabase
        .from('rede_conexoes')
        .select('solicitante_id, destinatario_id')
        .or(`solicitante_id.eq.${userId},destinatario_id.eq.${userId}`);
      const connectedIds = new Set(
        (existing || []).flatMap(c => [c.solicitante_id, c.destinatario_id])
      );
      connectedIds.add(userId);
      const { data: redeData } = await supabase
        .from('perfis_rede')
        .select('id, user_id, nome, tipo, foto_url, dados_perfil')
        .limit(50);
      const { data: atletaData } = await supabase
        .from('perfil_atleta')
        .select('id, user_id, nome, foto_url, slug, modalidade')
        .eq('is_public', true)
        .limit(30);
      const redeProfiles = (redeData || []).filter(p => !connectedIds.has(p.user_id)).map(p => ({ ...p, source: 'rede' as const }));
      const atletaProfiles = (atletaData || []).filter(p => !connectedIds.has(p.user_id)).map(p => ({ ...p, tipo: 'Atleta', source: 'atleta' as const }));
      const suggestMap = new Map<string, any>();
      for (const p of redeProfiles) {
        suggestMap.set(p.user_id, p);
      }
      for (const p of atletaProfiles) {
        const existing = suggestMap.get(p.user_id);
        if (!existing) {
          suggestMap.set(p.user_id, p);
        } else {
          suggestMap.set(p.user_id, {
            ...existing,
            foto_url: existing.foto_url || p.foto_url,
          });
        }
      }
      return Array.from(suggestMap.values()).slice(0, 8);
    },
    enabled: isOwnProfile,
  });

  const queryClient = useQueryClient();

  const invalidateConnections = () => {
    queryClient.invalidateQueries({ queryKey: ['user-connections', userId] });
    queryClient.invalidateQueries({ queryKey: ['pending-connection-requests', userId] });
    queryClient.invalidateQueries({ queryKey: ['connection-suggestions-smart', userId] });
    queryClient.invalidateQueries({ queryKey: ['conexoes-count', userId] });
    queryClient.invalidateQueries({ queryKey: ['conexao-status'] });
    queryClient.invalidateQueries({ queryKey: ['profile-connections-list'] });
    queryClient.invalidateQueries({ queryKey: ['connections-count'] });
  };

  const handleAccept = async (connectionId: string) => {
    setRespondingId(connectionId);
    const { error } = await supabase
      .from('rede_conexoes')
      .update({ status: 'aceita' } as any)
      .eq('id', connectionId);
    if (error) toast.error('Erro ao aceitar');
    else { toast.success('Conexão aceita!'); invalidateConnections(); }
    setRespondingId(null);
  };

  const handleReject = async (connectionId: string) => {
    setRespondingId(connectionId);
    const { error } = await supabase
      .from('rede_conexoes')
      .delete()
      .eq('id', connectionId);
    if (error) toast.error('Erro ao recusar');
    else { toast.success('Solicitação recusada'); invalidateConnections(); }
    setRespondingId(null);
  };

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const handleConnect = async (targetUserId: string) => {
    if (!currentUserId) return;
    setConnectingId(targetUserId);
    try {
      const { error } = await supabase.from('rede_conexoes').insert({
        solicitante_id: currentUserId,
        destinatario_id: targetUserId,
        status: 'pendente',
        solicitante_perfil_atleta_id: perfilAtletaId || null,
      } as any);
      if (error) throw error;
      toast.success('Solicitação enviada!');
      invalidateConnections();
    } catch {
      toast.error('Erro ao conectar');
    }
    setConnectingId(null);
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Buscar pessoas pra conectar */}
      {isOwnProfile && (
        <div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar atletas ou pessoas na rede pra conectar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {searchQuery.trim().length >= 2 && (
            <div className="mt-2 space-y-2">
              {searchLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : searchResults && searchResults.length > 0 ? (
                searchResults.map((person: any) => (
                  <Card key={`${person.source}-${person.id}`} className="flex items-center gap-3 p-3">
                    {person.foto_url ? (
                      <img src={person.foto_url} alt="" className="w-9 h-9 rounded-full object-cover cursor-pointer" onClick={() => navigate(carreiraPath(`/${person.slug || `perfil/${person.user_id}`}`))} />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground cursor-pointer" onClick={() => navigate(carreiraPath(`/${person.slug || `perfil/${person.user_id}`}`))}>
                        {person.nome?.[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate cursor-pointer hover:underline" onClick={() => navigate(carreiraPath(`/${person.slug || `perfil/${person.user_id}`}`))}>{person.nome}</p>
                      <p className="text-xs text-muted-foreground">{person.source === 'atleta' ? (person.modalidade || 'Atleta') : (TYPE_LABELS[person.tipo] || person.tipo)}</p>
                    </div>
                    <ConectarButton
                      targetUserId={person.user_id}
                      currentUserId={currentUserId}
                      targetPerfilAtletaId={person.source === 'atleta' ? person.id : undefined}
                      sourcePerfilAtletaId={perfilAtletaId}
                    />
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum resultado encontrado</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pending requests */}
      {isOwnProfile && pendingRequests && pendingRequests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            Solicitações pendentes ({pendingRequests.length})
          </h3>
          <div className="space-y-2">
            {pendingRequests.map((person) => (
              <Card key={person.id} className="flex items-center gap-3 p-3">
                {person.foto_url ? (
                  <img src={person.foto_url} alt="" className="w-10 h-10 rounded-full object-cover cursor-pointer" onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))} />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground cursor-pointer" onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))}>
                    {person.nome?.[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate cursor-pointer hover:underline" onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))}>{person.nome}</p>
                  <p className="text-xs text-muted-foreground">{TYPE_LABELS[person.tipo] || person.tipo}</p>
                  {person.unidade_nome && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                      <MapPin className="w-2.5 h-2.5" />{person.unidade_nome}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="default" className="h-8" disabled={respondingId === person.connectionId} onClick={() => person.connectionId && handleAccept(person.connectionId)}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Aceitar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" disabled={respondingId === person.connectionId} onClick={() => person.connectionId && handleReject(person.connectionId)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Connections */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          <Users className="w-4 h-4 inline mr-1.5" />
          Conexões ({connections?.length || 0})
        </h3>
        {connections && connections.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {connections.map((person) => (
              <Card
                key={person.id}
                className="flex items-center gap-3 p-3 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))}
              >
                {person.foto_url ? (
                  <img src={person.foto_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                    {person.nome?.[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{person.nome}</p>
                  <p className="text-xs text-muted-foreground">{TYPE_LABELS[person.tipo] || person.tipo}</p>
                  {person.unidade_nome && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                      <MapPin className="w-2.5 h-2.5" />{person.unidade_nome}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <Users className="w-8 h-8 mx-auto opacity-30 mb-2" />
            <p>Nenhuma conexão ainda</p>
          </Card>
        )}
      </div>

      {/* Suggestions */}
      {isOwnProfile && suggestions && suggestions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            <UserPlus className="w-4 h-4 inline mr-1.5" />
            Pessoas que você pode conhecer
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestions.map((person) => (
              <Card key={person.id} className="flex items-center gap-3 p-3">
                {person.foto_url ? (
                  <img src={person.foto_url} alt="" className="w-10 h-10 rounded-full object-cover cursor-pointer" onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))} />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground cursor-pointer" onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))}>
                    {person.nome?.[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate cursor-pointer hover:underline" onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))}>{person.nome}</p>
                  <p className="text-xs text-muted-foreground">{TYPE_LABELS[person.tipo] || person.tipo}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={connectingId === person.user_id}
                  onClick={() => handleConnect(person.user_id)}
                >
                  {connectingId === person.user_id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <><UserPlus className="w-3 h-3 mr-0.5" /> Conectar</>
                  )}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
