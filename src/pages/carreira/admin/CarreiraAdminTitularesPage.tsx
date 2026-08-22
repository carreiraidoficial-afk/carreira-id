import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trophy, Trash2, Pencil, ChevronUp, ChevronDown, Loader2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage } from '@/lib/image-compressor';

interface Titular {
  id: string;
  nome: string;
  papel: string;
  foto_url: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

async function uploadTitularFoto(file: File, userId: string): Promise<string> {
  const compressed = await compressImage(file, { maxWidth: 800, quality: 0.85 });
  const fileExt = compressed.name.split('.').pop();
  const fileName = `${userId}/titulares/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('atleta-fotos')
    .upload(fileName, compressed, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage.from('atleta-fotos').getPublicUrl(fileName);
  return `${publicUrl}?t=${Date.now()}`;
}

export default function CarreiraAdminTitularesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Titular | null>(null);
  const [uploading, setUploading] = useState(false);

  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');

  const { data: titulares = [], isLoading } = useQuery({
    queryKey: ['admin-titulares-base'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carreira_titulares_base' as any)
        .select('*')
        .order('ordem');
      if (error) throw error;
      return (data || []) as unknown as Titular[];
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadTitularFoto(file, user.id);
      setFotoUrl(url);
    } catch (err: any) {
      toast.error('Erro ao enviar foto: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from('carreira_titulares_base' as any)
          .update({ nome, papel, foto_url: fotoUrl })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const maxOrdem = titulares.length ? Math.max(...titulares.map(t => t.ordem)) + 1 : 0;
        const { error } = await supabase
          .from('carreira_titulares_base' as any)
          .insert({ nome, papel, foto_url: fotoUrl, ordem: maxOrdem, criado_por: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-titulares-base'] });
      toast.success(editing ? 'Titular atualizado!' : 'Titular adicionado!');
      closeDialog();
    },
    onError: (err: any) => toast.error('Erro ao salvar: ' + err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('carreira_titulares_base' as any).update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-titulares-base'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('carreira_titulares_base' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-titulares-base'] });
      toast.success('Titular removido');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, newOrdem }: { id: string; newOrdem: number }) => {
      const { error } = await supabase.from('carreira_titulares_base' as any).update({ ordem: newOrdem }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-titulares-base'] }),
  });

  function moveOrder(titular: Titular, direction: -1 | 1) {
    const sorted = [...titulares].sort((a, b) => a.ordem - b.ordem);
    const idx = sorted.findIndex(t => t.id === titular.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    reorderMutation.mutate({ id: titular.id, newOrdem: other.ordem });
    reorderMutation.mutate({ id: other.id, newOrdem: titular.ordem });
  }

  function openCreate() {
    setEditing(null);
    setNome('');
    setPapel('');
    setFotoUrl('');
    setDialogOpen(true);
  }

  function openEdit(t: Titular) {
    setEditing(t);
    setNome(t.nome);
    setPapel(t.papel);
    setFotoUrl(t.foto_url);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  const ativos = titulares.filter(t => t.ativo).length;

  return (
    <CarreiraAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Titulares da Base</h1>
            <p className="text-sm text-muted-foreground">
              Apoiadores fundadores exibidos na landing page — {ativos}/100 vagas preenchidas
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2" disabled={ativos >= 100}>
            <Plus className="w-4 h-4" /> Novo Titular
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : titulares.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Nenhum titular cadastrado ainda</p>
              <Button onClick={openCreate} variant="outline" className="mt-4">Adicionar o primeiro</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-2">
              {titulares.sort((a, b) => a.ordem - b.ordem).map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveOrder(t, -1)}>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveOrder(t, 1)}>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <img src={t.foto_url} alt={t.nome} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.papel}</p>
                  </div>
                  <Switch checked={t.ativo} onCheckedChange={ativo => toggleMutation.mutate({ id: t.id, ativo })} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                    if (confirm(`Remover ${t.nome} dos titulares?`)) deleteMutation.mutate(t.id);
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
            <DialogTitle>{editing ? 'Editar Titular' : 'Novo Titular'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Foto</Label>
              <div className="flex items-center gap-3 mt-1">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                    <ImagePlus className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {fotoUrl ? 'Trocar foto' : 'Enviar foto'}
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </div>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Carlos Andrade" />
            </div>
            <div>
              <Label>Papel / Título</Label>
              <Input value={papel} onChange={e => setPapel(e.target.value)} placeholder="Ex: Técnico de Futebol de Base" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!nome.trim() || !papel.trim() || !fotoUrl || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Salvando...' : editing ? 'Salvar alterações' : 'Adicionar titular'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </CarreiraAdminLayout>
  );
}
