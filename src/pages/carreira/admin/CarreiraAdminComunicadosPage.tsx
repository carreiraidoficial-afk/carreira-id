import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminCarreiraComunicados, useCreateCarreiraComunicado, useToggleCarreiraComunicado, useDeleteCarreiraComunicado } from '@/hooks/useCarreiraComunicadosData';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Megaphone, Trash2, Send, Eye, EyeOff, Bell, Users, User as UserIcon, Search, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PROFILE_TYPES = [
  { value: 'atleta_filho', label: 'Atleta' },
  { value: 'professor', label: 'Professor' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'dono_escola', label: 'Escola de Esportes' },
  { value: 'preparador_fisico', label: 'Preparador Físico' },
  { value: 'empresario', label: 'Empresário' },
  { value: 'scout', label: 'Scout' },
  { value: 'agente_clube', label: 'Agente de Clube' },
  { value: 'pai_responsavel', label: 'Pai/Responsável' },
  { value: 'torcedor', label: 'Torcedor' },
  { value: 'fotografo', label: 'Fotógrafo' },
  { value: 'influenciador', label: 'Influenciador' },
];

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  informativo: { label: 'Informativo', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  importante: { label: 'Importante', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

interface PessoaResultado {
  user_id: string;
  nome: string;
  tipo: string; // 'atleta' | tipo de perfis_rede
}

function useAdminSearchPessoa(query: string) {
  return useQuery({
    queryKey: ['admin-search-pessoa', query],
    queryFn: async (): Promise<PessoaResultado[]> => {
      if (query.length < 2) return [];
      const term = `%${query}%`;
      const [{ data: atletas }, { data: rede }] = await Promise.all([
        supabase.from('perfil_atleta').select('user_id, nome').ilike('nome', term).limit(8),
        supabase.from('perfis_rede').select('user_id, nome, tipo').ilike('nome', term).limit(8),
      ]);
      const results: PessoaResultado[] = [
        ...(atletas || []).map((a: any) => ({ user_id: a.user_id, nome: a.nome, tipo: 'atleta' })),
        ...(rede || []).map((r: any) => ({ user_id: r.user_id, nome: r.nome, tipo: r.tipo })),
      ];
      // Remove duplicados (mesma pessoa pode ter perfil_atleta e perfis_rede)
      const seen = new Set<string>();
      return results.filter((r) => {
        if (seen.has(r.user_id)) return false;
        seen.add(r.user_id);
        return true;
      });
    },
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

function PessoaAutocomplete({ value, onChange }: { value: string; onChange: (userId: string) => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PessoaResultado | null>(null);
  const [open, setOpen] = useState(false);
  const { data: results = [], isFetching } = useAdminSearchPessoa(query);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={selected ? selected.nome : query}
          onChange={(e) => {
            setSelected(null);
            onChange('');
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Digite o nome da pessoa..."
          className="pl-9 pr-9"
        />
        {selected && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setSelected(null); setQuery(''); onChange(''); }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {open && !selected && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
          {isFetching ? (
            <div className="p-3 text-xs text-muted-foreground">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">Nenhuma pessoa encontrada com esse nome.</div>
          ) : (
            results.map((r) => (
              <button
                key={r.user_id}
                type="button"
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                onClick={() => {
                  setSelected(r);
                  setOpen(false);
                  onChange(r.user_id);
                }}
              >
                <span>{r.nome}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{r.tipo}</Badge>
              </button>
            ))
          )}
        </div>
      )}
      {value && (
        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
          <Check className="w-3 h-3 text-emerald-500" /> Selecionado
        </p>
      )}
    </div>
  );
}

export default function CarreiraAdminComunicadosPage() {
  const { user } = useAuth();
  const { data: comunicados = [], isLoading } = useAdminCarreiraComunicados();
  const createMutation = useCreateCarreiraComunicado();
  const toggleMutation = useToggleCarreiraComunicado();
  const deleteMutation = useDeleteCarreiraComunicado();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [tipo, setTipo] = useState('informativo');
  const [destinatarioTipo, setDestinatarioTipo] = useState('todos');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [individualUserId, setIndividualUserId] = useState('');
  const [enviarPush, setEnviarPush] = useState(true);

  const resetForm = () => {
    setTitulo('');
    setMensagem('');
    setTipo('informativo');
    setDestinatarioTipo('todos');
    setSelectedTypes([]);
    setIndividualUserId('');
    setEnviarPush(true);
  };

  const handleCreate = async () => {
    if (!titulo.trim() || !mensagem.trim() || !user) return;

    let filtro: any = {};
    if (destinatarioTipo === 'tipo_perfil') {
      filtro = { tipos: selectedTypes };
    } else if (destinatarioTipo === 'individual') {
      filtro = { user_id: individualUserId.trim() };
    }

    try {
      await createMutation.mutateAsync({
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        tipo,
        destinatario_tipo: destinatarioTipo,
        destinatario_filtro: filtro,
        enviar_push: enviarPush,
        criado_por: user.id,
      });

      // Send push notification if enabled
      if (enviarPush) {
        try {
          const { data: pushResult, error: pushError } = await supabase.functions.invoke('send-carreira-push', {
            body: {
              title: titulo.trim(),
              body: mensagem.trim(),
              url: '/carreira',
              tag: `comunicado-${tipo}`,
              destinatario_tipo: destinatarioTipo,
              destinatario_filtro: filtro,
              category: 'comunicado_push',
            },
          });
          if (pushError) {
            console.error('Push error:', pushError);
            toast.warning('Comunicado salvo, mas houve erro no push');
          } else {
            toast.success(`Comunicado enviado! Push: ${pushResult?.sent || 0} enviados`);
          }
        } catch (pushErr) {
          console.error('Push invoke error:', pushErr);
          toast.warning('Comunicado salvo, mas push falhou');
        }
      } else {
        toast.success('Comunicado enviado com sucesso!');
      }

      resetForm();
      setDialogOpen(false);
    } catch (err: any) {
      toast.error('Erro ao enviar: ' + err.message);
    }
  };

  const getDestinatarioLabel = (c: any) => {
    if (c.destinatario_tipo === 'todos') return 'Todos';
    if (c.destinatario_tipo === 'tipo_perfil') {
      const tipos = c.destinatario_filtro?.tipos || [];
      return tipos.map((t: string) => PROFILE_TYPES.find(p => p.value === t)?.label || t).join(', ');
    }
    if (c.destinatario_tipo === 'individual') return `Usuário: ${c.destinatario_filtro?.user_id?.slice(0, 8)}...`;
    return c.destinatario_tipo;
  };

  return (
    <CarreiraAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Comunicados</h1>
            <p className="text-muted-foreground text-sm">Envie avisos e notificações para os usuários da rede</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Comunicado</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5" /> Novo Comunicado</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Título</Label>
                  <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título do comunicado" />
                </div>
                <div>
                  <Label>Mensagem</Label>
                  <Textarea value={mensagem} onChange={e => setMensagem(e.target.value)} placeholder="Mensagem do comunicado..." rows={4} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="informativo">📘 Informativo</SelectItem>
                      <SelectItem value="importante">⚠️ Importante</SelectItem>
                      <SelectItem value="urgente">🚨 Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Destinatários</Label>
                  <Select value={destinatarioTipo} onValueChange={setDestinatarioTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">👥 Todos os usuários</SelectItem>
                      <SelectItem value="tipo_perfil">🎯 Por tipo de perfil</SelectItem>
                      <SelectItem value="individual">👤 Usuário individual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {destinatarioTipo === 'tipo_perfil' && (
                  <div className="space-y-2 border rounded-lg p-3">
                    <Label className="text-xs text-muted-foreground">Selecione os tipos de perfil:</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {PROFILE_TYPES.map(pt => (
                        <label key={pt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={selectedTypes.includes(pt.value)}
                            onCheckedChange={(checked) => {
                              setSelectedTypes(prev =>
                                checked ? [...prev, pt.value] : prev.filter(t => t !== pt.value)
                              );
                            }}
                          />
                          {pt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {destinatarioTipo === 'individual' && (
                  <div>
                    <Label>Destinatário</Label>
                    <PessoaAutocomplete value={individualUserId} onChange={setIndividualUserId} />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Switch checked={enviarPush} onCheckedChange={setEnviarPush} />
                  <Label className="flex items-center gap-1.5">
                    <Bell className="w-4 h-4" /> Enviar notificação push
                  </Label>
                </div>

                <Button onClick={handleCreate} disabled={createMutation.isPending || !titulo.trim() || !mensagem.trim()} className="w-full gap-2">
                  <Send className="w-4 h-4" /> {createMutation.isPending ? 'Enviando...' : 'Enviar Comunicado'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : comunicados.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum comunicado enviado ainda.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {comunicados.map(c => {
              const tipoInfo = TIPO_LABELS[c.tipo] || TIPO_LABELS.informativo;
              return (
                <Card key={c.id} className={!c.ativo ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-sm">{c.titulo}</h3>
                          <Badge variant="outline" className={`text-[10px] ${tipoInfo.color}`}>{tipoInfo.label}</Badge>
                          {c.enviar_push && <Badge variant="outline" className="text-[10px] gap-0.5"><Bell className="w-2.5 h-2.5" /> Push</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{c.mensagem}</p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {c.destinatario_tipo === 'todos' ? <Users className="w-3 h-3" /> : c.destinatario_tipo === 'individual' ? <UserIcon className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                            {getDestinatarioLabel(c)}
                          </span>
                          <span>{format(new Date(c.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title={c.ativo ? 'Desativar' : 'Ativar'}
                          onClick={() => toggleMutation.mutate({ id: c.id, ativo: !c.ativo })}>
                          {c.ativo ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir"
                          onClick={() => { if (confirm('Excluir este comunicado?')) deleteMutation.mutate(c.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </CarreiraAdminLayout>
  );
}
