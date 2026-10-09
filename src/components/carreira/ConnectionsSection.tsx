import { useQuery, useQueryClient } from '@tanstack/react-query';
import { plataformaUserIds, conexaoComPlataforma, ehPerfilPlataforma } from '@/lib/perfil-plataforma';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { telefoneParaWhatsapp } from '@/lib/form-validators';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UserPlus, Check, X, Users, MapPin, Search, Heart, Inbox, MessageCircle, Zap, Briefcase, Link2, UserMinus } from 'lucide-react';
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
        .select('id, user_id, nome, foto_url, slug, modalidade, cidade, estado')
        .eq('is_public', true)
        .neq('user_id', meuUserId || '')
        .ilike('nome', termo)
        .limit(10);
      const { data: rede } = await supabase
        .from('perfis_rede')
        .select('id, user_id, nome, tipo, foto_url, cidade, estado')
        .neq('user_id', meuUserId || '')
        .ilike('nome', termo)
        .limit(10);
      return [
        ...(atletas || []).filter((a) => !ehPerfilPlataforma(a)).map((a) => ({ ...a, tipo: 'Atleta', source: 'atleta' as const })),
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
  jogador_profissional: 'Jogador Profissional',
  scout: 'Scout',
  agente_clube: 'Agente de Clube',
  fotografo: 'Fotógrafo',
  torcedor: 'Torcedor',
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

/** Linha padrão de pessoa (avatar + nome + subtítulo + cidade), igual em
 * todas as listas da tela -- só muda o que vai em `action` à direita. */
function PersonRow({
  fotoUrl, nome, subtitle, cidade, estado, onClick, action,
}: {
  fotoUrl?: string | null;
  nome: string;
  subtitle?: string;
  cidade?: string | null;
  estado?: string | null;
  onClick?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <Card
      className={`flex items-center gap-3 p-3 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      {fotoUrl ? (
        <img src={fotoUrl} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
          {nome?.[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{nome}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        {(cidade || estado) && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
            <MapPin className="w-2.5 h-2.5" />{[cidade, estado].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
      {action && <div onClick={(e) => e.stopPropagation()} className="shrink-0">{action}</div>}
    </Card>
  );
}

/** Ícone/cor do selo no card de sugestão -- azul pra atleta, roxo pra
 * escola/clube, laranja pra profissional individual (técnico, professor
 * etc.), só pra diferenciar visualmente de relance. */
function getSuggestionBadge(person: { source?: 'atleta' | 'rede'; tipo?: string }) {
  if (person.source === 'atleta') return { Icon: Zap, color: '#3b82f6' };
  if (person.tipo === 'dono_escola' || person.tipo === 'agente_clube') return { Icon: Briefcase, color: '#8b5cf6' };
  return { Icon: Link2, color: '#f97316' };
}

/** Botão de mensagem via WhatsApp -- só existe pra perfil profissional que
 * ativou o campo "WhatsApp público" nas Configurações. Atleta (responsável)
 * não tem contato público hoje, de propósito (dado de menor de idade), então
 * não tem "Mensagem" nesse caso -- ver decisão registrada na memória do
 * projeto. */
function MensagemButton({ whatsappPublico, telefoneWhatsapp }: { whatsappPublico?: boolean; telefoneWhatsapp?: string | null }) {
  if (!whatsappPublico || !telefoneWhatsapp) return null;
  const intl = telefoneParaWhatsapp(telefoneWhatsapp);
  return (
    <a href={`https://wa.me/${intl}`} target="_blank" rel="noopener noreferrer">
      <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
        <MessageCircle className="w-3.5 h-3.5" /> Mensagem
      </Button>
    </a>
  );
}

export function ConnectionsSection({ userId, currentUserId, perfilAtletaId }: Props) {
  const navigate = useNavigate();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [paraDesconectar, setParaDesconectar] = useState<{ conexaoId: string; nome: string } | null>(null);
  const [desconectando, setDesconectando] = useState(false);

  const isOwnProfile = userId === currentUserId;
  const { data: searchResults, isLoading: searchLoading } = useSearchParaConectar(searchQuery, currentUserId);

  const { data: connections, isLoading } = useQuery({
    queryKey: ['user-connections', userId, perfilAtletaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rede_conexoes')
        .select('id, solicitante_id, destinatario_id, unidade_nome, solicitante_perfil_atleta_id, destinatario_perfil_atleta_id')
        .or(`solicitante_id.eq.${userId},destinatario_id.eq.${userId}`)
        .eq('status', 'aceita');
      if (error) throw error;
      const plataforma = await plataformaUserIds();
      const propria = (data || []).filter((row) => pertenceAoAtivo(row, userId, perfilAtletaId) && !conexaoComPlataforma(row, userId, plataforma));
      const connectionDetails = propria.map(c => {
        const souSolicitante = c.solicitante_id === userId;
        return {
          conexaoId: c.id as string,
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
        .select('id, user_id, nome, tipo, foto_url, cidade, estado, telefone_whatsapp, whatsapp_publico')
        .in('user_id', connectedUserIds);
      const { data: atletaProfiles } = await supabase
        .from('perfil_atleta')
        .select('id, user_id, nome, foto_url, slug, cidade, estado')
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
        return { ...profile, unidade_nome: cd.unidade_nome, conexaoId: cd.conexaoId };
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
      const plataformaPend = await plataformaUserIds();
      const minhas = (data || []).filter((r) => (!r.destinatario_perfil_atleta_id || r.destinatario_perfil_atleta_id === perfilAtletaId) && !plataformaPend.has(r.solicitante_id));
      if (minhas.length === 0) return [];
      const senderIds = minhas.map(r => r.solicitante_id);
      const { data: redeProfiles2 } = await supabase
        .from('perfis_rede')
        .select('id, user_id, nome, tipo, foto_url, cidade, estado')
        .in('user_id', senderIds);
      const { data: atletaProfiles2 } = await supabase
        .from('perfil_atleta')
        .select('id, user_id, nome, foto_url, slug, cidade, estado')
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
        .select('id, user_id, nome, tipo, foto_url, cidade, estado, dados_perfil')
        .limit(50);
      const { data: atletaData } = await supabase
        .from('perfil_atleta')
        .select('id, user_id, nome, foto_url, slug, modalidade, cidade, estado')
        .eq('is_public', true)
        .limit(30);
      const redeProfiles = (redeData || []).filter(p => !connectedIds.has(p.user_id)).map(p => ({ ...p, source: 'rede' as const }));
      const atletaProfiles = (atletaData || []).filter(p => !connectedIds.has(p.user_id) && !ehPerfilPlataforma(p)).map(p => ({ ...p, tipo: 'Atleta', source: 'atleta' as const }));
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

  // Torcedores/Torcendo são a mesma tabela (atleta_follows), só invertendo
  // de qual lado se consulta -- ver [[carreira-id]] decisão de unificar
  // Seguidor e Torcedor num conceito só.
  const { data: torcedores, isLoading: torcedoresLoading } = useQuery({
    queryKey: ['perfil-torcedores', perfilAtletaId],
    queryFn: async () => {
      if (!perfilAtletaId) return [];
      const { data: follows, error } = await supabase
        .from('atleta_follows')
        .select('follower_id, created_at')
        .eq('following_perfil_id', perfilAtletaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!follows || follows.length === 0) return [];
      const followerIds = follows.map((f) => f.follower_id);
      const { data: redeProfiles } = await supabase
        .from('perfis_rede').select('user_id, nome, foto_url, tipo, cidade, estado, telefone_whatsapp, whatsapp_publico').in('user_id', followerIds);
      const { data: atletaProfiles } = await supabase
        .from('perfil_atleta').select('user_id, nome, foto_url, slug, cidade, estado').in('user_id', followerIds);
      const redeMap = new Map((redeProfiles || []).map((p) => [p.user_id, p]));
      const atletaMap = new Map((atletaProfiles || []).map((p) => [p.user_id, p]));
      return follows.map((f) => {
        const rede = redeMap.get(f.follower_id);
        const atleta = atletaMap.get(f.follower_id);
        return {
          user_id: f.follower_id,
          nome: rede?.nome || atleta?.nome || 'Usuário',
          foto_url: rede?.foto_url || atleta?.foto_url || null,
          tipo: rede?.tipo || 'Atleta',
          cidade: rede?.cidade || atleta?.cidade || null,
          estado: rede?.estado || atleta?.estado || null,
          telefone_whatsapp: rede?.telefone_whatsapp || null,
          whatsapp_publico: rede?.whatsapp_publico || false,
        };
      });
    },
    enabled: isOwnProfile && !!perfilAtletaId,
  });

  const { data: torcendo, isLoading: torcendoLoading } = useQuery({
    queryKey: ['meus-torcendo', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      const { data: follows, error } = await supabase
        .from('atleta_follows')
        .select('following_perfil_id, created_at')
        .eq('follower_id', currentUserId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!follows || follows.length === 0) return [];
      const perfilIds = follows.map((f) => f.following_perfil_id);
      const { data: atletaProfiles } = await supabase
        .from('perfil_atleta').select('id, nome, foto_url, slug, cidade, estado').in('id', perfilIds);
      const atletaMap = new Map((atletaProfiles || []).map((p) => [p.id, p]));
      return follows
        .map((f) => atletaMap.get(f.following_perfil_id))
        .filter((p): p is NonNullable<typeof p> => !!p);
    },
    enabled: isOwnProfile && !!currentUserId,
  });

  const [activeTab, setActiveTab] = useState<'todas' | 'torcedores' | 'torcendo' | 'solicitacoes'>('todas');
  const [mostrarTodasSugestoes, setMostrarTodasSugestoes] = useState(false);
  const [sugestoesDispensadas, setSugestoesDispensadas] = useState<Set<string>>(new Set());
  const SUGESTOES_PREVIEW = 3;

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

  // Qualquer perfil pode desfazer uma conexão aceita (atleta que saiu da escola, ex-aluno, etc.).
  // O .select('id') existe porque RLS que bloqueia devolve 0 linhas sem erro.
  const handleDesconectar = async () => {
    if (!paraDesconectar) return;
    setDesconectando(true);
    const { data, error } = await supabase
      .from('rede_conexoes')
      .delete()
      .eq('id', paraDesconectar.conexaoId)
      .select('id');
    setDesconectando(false);
    if (error || !data || data.length === 0) {
      toast.error('Não foi possível desconectar. Tente novamente.');
      return;
    }
    toast.success('Conexão desfeita');
    setParaDesconectar(null);
    invalidateConnections();
    queryClient.invalidateQueries({ queryKey: ['comunidade-escola'] });
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
    <div className="space-y-4">
      {/* Abas */}
      {isOwnProfile && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {([
            { value: 'todas' as const, label: 'Todas', icon: Users, count: connections?.length || 0 },
            { value: 'torcedores' as const, label: 'Torcedores', icon: Heart, count: torcedores?.length || 0 },
            { value: 'torcendo' as const, label: 'Torcendo', icon: Heart, count: torcendo?.length || 0 },
            { value: 'solicitacoes' as const, label: 'Solicitações', icon: Inbox, count: pendingRequests?.length || 0 },
          ]).map(({ value, label, icon: Icon, count }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold rounded-full border px-3 py-1.5 transition-colors ${
                activeTab === value
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count > 0 && <span className="text-[10px] opacity-70">({count})</span>}
            </button>
          ))}
        </div>
      )}

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
                  <PersonRow
                    key={`${person.source}-${person.id}`}
                    fotoUrl={person.foto_url}
                    nome={person.nome}
                    subtitle={person.source === 'atleta' ? (person.modalidade || 'Atleta') : (TYPE_LABELS[person.tipo] || person.tipo)}
                    cidade={person.cidade}
                    estado={person.estado}
                    onClick={() => navigate(carreiraPath(`/${person.slug || `perfil/${person.user_id}`}`))}
                    action={
                      <ConectarButton
                        targetUserId={person.user_id}
                        currentUserId={currentUserId}
                        targetPerfilAtletaId={person.source === 'atleta' ? person.id : undefined}
                        sourcePerfilAtletaId={perfilAtletaId}
                      />
                    }
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum resultado encontrado</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Solicitações pendentes */}
      {isOwnProfile && activeTab === 'solicitacoes' && (
        pendingRequests && pendingRequests.length > 0 ? (
          <div className="space-y-2">
            {pendingRequests.map((person) => (
              <PersonRow
                key={person.id}
                fotoUrl={person.foto_url}
                nome={person.nome}
                subtitle={TYPE_LABELS[person.tipo] || person.tipo}
                cidade={person.cidade}
                estado={person.estado}
                onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))}
                action={
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" className="h-8" disabled={respondingId === person.connectionId} onClick={() => person.connectionId && handleAccept(person.connectionId)}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Aceitar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" disabled={respondingId === person.connectionId} onClick={() => person.connectionId && handleReject(person.connectionId)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <Inbox className="w-8 h-8 mx-auto opacity-30 mb-2" />
            <p>Nenhuma solicitação pendente</p>
          </Card>
        )
      )}

      {/* Torcedores (quem torce por você) */}
      {isOwnProfile && activeTab === 'torcedores' && (
        torcedoresLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : torcedores && torcedores.length > 0 ? (
          <div className="space-y-2">
            {torcedores.map((person) => (
              <PersonRow
                key={person.user_id}
                fotoUrl={person.foto_url}
                nome={person.nome}
                subtitle={TYPE_LABELS[person.tipo] || person.tipo}
                cidade={person.cidade}
                estado={person.estado}
                onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))}
                action={<MensagemButton whatsappPublico={person.whatsapp_publico} telefoneWhatsapp={person.telefone_whatsapp} />}
              />
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <Heart className="w-8 h-8 mx-auto opacity-30 mb-2" />
            <p>Ninguém torcendo ainda</p>
          </Card>
        )
      )}

      {/* Torcendo (atletas que você torce) */}
      {isOwnProfile && activeTab === 'torcendo' && (
        torcendoLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : torcendo && torcendo.length > 0 ? (
          <div className="space-y-2">
            {torcendo.map((atleta) => (
              <PersonRow
                key={atleta.id}
                fotoUrl={atleta.foto_url}
                nome={atleta.nome}
                subtitle="Atleta"
                cidade={atleta.cidade}
                estado={atleta.estado}
                onClick={() => navigate(carreiraPath(atleta.slug ? `/${atleta.slug}` : `/perfil/${atleta.id}`))}
              />
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <Heart className="w-8 h-8 mx-auto opacity-30 mb-2" />
            <p>Você ainda não está torcendo por ninguém</p>
          </Card>
        )
      )}

      {(!isOwnProfile || activeTab === 'todas') && (
        <>
          {/* Suggestions */}
          {isOwnProfile && (() => {
            const visiveis = (suggestions || []).filter((p) => !sugestoesDispensadas.has(p.id));
            if (visiveis.length === 0) return null;
            return (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Sugestões para você
                </h3>
                {visiveis.length > SUGESTOES_PREVIEW && (
                  <button
                    onClick={() => setMostrarTodasSugestoes((v) => !v)}
                    className="text-xs font-medium text-primary hover:underline shrink-0 flex items-center gap-0.5"
                  >
                    {mostrarTodasSugestoes ? 'Ver menos' : 'Ver todas'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(mostrarTodasSugestoes ? visiveis : visiveis.slice(0, SUGESTOES_PREVIEW)).map((person) => {
                  const badge = getSuggestionBadge(person);
                  return (
                    <div key={person.id} className="relative bg-card border border-border rounded-xl p-2.5 text-center">
                      <button
                        onClick={() => setSugestoesDispensadas((s) => new Set(s).add(person.id))}
                        className="absolute top-1 right-1 text-muted-foreground hover:text-foreground p-0.5"
                        aria-label="Dispensar sugestão"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => navigate(carreiraPath(`/${person.slug || `perfil/${person.user_id}`}`))}
                        className="relative w-12 h-12 mx-auto block"
                      >
                        {person.foto_url ? (
                          <img src={person.foto_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                            {person.nome?.[0]}
                          </div>
                        )}
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-card"
                          style={{ backgroundColor: badge.color }}
                        >
                          <badge.Icon className="w-2.5 h-2.5 text-white" />
                        </span>
                      </button>
                      <p className="text-xs font-semibold mt-1.5 truncate">{person.nome}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{TYPE_LABELS[person.tipo] || person.tipo}</p>
                      {(person.cidade || person.estado) && (
                        <p className="text-[9px] text-muted-foreground truncate flex items-center justify-center gap-0.5 mt-0.5">
                          <MapPin className="w-2 h-2 shrink-0" />{[person.cidade, person.estado].filter(Boolean).join(', ')}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-[10px] mt-2 px-1"
                        disabled={connectingId === person.user_id}
                        onClick={() => handleConnect(person.user_id)}
                      >
                        {connectingId === person.user_id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <><UserPlus className="w-3 h-3 mr-0.5" /> Conectar</>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })()}

          {/* Connections */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              <Users className="w-4 h-4 inline mr-1.5" />
              Suas conexões ({connections?.length || 0})
            </h3>
            {connections && connections.length > 0 ? (
              <div className="space-y-2">
                {connections.map((person) => (
                  <PersonRow
                    key={person.id}
                    fotoUrl={person.foto_url}
                    nome={person.nome}
                    subtitle={person.unidade_nome ? `${TYPE_LABELS[person.tipo] || person.tipo} · ${person.unidade_nome}` : (TYPE_LABELS[person.tipo] || person.tipo)}
                    cidade={person.cidade}
                    estado={person.estado}
                    onClick={() => navigate(carreiraPath(`/perfil/${person.user_id}`))}
                    action={(
                      <div className="flex items-center gap-1.5">
                        <MensagemButton whatsappPublico={person.whatsapp_publico} telefoneWhatsapp={person.telefone_whatsapp} />
                        {isOwnProfile && person.conexaoId && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            title="Desconectar"
                            aria-label={`Desconectar de ${person.nome}`}
                            onClick={() => setParaDesconectar({ conexaoId: person.conexaoId, nome: person.nome })}
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                <Users className="w-8 h-8 mx-auto opacity-30 mb-2" />
                <p>Nenhuma conexão ainda</p>
              </Card>
            )}
          </div>
        </>
      )}

      <AlertDialog open={!!paraDesconectar} onOpenChange={(aberto) => { if (!aberto && !desconectando) setParaDesconectar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar de {paraDesconectar?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              A conexão é desfeita dos dois lados. Os perfis continuam existindo, e vocês podem se conectar de novo depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desconectando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={desconectando}
              onClick={(e) => { e.preventDefault(); handleDesconectar(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {desconectando ? 'Desconectando…' : 'Desconectar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
