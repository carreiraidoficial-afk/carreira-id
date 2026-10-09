import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';
import { dataLocalISO } from '@/lib/datas';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Ticket, Trash2, Pencil, Users, Handshake, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const LIMITE_ESCOLAS_PARCEIRAS = 20;
const SEM_ESCOLA = '__none__';

interface Cupom {
  id: string;
  codigo: string;
  nome_titular: string;
  dias_trial: number;
  ativo: boolean;
  validade: string | null;
  usos: number;
  perfil_rede_id: string | null;
  escola_nome?: string | null;
}

interface EscolaOpcao {
  id: string;
  nome: string;
}

export default function CarreiraAdminCuponsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Cupom | null>(null);

  const [codigo, setCodigo] = useState('');
  const [nomeTitular, setNomeTitular] = useState('');
  const [diasTrial, setDiasTrial] = useState('30');
  const [validade, setValidade] = useState('');
  const [verUsosDe, setVerUsosDe] = useState<{ id: string; codigo: string } | null>(null);
  const [perfilRedeId, setPerfilRedeId] = useState<string>(SEM_ESCOLA);

  const { data: cupons = [], isLoading } = useQuery({
    queryKey: ['admin-cupons'],
    queryFn: async () => {
      const { data: cuponsData, error } = await supabase
        .from('carreira_cupons' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: usosData } = await supabase
        .from('carreira_assinaturas' as any)
        .select('cupom_id')
        .not('cupom_id', 'is', null);

      const usosPorCupom = new Map<string, number>();
      (usosData || []).forEach((row: any) => {
        usosPorCupom.set(row.cupom_id, (usosPorCupom.get(row.cupom_id) || 0) + 1);
      });

      const escolaIds = (cuponsData || []).map((c: any) => c.perfil_rede_id).filter(Boolean);
      const nomesPorEscola = new Map<string, string>();
      if (escolaIds.length > 0) {
        const { data: escolasData } = await supabase
          .from('perfis_rede' as any)
          .select('id, nome')
          .in('id', escolaIds);
        (escolasData || []).forEach((e: any) => nomesPorEscola.set(e.id, e.nome));
      }

      return (cuponsData || []).map((c: any) => ({
        ...c,
        usos: usosPorCupom.get(c.id) || 0,
        escola_nome: c.perfil_rede_id ? nomesPorEscola.get(c.perfil_rede_id) : null,
      })) as Cupom[];
    },
  });

  // Escolas (dono_escola) disponíveis pra vincular como parceira -- só as
  // que ainda não têm nenhum cupom (uma escola tem no máximo 1 vínculo).
  const { data: escolasDisponiveis = [] } = useQuery({
    queryKey: ['admin-escolas-disponiveis', editing?.perfil_rede_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfis_rede' as any)
        .select('id, nome')
        .eq('tipo', 'dono_escola')
        .order('nome');
      if (error) throw error;
      return (data || []) as EscolaOpcao[];
    },
  });

  const escolasJaVinculadas = new Set(
    cupons.filter(c => c.perfil_rede_id && c.id !== editing?.id).map(c => c.perfil_rede_id)
  );
  const escolasParaSelecionar = escolasDisponiveis.filter(e => !escolasJaVinculadas.has(e.id));
  const totalEscolasParceiras = cupons.filter(c => c.perfil_rede_id && c.ativo).length;
  // Só bloqueia se essa escolha específica for um vínculo NOVO (não é o que
  // esse cupom já tinha antes de abrir o diálogo) e o limite já foi atingido.
  const isNovoVinculoParceria = perfilRedeId !== SEM_ESCOLA && perfilRedeId !== (editing?.perfil_rede_id || SEM_ESCOLA);
  const limiteAtingido = isNovoVinculoParceria && totalEscolasParceiras >= LIMITE_ESCOLAS_PARCEIRAS;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        codigo: codigo.trim().toUpperCase(),
        nome_titular: nomeTitular.trim(),
        dias_trial: parseInt(diasTrial, 10),
        validade: validade ? new Date(`${validade}T23:59:59`).toISOString() : null,  // vale até o fim do dia escolhido, no horário local
        perfil_rede_id: perfilRedeId === SEM_ESCOLA ? null : perfilRedeId,
      };
      if (editing) {
        const { error } = await supabase
          .from('carreira_cupons' as any)
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('carreira_cupons' as any)
          .insert({ ...payload, criado_por: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cupons'] });
      toast.success(editing ? 'Cupom atualizado!' : 'Cupom criado!');
      closeDialog();
    },
    onError: (err: any) => {
      if (err.code === '23505') toast.error('Já existe um cupom com esse código.');
      else toast.error('Erro ao salvar: ' + err.message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('carreira_cupons' as any).update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-cupons'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('carreira_cupons' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cupons'] });
      toast.success('Cupom removido');
    },
  });

  function openCreate() {
    setEditing(null);
    setCodigo('');
    setNomeTitular('');
    setDiasTrial('30');
    setValidade('');
    setPerfilRedeId(SEM_ESCOLA);
    setDialogOpen(true);
  }

  function openEdit(c: Cupom) {
    setEditing(c);
    setCodigo(c.codigo);
    setNomeTitular(c.nome_titular);
    setDiasTrial(String(c.dias_trial));
    setValidade(c.validade ? dataLocalISO(new Date(c.validade)) : '');
    setPerfilRedeId(c.perfil_rede_id || SEM_ESCOLA);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  return (
    <CarreiraAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cupons de Convite</h1>
            <p className="text-sm text-muted-foreground">
              Códigos personalizados que dão trial estendido — dê a profissionais que trazem atletas
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Handshake className="w-3.5 h-3.5" />
              Escolas Parceiras: {totalEscolasParceiras}/{LIMITE_ESCOLAS_PARCEIRAS} vagas preenchidas
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Cupom
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : cupons.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Ticket className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Nenhum cupom criado ainda</p>
              <Button onClick={openCreate} variant="outline" className="mt-4">Criar o primeiro</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-2">
              {cupons.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">{c.codigo}</span>
                      <p className="text-sm text-muted-foreground truncate">{c.nome_titular}</p>
                      {c.perfil_rede_id && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
                          <Handshake className="w-3 h-3" /> Escola Parceira{c.escola_nome ? `: ${c.escola_nome}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.dias_trial} dias de trial
                      {c.validade && ` · válido até ${new Date(c.validade).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVerUsosDe({ id: c.id, codigo: c.codigo })}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/60"
                    title="Ver quem usou este cupom"
                  >
                    <Users className="w-3.5 h-3.5" />
                    {c.usos}
                    <span className="hidden text-xs sm:inline">ver quem</span>
                  </button>
                  <Switch checked={c.ativo} onCheckedChange={ativo => toggleMutation.mutate({ id: c.id, ativo })} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                    if (confirm(`Remover o cupom ${c.codigo}?`)) deleteMutation.mutate(c.id);
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <UsosDoCupomDialog cupom={verUsosDe} onClose={() => setVerUsosDe(null)} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cupom' : 'Novo Cupom'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código</Label>
              <Input
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                placeholder="Ex: IGOR30"
                className="font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground mt-1">É o que a família vai digitar no cadastro. Sem espaços.</p>
            </div>
            <div>
              <Label>Nome do titular</Label>
              <Input value={nomeTitular} onChange={e => setNomeTitular(e.target.value)} placeholder="Ex: Igor - técnico" />
            </div>
            <div>
              <Label>Dias de trial</Label>
              <Input type="number" min={1} value={diasTrial} onChange={e => setDiasTrial(e.target.value)} />
            </div>
            <div>
              <Label>Válido até (opcional)</Label>
              <Input type="date" value={validade} onChange={e => setValidade(e.target.value)} />
            </div>
            <div>
              <Label>Escola parceira (opcional)</Label>
              <Select value={perfilRedeId} onValueChange={setPerfilRedeId}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_ESCOLA}>Nenhuma — cupom avulso</SelectItem>
                  {escolasParaSelecionar.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Vincular a uma escola já cadastrada mostra a logo dela na página inicial e o selo "Escola Parceira" no perfil.
                {limiteAtingido && (
                  <span className="text-destructive font-medium"> Limite de {LIMITE_ESCOLAS_PARCEIRAS} escolas parceiras atingido.</span>
                )}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!codigo.trim() || !nomeTitular.trim() || !diasTrial || saveMutation.isPending || limiteAtingido}
              >
                {saveMutation.isPending ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar cupom'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </CarreiraAdminLayout>
  );
}


interface UsoCupom {
  assinaturaId: string;
  atleta: string | null;
  slug: string | null;
  responsavel: string | null;
  email: string | null;
  usadoEm: string;
  status: string;
}

/** Quem se cadastrou usando o cupom: cada assinatura de teste criada com ele (atleta, responsável e data). */
function UsosDoCupomDialog({ cupom, onClose }: { cupom: { id: string; codigo: string } | null; onClose: () => void }) {
  const { data: usos = [], isLoading } = useQuery({
    queryKey: ['admin-cupom-usos', cupom?.id],
    enabled: !!cupom,
    staleTime: 0,
    refetchOnMount: true,
    queryFn: async (): Promise<UsoCupom[]> => {
      const db = supabase as any;
      const { data: assinaturas, error } = await db
        .from('carreira_assinaturas')
        .select('id, user_id, crianca_id, inicio_em, status')
        .eq('cupom_id', cupom!.id)
        .order('inicio_em', { ascending: false });
      if (error) throw error;
      const lista = (assinaturas || []) as any[];
      if (lista.length === 0) return [];
      const userIds = [...new Set(lista.map((a) => a.user_id))];
      const criancaIds = [...new Set(lista.map((a) => a.crianca_id).filter(Boolean))];
      const [{ data: perfis }, { data: atletas }] = await Promise.all([
        db.from('profiles').select('user_id, nome, email').in('user_id', userIds),
        criancaIds.length
          ? db.from('perfil_atleta').select('crianca_id, nome, slug').in('crianca_id', criancaIds)
          : Promise.resolve({ data: [] }),
      ]);
      const porUser = new Map((perfis || []).map((p: any) => [p.user_id, p]));
      const porCrianca = new Map((atletas || []).map((a: any) => [a.crianca_id, a]));
      return lista.map((a) => ({
        assinaturaId: a.id,
        atleta: (porCrianca.get(a.crianca_id) as any)?.nome ?? null,
        slug: (porCrianca.get(a.crianca_id) as any)?.slug ?? null,
        responsavel: (porUser.get(a.user_id) as any)?.nome ?? null,
        email: (porUser.get(a.user_id) as any)?.email ?? null,
        usadoEm: a.inicio_em,
        status: a.status,
      }));
    },
  });

  return (
    <Dialog open={!!cupom} onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quem usou o cupom {cupom?.codigo}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : usos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Ninguém usou este cupom ainda.</p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {usos.map((u) => (
              <div key={u.assinaturaId} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{u.atleta || 'Atleta sem perfil'}</p>
                  {u.slug && (
                    <a href={`/${u.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      Ver perfil <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {u.responsavel || 'Responsável'}{u.email ? ` · ${u.email}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(u.usadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {u.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
