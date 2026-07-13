import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2, User, Eye, EyeOff, ExternalLink, Mail, Phone, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';

const TYPE_LABELS: Record<string, string> = {
  professor: 'Professor/Treinador', tecnico: 'Técnico', dono_escola: 'Dono de Escola',
  preparador_fisico: 'Preparador Físico', empresario: 'Empresário', influenciador: 'Influenciador',
  scout: 'Scout', agente_clube: 'Agente de Clube', fotografo: 'Fotógrafo',
  torcedor: 'Torcedor', jogador_profissional: 'Jogador Profissional', plataforma: 'Plataforma',
};

function useAdminPerfisAtleta(search: string) {
  return useQuery({
    queryKey: ['carreira-admin-perfis-atleta', search],
    queryFn: async () => {
      const { data, error } = await supabase.from('perfil_atleta').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      const userIds = [...new Set((data || []).map((p: any) => p.user_id))];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, email, provider').in('user_id', userIds);
        if (profiles) profiles.forEach((p: any) => { profilesMap[p.user_id] = p; });
      }
      let perfis = (data || []).map((p: any) => ({ ...p, email: profilesMap[p.user_id]?.email, provider: profilesMap[p.user_id]?.provider }));
      if (search) {
        const s = search.toLowerCase();
        perfis = perfis.filter((p: any) => p.nome?.toLowerCase().includes(s) || p.slug?.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s));
      }
      return perfis;
    },
  });
}

function useAdminPerfisRede(search: string) {
  return useQuery({
    queryKey: ['carreira-admin-perfis-rede', search],
    queryFn: async () => {
      const { data, error } = await supabase.from('perfis_rede').select('*').neq('tipo', 'pai_responsavel').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      const userIds = [...new Set((data || []).map((p: any) => p.user_id))];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, email, provider').in('user_id', userIds);
        if (profiles) profiles.forEach((p: any) => { profilesMap[p.user_id] = p; });
      }
      let perfis = (data || []).map((p: any) => ({ ...p, email: profilesMap[p.user_id]?.email, provider: profilesMap[p.user_id]?.provider, cidade: (p.dados_perfil as any)?.localizacao || (p.dados_perfil as any)?.cidade || null }));
      if (search) {
        const s = search.toLowerCase();
        perfis = perfis.filter((p: any) => p.nome?.toLowerCase().includes(s) || p.slug?.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s));
      }
      return perfis;
    },
  });
}

function useToggleVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_public }: { id: string; is_public: boolean }) => {
      const { error } = await supabase.from('perfil_atleta').update({ is_public }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['carreira-admin-perfis-atleta'] }); toast.success('Visibilidade alterada'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

function EditPerfilDialog({ perfil, type, open, onOpenChange }: { perfil: any; type: 'atleta' | 'rede'; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // reset when perfil changes
  useState(() => {});
  if (open && !form._id) {
    setForm({
      _id: perfil.id,
      nome: perfil.nome || '',
      slug: perfil.slug || '',
      modalidade: perfil.modalidade || '',
      cidade: perfil.cidade || '',
      estado: perfil.estado || '',
      is_public: !!perfil.is_public,
      status_conta: perfil.status_conta || 'ativo',
      tipo: perfil.tipo || '',
    });
  }

  const table = type === 'atleta' ? 'perfil_atleta' : 'perfis_rede';
  const invalidateKey = type === 'atleta' ? 'carreira-admin-perfis-atleta' : 'carreira-admin-perfis-rede';

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = { nome: form.nome, slug: form.slug, status_conta: form.status_conta };
      if (type === 'atleta') {
        payload.modalidade = form.modalidade;
        payload.cidade = form.cidade;
        payload.estado = form.estado;
        payload.is_public = form.is_public;
      } else {
        payload.tipo = form.tipo;
      }
      const { error } = await supabase.from(table).update(payload).eq('id', perfil.id);
      if (error) throw error;
      toast.success('Perfil atualizado');
      qc.invalidateQueries({ queryKey: [invalidateKey] });
      setForm({});
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setForm({}); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar perfil</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>Slug</Label><Input value={form.slug || ''} onChange={e => setForm({ ...form, slug: e.target.value })} /></div>
          {type === 'atleta' && (
            <>
              <div><Label>Modalidade</Label><Input value={form.modalidade || ''} onChange={e => setForm({ ...form, modalidade: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Cidade</Label><Input value={form.cidade || ''} onChange={e => setForm({ ...form, cidade: e.target.value })} /></div>
                <div><Label>Estado</Label><Input value={form.estado || ''} onChange={e => setForm({ ...form, estado: e.target.value })} maxLength={2} /></div>
              </div>
              <div>
                <Label>Visibilidade</Label>
                <Select value={form.is_public ? 'public' : 'private'} onValueChange={v => setForm({ ...form, is_public: v === 'public' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="public">Público</SelectItem><SelectItem value="private">Oculto</SelectItem></SelectContent>
                </Select>
              </div>
            </>
          )}
          {type === 'rede' && (
            <div><Label>Tipo</Label><Input value={form.tipo || ''} onChange={e => setForm({ ...form, tipo: e.target.value })} /></div>
          )}
          <div>
            <Label>Status da conta</Label>
            <Select value={form.status_conta || 'ativo'} onValueChange={v => setForm({ ...form, status_conta: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PerfilTable({ perfis, type }: { perfis: any[]; type: 'atleta' | 'rede' }) {
  const toggle = useToggleVisibility();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { user_id: deleting.user_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Usuário e dados relacionados apagados');
      qc.invalidateQueries({ queryKey: ['carreira-admin-perfis-atleta'] });
      qc.invalidateQueries({ queryKey: ['carreira-admin-perfis-rede'] });
      setDeleting(null);
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || 'falha ao excluir'));
    } finally { setDeletingLoading(false); }
  };

  return (
    <Card>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Perfil</TableHead>
              <TableHead className="min-w-[200px]">Contato</TableHead>
              {type === 'rede' && <TableHead>Tipo</TableHead>}
              {type === 'atleta' && <TableHead>Modalidade</TableHead>}
              <TableHead>Cidade</TableHead>
              <TableHead>Origem Auth</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perfis.map((p: any) => (
              <TableRow key={p.id} className={p.status_conta === 'inativo' ? 'opacity-50' : ''}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      {p.foto_url && <AvatarImage src={p.foto_url} />}
                      <AvatarFallback><User className="w-3 h-3" /></AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">@{p.slug}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5 text-xs">
                    {p.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3 shrink-0" /><span className="truncate max-w-[200px]">{p.email}</span></div>}
                    {p.telefone_whatsapp && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3 shrink-0" /><span>{p.telefone_whatsapp}</span></div>}
                  </div>
                </TableCell>
                {type === 'rede' && <TableCell className="text-sm">{TYPE_LABELS[p.tipo] || p.tipo}</TableCell>}
                {type === 'atleta' && <TableCell className="text-sm">{p.modalidade}</TableCell>}
                <TableCell className="text-sm text-muted-foreground">{p.cidade ? `${p.cidade}${p.estado ? `/${p.estado}` : ''}` : '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {p.provider === 'google' ? '🔵 Google' : '📧 Email'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                <TableCell>
                  <Badge variant={p.status_conta === 'ativo' || !p.status_conta ? 'default' : 'destructive'}
                    className={p.status_conta !== 'inativo' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}>
                    {p.status_conta === 'inativo' ? 'Inativo' : 'Ativo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {type === 'atleta' && p.slug && (
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => window.open(`/${p.slug}`, '_blank')}
                        title="Ver perfil público">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    {type === 'atleta' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => toggle.mutate({ id: p.id, is_public: !p.is_public })}
                        title={p.is_public ? 'Ocultar' : 'Tornar público'}>
                        {p.is_public ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => setEditing(p)} title="Editar">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(p)} title="Excluir usuário">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <EditPerfilDialog perfil={editing} type={type} open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }} />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(v) => { if (!v) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleting?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apagará o usuário do Auth e <b>todos os dados relacionados</b>: perfis, posts, assinaturas, conexões, gamificação, etc. Um backup fica salvo por 30 dias. Ação irreversível.
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
    </Card>
  );
}

export default function CarreiraAdminPerfisPage() {
  const [searchAtleta, setSearchAtleta] = useState('');
  const [searchRede, setSearchRede] = useState('');
  const { data: perfisAtleta, isLoading: loadingAtleta } = useAdminPerfisAtleta(searchAtleta);
  const { data: perfisRede, isLoading: loadingRede } = useAdminPerfisRede(searchRede);

  return (
    <CarreiraAdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Perfis</h1>
          <p className="text-muted-foreground text-sm">Gerencie perfis de atletas e profissionais da rede</p>
        </div>

        <Tabs defaultValue="atleta">
          <TabsList>
            <TabsTrigger value="atleta">Atletas ({perfisAtleta?.length || 0})</TabsTrigger>
            <TabsTrigger value="rede">Rede Profissional ({perfisRede?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="atleta" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, slug ou email..." value={searchAtleta} onChange={(e) => setSearchAtleta(e.target.value)} className="pl-10" />
            </div>
            {loadingAtleta ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              : !perfisAtleta?.length ? <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum perfil encontrado</CardContent></Card>
              : <PerfilTable perfis={perfisAtleta} type="atleta" />}
          </TabsContent>

          <TabsContent value="rede" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, slug ou email..." value={searchRede} onChange={(e) => setSearchRede(e.target.value)} className="pl-10" />
            </div>
            {loadingRede ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              : !perfisRede?.length ? <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum perfil encontrado</CardContent></Card>
              : <PerfilTable perfis={perfisRede} type="rede" />}
          </TabsContent>
        </Tabs>
      </div>
    </CarreiraAdminLayout>
  );
}
