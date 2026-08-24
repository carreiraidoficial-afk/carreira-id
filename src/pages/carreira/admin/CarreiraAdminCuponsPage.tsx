import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';
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
import { Plus, Ticket, Trash2, Pencil, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Cupom {
  id: string;
  codigo: string;
  nome_titular: string;
  dias_trial: number;
  ativo: boolean;
  validade: string | null;
  usos: number;
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

      return (cuponsData || []).map((c: any) => ({
        ...c,
        usos: usosPorCupom.get(c.id) || 0,
      })) as Cupom[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        codigo: codigo.trim().toUpperCase(),
        nome_titular: nomeTitular.trim(),
        dias_trial: parseInt(diasTrial, 10),
        validade: validade ? new Date(validade).toISOString() : null,
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
    setDialogOpen(true);
  }

  function openEdit(c: Cupom) {
    setEditing(c);
    setCodigo(c.codigo);
    setNomeTitular(c.nome_titular);
    setDiasTrial(String(c.dias_trial));
    setValidade(c.validade ? c.validade.slice(0, 10) : '');
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
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">{c.codigo}</span>
                      <p className="text-sm text-muted-foreground truncate">{c.nome_titular}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.dias_trial} dias de trial
                      {c.validade && ` · válido até ${new Date(c.validade).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                    <Users className="w-3.5 h-3.5" />
                    {c.usos}
                  </div>
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
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!codigo.trim() || !nomeTitular.trim() || !diasTrial || saveMutation.isPending}
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
