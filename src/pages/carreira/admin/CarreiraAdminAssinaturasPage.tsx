import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Loader2, CreditCard, QrCode, RefreshCw, Pencil, Trash2, Gift, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';

const PLANO_DISPLAY: Record<string, string> = {
  pro_mensal: 'Premium',
  mensal: 'Premium',
  competidor: 'Premium',
  elite: 'Premium',
  premium: 'Premium',
  base: 'Base',
};

const PLANO_PRECO: Record<string, number> = {
  competidor: 12.00,
  pro_mensal: 12.00,
  mensal: 12.00,
  elite: 12.00,
  premium: 12.00,
  base: 0,
};

function useAdminAssinaturas(search: string) {
  return useQuery({
    queryKey: ['carreira-admin-assinaturas', search],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carreira_assinaturas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const userIds = [...new Set((data || []).map((a: any) => a.user_id))];
      const criancaIds = [...new Set((data || []).map((a: any) => a.crianca_id))];

      let profilesMap: Record<string, any> = {};
      let criancasMap: Record<string, any> = {};
      let perfilAtletaMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email, nome, telefone')
          .in('user_id', userIds);
        if (profiles) profiles.forEach((p: any) => { profilesMap[p.user_id] = p; });
      }

      if (criancaIds.length > 0) {
        const { data: criancas } = await supabase
          .from('criancas')
          .select('id, nome, data_nascimento')
          .in('id', criancaIds);
        if (criancas) criancas.forEach((c: any) => { criancasMap[c.id] = c; });

        const { data: perfis } = await supabase
          .from('perfil_atleta')
          .select('crianca_id, slug, categoria, posicao_principal, telefone_whatsapp')
          .in('crianca_id', criancaIds);
        if (perfis) perfis.forEach((p: any) => { perfilAtletaMap[p.crianca_id] = p; });
      }

      let result = (data || []).map((a: any) => {
        const normalizedPlano = PLANO_DISPLAY[a.plano] || a.plano;
        const valorDisplay = a.valor || PLANO_PRECO[a.plano] || 0;
        return {
          ...a,
          user_email: profilesMap[a.user_id]?.email || '—',
          user_nome: profilesMap[a.user_id]?.nome || '—',
          user_telefone: profilesMap[a.user_id]?.telefone || '—',
          crianca_nome: criancasMap[a.crianca_id]?.nome || '—',
          crianca_nascimento: criancasMap[a.crianca_id]?.data_nascimento || null,
          atleta_slug: perfilAtletaMap[a.crianca_id]?.slug || null,
          atleta_posicao: perfilAtletaMap[a.crianca_id]?.posicao_principal || null,
          atleta_whatsapp: perfilAtletaMap[a.crianca_id]?.telefone_whatsapp || null,
          plano_display: normalizedPlano,
          valor_display: valorDisplay,
          cancelada_em: a.cancelada_em || null,
        };
      });

      if (search) {
        const s = search.toLowerCase();
        result = result.filter((a: any) =>
          a.user_email?.toLowerCase().includes(s) ||
          a.user_nome?.toLowerCase().includes(s) ||
          a.crianca_nome?.toLowerCase().includes(s)
        );
      }
      return result;
    },
  });
}

// Calcula o status REAL de acesso de uma assinatura, do jeito que o app
// calcula pra liberar/bloquear recursos (useCarreiraPlano.ts) -- em vez de
// só repetir o texto bruto salvo no banco, que fica "Trial"/"Premium" pra
// sempre mesmo depois do vencimento, até um admin editar manualmente.
function getEfetivo(ass: any): { acessoAtivo: boolean; statusLabel: string; statusClass: string; planoEfetivo: string; venceu: boolean; notaPlano: string | null } {
  const isIsento = ass.metodo_pagamento === 'isento';
  const venceu = !!ass.expira_em && new Date(ass.expira_em) < new Date();

  if (ass.status === 'ativa') {
    const acessoAtivo = isIsento || !venceu;
    return {
      acessoAtivo,
      statusLabel: acessoAtivo ? 'Ativa' : 'Vencida',
      statusClass: acessoAtivo ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20',
      planoEfetivo: acessoAtivo ? ass.plano_display : 'Base',
      venceu: !acessoAtivo,
      // Só chegou a existir cobrança/contrato de verdade se o status já foi
      // "ativa" (pagou ou foi isentado) -- nunca para quem só estava em trial.
      notaPlano: (!acessoAtivo && ass.plano_display === 'Premium') ? 'contratou Premium' : null,
    };
  }
  if (ass.status === 'trial') {
    const acessoAtivo = !venceu;
    return {
      acessoAtivo,
      statusLabel: acessoAtivo ? 'Trial' : 'Trial vencido',
      statusClass: acessoAtivo ? 'bg-violet-500/10 text-violet-600 border-violet-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20',
      planoEfetivo: acessoAtivo ? ass.plano_display : 'Base',
      venceu: !acessoAtivo,
      // Trial nunca foi uma contratação -- o usuário só testou de graça e
      // não converteu em pagamento, então não pode dizer "contratou".
      notaPlano: (!acessoAtivo && ass.plano_display === 'Premium') ? 'testou o Premium (não converteu)' : null,
    };
  }
  const labelMap: Record<string, string> = { cancelada: 'Cancelada', pendente: 'Pendente', expirada: 'Expirada' };
  return {
    acessoAtivo: false,
    statusLabel: labelMap[ass.status] || ass.status,
    statusClass: '',
    planoEfetivo: 'Base',
    venceu: false,
    notaPlano: null,
  };
}

const METODO_ICON: Record<string, React.ReactNode> = {
  cartao_credito: <CreditCard className="w-3.5 h-3.5" />,
  pix: <QrCode className="w-3.5 h-3.5" />,
  isento: <Gift className="w-3.5 h-3.5" />,
};

const METODO_LABEL: Record<string, string> = {
  cartao_credito: 'Cartão',
  pix: 'PIX',
  isento: 'Isento',
};

export default function CarreiraAdminAssinaturasPage() {
  const [urlParams] = useSearchParams();
  const [search, setSearch] = useState(urlParams.get('q') || '');
  const [renewLoading, setRenewLoading] = useState(false);
  const queryClient = useQueryClient();
  const { data: assinaturas, isLoading } = useAdminAssinaturas(search);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [showIsencao, setShowIsencao] = useState(false);
  const ativas = assinaturas?.filter((a: any) => getEfetivo(a).acessoAtivo).length || 0;
  const total = assinaturas?.length || 0;

  const handleManualRenewal = async () => {
    setRenewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('renew-carreira-pix');
      if (error) throw error;
      const result = data as any;
      toast.success(`Renovação executada: ${result.processed || 0} de ${result.total || 0} processadas`);
      queryClient.invalidateQueries({ queryKey: ['carreira-admin-assinaturas'] });
    } catch (err: any) {
      toast.error('Erro ao executar renovação: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setRenewLoading(false);
    }
  };

  const handleDelete = async () => {
    console.log('[admin-assinatura-delete] start', deleting);
    if (!deleting) return;
    setDeletingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-assinatura', {
        body: { assinatura_id: deleting.id },
      });
      console.log('[admin-assinatura-delete] response', { data, error });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (!(data as any)?.deleted) {
        toast.error('Nada removido. Confirme que a função admin-delete-assinatura está publicada.');
        return;
      }
      toast.success('Assinatura removida do banco');
      queryClient.invalidateQueries({ queryKey: ['carreira-admin-assinaturas'] });
      setDeleting(null);
    } catch (e: any) {
      console.error('[admin-assinatura-delete] erro', e);
      toast.error('Erro: ' + e.message);
    } finally { setDeletingLoading(false); }
  };

  return (
    <CarreiraAdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Assinaturas</h1>
            <p className="text-muted-foreground text-sm">Gerencie assinaturas do Carreira ID</p>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" onClick={handleManualRenewal} disabled={renewLoading} className="gap-1.5 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${renewLoading ? 'animate-spin' : ''}`} />
              Gerar PIX Renovação
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowIsencao(true)} className="gap-1.5 text-xs">
              <Gift className="w-3.5 h-3.5" />
              Conceder isenção
            </Button>
            <Badge variant="outline">{total} total</Badge>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{ativas} ativas</Badge>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, email ou atleta..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : !assinaturas?.length ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Nenhuma assinatura encontrada</p></CardContent></Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Atleta</TableHead>
                     <TableHead>Responsável</TableHead>
                     <TableHead>Email</TableHead>
                     <TableHead>WhatsApp</TableHead>
                     <TableHead>Plano</TableHead>
                     <TableHead>Valor</TableHead>
                     <TableHead>Pagamento</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Início</TableHead>
                     <TableHead>Vencimento / Cancel.</TableHead>
                     <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assinaturas.map((ass: any) => {
                    const efetivo = getEfetivo(ass);
                    return (
                    <TableRow key={ass.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{ass.crianca_nome}</p>
                          {ass.atleta_posicao && <p className="text-[10px] text-muted-foreground">{ass.atleta_posicao}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{ass.user_nome}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground">{ass.user_email}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground">{ass.atleta_whatsapp || ass.user_telefone || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{efetivo.planoEfetivo}</Badge>
                        {efetivo.notaPlano && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{efetivo.notaPlano}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {ass.metodo_pagamento === 'isento'
                          ? <span className="text-amber-600">Isento</span>
                          : (ass.valor_display > 0 ? `R$ ${Number(ass.valor_display).toFixed(2).replace('.', ',')}` : '—')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          {METODO_ICON[ass.metodo_pagamento] || null}
                          <span>{METODO_LABEL[ass.metodo_pagamento] || ass.metodo_pagamento || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={efetivo.acessoAtivo ? 'default' : 'secondary'} className={efetivo.statusClass}>
                          {efetivo.statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(ass.inicio_em), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ass.status === 'cancelada' && ass.cancelada_em
                          ? <span className="text-destructive">{format(new Date(ass.cancelada_em), 'dd/MM/yyyy', { locale: ptBR })}</span>
                          : ass.expira_em
                            ? <span className={efetivo.venceu ? 'text-destructive' : ''}>{format(new Date(ass.expira_em), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => setEditing(ass)} title="Editar">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => { console.log('[admin-assinatura-delete] click Trash', ass.id); setDeleting(ass); }} title="Excluir assinatura">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {editing && (
          <EditAssinaturaDialog assinatura={editing} onClose={() => setEditing(null)} onSaved={() => { queryClient.invalidateQueries({ queryKey: ['carreira-admin-assinaturas'] }); setEditing(null); }} />
        )}

        {showIsencao && (
          <ConcederIsencaoDialog onClose={() => setShowIsencao(false)} onSaved={() => { queryClient.invalidateQueries({ queryKey: ['carreira-admin-assinaturas'] }); setShowIsencao(false); }} />
        )}

        <AlertDialog open={!!deleting} onOpenChange={(v) => { if (!v) setDeleting(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir assinatura?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso remove o registro apenas do banco de dados. Se a assinatura estiver ativa no Asaas, cancele-a também no painel do Asaas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deletingLoading} className="bg-destructive hover:bg-destructive/90">
                {deletingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CarreiraAdminLayout>
  );
}

function EditAssinaturaDialog({ assinatura, onClose, onSaved }: { assinatura: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>(() => ({
    status: assinatura.status || 'pendente',
    plano: assinatura.plano || '',
    metodo_pagamento: assinatura.metodo_pagamento || '',
    valor: assinatura.valor ?? '',
    expira_em: assinatura.expira_em ? assinatura.expira_em.substring(0, 10) : '',
    observacoes: assinatura.observacoes || '',
  }));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        status: form.status,
        plano: form.plano,
        metodo_pagamento: form.metodo_pagamento || null,
        valor: form.valor === '' ? null : Number(form.valor),
        expira_em: form.expira_em || null,
        observacoes: form.observacoes || null,
      };
      if (form.status === 'cancelada' && !assinatura.cancelada_em) {
        payload.cancelada_em = new Date().toISOString();
      }
      const { error } = await supabase.from('carreira_assinaturas').update(payload).eq('id', assinatura.id);
      if (error) throw error;
      toast.success('Assinatura atualizada');
      onSaved();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar assinatura</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })} disabled={form.metodo_pagamento === 'isento'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
                <SelectItem value="expirada">Expirada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Plano</Label><Input value={form.plano} onChange={e => setForm({ ...form, plano: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} disabled={form.metodo_pagamento === 'isento'} />
            </div>
            <div>
              <Label>Método</Label>
              <Select
                value={form.metodo_pagamento || ''}
                onValueChange={v => {
                  if (v === 'isento') {
                    // Isento precisa vir junto com status "ativa", valor 0 e sem
                    // data de vencimento -- é exatamente o que useCarreiraPlano.ts
                    // checa pra liberar acesso Premium. Selecionar só o método
                    // sem ajustar o resto deixaria a assinatura "isenta" mas
                    // ainda travada em trial/vencida.
                    setForm({ ...form, metodo_pagamento: v, status: 'ativa', valor: '0', expira_em: '', plano: form.plano || 'premium' });
                  } else {
                    setForm({ ...form, metodo_pagamento: v });
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao_credito">Cartão</SelectItem>
                  <SelectItem value="isento">Isento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.metodo_pagamento === 'isento' && (
            <p className="text-xs text-amber-600">
              Isento concede Premium vitalício: status, valor e vencimento foram ajustados automaticamente e ficam travados enquanto o método for "Isento".
            </p>
          )}
          <div>
            <Label>Expira em</Label>
            <Input type="date" value={form.expira_em} onChange={e => setForm({ ...form, expira_em: e.target.value })} disabled={form.metodo_pagamento === 'isento'} />
          </div>
          <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useBuscarAtletas(search: string) {
  return useQuery({
    queryKey: ['carreira-admin-buscar-atletas', search],
    queryFn: async () => {
      if (!search || search.trim().length < 2) return [];
      const { data: perfis, error } = await supabase
        .from('perfil_atleta')
        .select('user_id, crianca_id, nome, slug')
        .ilike('nome', `%${search.trim()}%`)
        .limit(20);
      if (error) throw error;

      const userIds = [...new Set((perfis || []).map((p: any) => p.user_id))];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, email, nome').in('user_id', userIds);
        if (profiles) profiles.forEach((p: any) => { profilesMap[p.user_id] = p; });
      }

      const criancaIds = [...new Set((perfis || []).map((p: any) => p.crianca_id).filter(Boolean))];
      let assinaturaMap: Record<string, any> = {};
      if (criancaIds.length > 0) {
        const { data: assinaturas } = await supabase
          .from('carreira_assinaturas')
          .select('id, crianca_id, status, metodo_pagamento')
          .in('crianca_id', criancaIds)
          .order('created_at', { ascending: false });
        if (assinaturas) assinaturas.forEach((a: any) => {
          // keep only the most recent row per crianca_id (already ordered desc)
          if (!assinaturaMap[a.crianca_id]) assinaturaMap[a.crianca_id] = a;
        });
      }

      return (perfis || []).map((p: any) => ({
        ...p,
        user_email: profilesMap[p.user_id]?.email || '—',
        user_nome: profilesMap[p.user_id]?.nome || '—',
        assinatura_atual: assinaturaMap[p.crianca_id] || null,
      }));
    },
  });
}

function ConcederIsencaoDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [search, setSearch] = useState('');
  const [selecionado, setSelecionado] = useState<any>(null);
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: resultados, isLoading } = useBuscarAtletas(search);

  const handleConceder = async () => {
    if (!selecionado) return;
    setSaving(true);
    try {
      const payload = {
        user_id: selecionado.user_id,
        crianca_id: selecionado.crianca_id,
        plano: 'premium',
        status: 'ativa' as const,
        valor: 0,
        metodo_pagamento: 'isento',
        expira_em: null,
        inicio_em: new Date().toISOString().split('T')[0],
        observacoes: observacoes || 'Isenção concedida pelo admin',
      };

      if (selecionado.assinatura_atual?.id) {
        const { error } = await supabase.from('carreira_assinaturas').update(payload).eq('id', selecionado.assinatura_atual.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('carreira_assinaturas').insert(payload);
        if (error) throw error;
      }

      toast.success(`Isenção concedida para ${selecionado.nome}`);
      onSaved();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Conceder isenção de pagamento</DialogTitle></DialogHeader>

        {!selecionado ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atleta pelo nome..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {isLoading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>}
              {!isLoading && search.trim().length >= 2 && resultados?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum atleta encontrado</p>
              )}
              {resultados?.map((r: any) => (
                <button
                  key={r.crianca_id}
                  onClick={() => setSelecionado(r)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <p className="font-medium text-sm">{r.nome}</p>
                  <p className="text-xs text-muted-foreground">Responsável: {r.user_nome} ({r.user_email})</p>
                  {r.assinatura_atual && (
                    <Badge variant="outline" className="text-[10px] mt-1">
                      Assinatura atual: {r.assinatura_atual.metodo_pagamento === 'isento' ? 'Já isento' : r.assinatura_atual.status}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between rounded-lg border border-border p-3 bg-muted/30">
              <div>
                <p className="font-medium text-sm">{selecionado.nome}</p>
                <p className="text-xs text-muted-foreground">Responsável: {selecionado.user_nome} ({selecionado.user_email})</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelecionado(null)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Isso vai conceder acesso Premium vitalício (sem cobrança), {selecionado.assinatura_atual ? 'atualizando a assinatura atual' : 'criando uma nova assinatura'} deste atleta.
            </p>
            <div>
              <Label>Observações (motivo da isenção)</Label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} placeholder="Ex: filho do admin, uso pessoal" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {selecionado && (
            <Button onClick={handleConceder} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Gift className="w-4 h-4" /> Conceder isenção</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
