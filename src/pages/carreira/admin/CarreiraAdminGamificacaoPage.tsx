import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Users, Trophy, Zap, TrendingUp, Gift, Crown, Target, Settings, Swords, Plus, Save, Trash2, Pencil, TableProperties } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { NivelConfig, PontosTipoConfig, DesafioConvite } from '@/hooks/useGamificacaoData';
import { getLevelTitle } from '@/hooks/useGamificacaoData';
import { Send } from 'lucide-react';

interface GamificacaoStats {
  total_usuarios: number;
  pontos_distribuidos: number;
  badges_dados: number;
  nivel_medio: number;
  top_usuarios: Array<{
    nome: string;
    email: string;
    pontos_total: number;
    nivel: number;
    badges_count: number;
  }>;
}

export default function CarreiraAdminGamificacaoPage() {
  const [stats, setStats] = useState<GamificacaoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [pontos, setPontos] = useState('');
  const [descricao, setDescricao] = useState('');
  const queryClient = useQueryClient();

  // Fetch configurable data
  const { data: niveis = [], refetch: refetchNiveis } = useQuery({
    queryKey: ['admin-niveis'],
    queryFn: async () => {
      const { data } = await supabase.from('gamificacao_niveis' as any).select('*').order('nivel');
      return (data as any as NivelConfig[]) || [];
    },
  });

  const { data: pontosTipo = [], refetch: refetchPontosTipo } = useQuery({
    queryKey: ['admin-pontos-tipo'],
    queryFn: async () => {
      const { data } = await supabase.from('gamificacao_pontos_tipo' as any).select('*').order('pontos', { ascending: false });
      return (data as any as PontosTipoConfig[]) || [];
    },
  });

  const { data: acoesConfig = [], refetch: refetchAcoesConfig } = useQuery({
    queryKey: ['admin-acoes-config'],
    queryFn: async () => {
      const { data } = await supabase.from('gamificacao_acoes_config' as any).select('*').order('categoria').order('pontos', { ascending: false });
      return (data as any[]) || [];
    },
  });

  const { data: desafios = [], refetch: refetchDesafios } = useQuery({
    queryKey: ['admin-desafios'],
    queryFn: async () => {
      const { data } = await supabase.from('desafios_convite' as any).select('*').order('created_at', { ascending: false });
      return (data as any as DesafioConvite[]) || [];
    },
  });

  useEffect(() => {
    carregarStats();
  }, []);

  const carregarStats = async () => {
    try {
      setLoading(true);
      const [gamificacaoResult, pontosResult, badgesResult] = await Promise.all([
        supabase.from('user_gamificacao' as any).select('pontos_total, nivel'),
        supabase.from('pontos_historico' as any).select('pontos'),
        supabase.from('user_badges' as any).select('user_id'),
      ]);

      const { data: topUsers } = await supabase
        .from('user_gamificacao' as any)
        .select('user_id, pontos_total, nivel')
        .order('pontos_total', { ascending: false })
        .limit(10);

      const topUsersWithDetails = await Promise.all(
        (topUsers || []).map(async (user: any) => {
          // Try profiles first
          const { data: profile } = await supabase
            .from('profiles').select('nome, email').eq('user_id', user.user_id).maybeSingle();
          
          let nome = profile?.nome || '';
          let email = profile?.email || '';

          // Fallback: perfis_rede
          if (!nome || nome === 'Usuario') {
            const { data: pr } = await supabase
              .from('perfis_rede').select('nome').eq('user_id', user.user_id).maybeSingle();
            if (pr?.nome) nome = pr.nome;
          }

          // Fallback: perfil_atleta. .limit(1) em vez de .maybeSingle() puro:
          // um responsável pode ter mais de um perfil_atleta (irmãos).
          if (!nome || nome === 'Usuario') {
            const { data: pa } = await supabase
              .from('perfil_atleta').select('nome').eq('user_id', user.user_id)
              .order('created_at', { ascending: true }).limit(1).maybeSingle();
            if (pa?.nome) nome = pa.nome;
          }

          const { data: badges } = await supabase
            .from('user_badges' as any).select('id').eq('user_id', user.user_id);
          return {
            nome: nome || 'Usuário sem nome',
            email,
            pontos_total: user.pontos_total,
            nivel: user.nivel,
            badges_count: badges?.length || 0,
          };
        })
      );

      const totalUsuarios = gamificacaoResult.data?.length || 0;
      const pontosDistribuidos = pontosResult.data?.reduce((sum: number, p: any) => sum + p.pontos, 0) || 0;
      const nivelMedio = totalUsuarios > 0
        ? Math.round((gamificacaoResult.data?.reduce((sum: number, g: any) => sum + g.nivel, 0) || 0) / totalUsuarios)
        : 0;

      setStats({
        total_usuarios: totalUsuarios,
        pontos_distribuidos: pontosDistribuidos,
        badges_dados: badgesResult.data?.length || 0,
        nivel_medio: nivelMedio,
        top_usuarios: topUsersWithDetails,
      });
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const darPontosManual = async () => {
    if (!userEmail || !pontos || !descricao) { toast.error('Preencha todos os campos'); return; }
    try {
      const { data: profile } = await supabase.from('profiles').select('user_id').eq('email', userEmail).maybeSingle();
      if (!profile) { toast.error('Usuário não encontrado'); return; }
      const { error } = await supabase.rpc('adicionar_pontos', {
        p_user_id: profile.user_id, p_acao_tipo: 'bonus_admin',
        p_pontos: parseInt(pontos), p_descricao: descricao,
      });
      if (error) throw error;
      toast.success('Pontos adicionados!');
      setUserEmail(''); setPontos(''); setDescricao('');
      carregarStats();
    } catch (error) { toast.error('Erro ao adicionar pontos'); }
  };

  if (loading) {
    return (
      <CarreiraAdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </CarreiraAdminLayout>
    );
  }

  return (
    <CarreiraAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gamificação</h1>
            <p className="text-muted-foreground">Sistema de pontos, níveis, desafios e conquistas</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600">
                <Gift className="w-4 h-4 mr-2" /> Dar Pontos
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar Pontos Manualmente</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Email do Usuário</Label><Input value={userEmail} onChange={e => setUserEmail(e.target.value)} placeholder="usuario@email.com" /></div>
                <div><Label>Pontos</Label><Input type="number" value={pontos} onChange={e => setPontos(e.target.value)} placeholder="100" /></div>
                <div><Label>Descrição</Label><Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Bônus por participação especial" /></div>
                <Button onClick={darPontosManual} className="w-full">Adicionar Pontos</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: <Users className="h-4 w-4 text-blue-600" />, label: 'Usuários Ativos', value: stats?.total_usuarios },
            { icon: <Zap className="h-4 w-4 text-orange-600" />, label: 'Pontos Distribuídos', value: stats?.pontos_distribuidos?.toLocaleString() },
            { icon: <Trophy className="h-4 w-4 text-yellow-600" />, label: 'Badges Dados', value: stats?.badges_dados },
            { icon: <TrendingUp className="h-4 w-4 text-green-600" />, label: 'Nível Médio', value: stats?.nivel_medio },
          ].map((s, i) => (
            <Card key={i}><CardContent className="p-6"><div className="flex items-center space-x-2">{s.icon}<div><p className="text-sm font-medium text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div></div></CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="ranking" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="ranking"><Crown className="w-4 h-4 mr-1" /> Ranking</TabsTrigger>
            <TabsTrigger value="convites"><Send className="w-4 h-4 mr-1" /> Convites</TabsTrigger>
            <TabsTrigger value="niveis"><Settings className="w-4 h-4 mr-1" /> Níveis</TabsTrigger>
            <TabsTrigger value="pontos"><Target className="w-4 h-4 mr-1" /> Pontos por Tipo</TabsTrigger>
            <TabsTrigger value="acoes"><TableProperties className="w-4 h-4 mr-1" /> Ações</TabsTrigger>
            <TabsTrigger value="desafios"><Swords className="w-4 h-4 mr-1" /> Desafios</TabsTrigger>
          </TabsList>

          {/* TAB: Ranking */}
          <TabsContent value="ranking">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-600" /> Top 10</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pos</TableHead><TableHead>Nome</TableHead><TableHead>Email</TableHead>
                      <TableHead className="text-center">Pontos</TableHead><TableHead className="text-center">Nível</TableHead><TableHead className="text-center">Badges</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.top_usuarios.map((u, i) => (
                      <TableRow key={u.email}>
                        <TableCell>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}º`}</TableCell>
                        <TableCell>{u.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell className="text-center"><Badge variant="secondary" className="bg-orange-500/20 text-orange-600">{u.pontos_total.toLocaleString()}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline">{getLevelTitle(u.nivel, niveis)} ({u.nivel})</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="secondary">{u.badges_count}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Convites */}
          <TabsContent value="convites">
            <ConvitesManager />
          </TabsContent>

          {/* TAB: Níveis */}
          <TabsContent value="niveis">
            <NiveisManager niveis={niveis} onSave={() => { refetchNiveis(); queryClient.invalidateQueries({ queryKey: ['gamificacao-niveis'] }); }} />
          </TabsContent>

          {/* TAB: Pontos por Tipo */}
          <TabsContent value="pontos">
            <PontosTipoManager pontosTipo={pontosTipo} onSave={() => { refetchPontosTipo(); queryClient.invalidateQueries({ queryKey: ['gamificacao-pontos-tipo'] }); }} />
          </TabsContent>

          {/* TAB: Ações */}
          <TabsContent value="acoes">
            <AcoesConfigManager acoes={acoesConfig} onSave={() => { refetchAcoesConfig(); queryClient.invalidateQueries({ queryKey: ['acoes-config-publico'] }); }} />
          </TabsContent>

          {/* TAB: Desafios */}
          <TabsContent value="desafios">
            <DesafiosManager desafios={desafios} onSave={() => { refetchDesafios(); queryClient.invalidateQueries({ queryKey: ['desafios-ativos'] }); }} />
          </TabsContent>
        </Tabs>
      </div>
    </CarreiraAdminLayout>
  );
}

// ===================== Níveis Manager =====================
function NiveisManager({ niveis, onSave }: { niveis: NivelConfig[]; onSave: () => void }) {
  const [editing, setEditing] = useState<NivelConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSave = async (nivel: NivelConfig) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('gamificacao_niveis' as any)
        .update({ nome: nivel.nome, icone: nivel.icone, cor: nivel.cor, xp_minimo: nivel.xp_minimo } as any)
        .eq('id', nivel.id);
      if (error) throw error;
      toast.success(`Nível ${nivel.nivel} atualizado!`);
      setEditing(null);
      onSave();
    } catch { toast.error('Erro ao salvar'); }
    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `niveis/${editing.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('carreira-assets')
        .upload(path, file, { upsert: true, contentType: file.type || `image/${ext}` });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('carreira-assets').getPublicUrl(path);
      // Append cache-buster so browser shows the new image
      const url = `${urlData.publicUrl}?v=${Date.now()}`;
      setEditing({ ...editing, icone: url });
      toast.success('Imagem carregada!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao fazer upload da imagem');
    }
    setUploading(false);
  };

  const isUrl = (v: string) => v.startsWith('http') || v.startsWith('blob:') || v.startsWith('/');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" /> Configurar Níveis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">Edite os nomes, imagens e cores dos níveis de progressão.</p>
        <div className="space-y-2">
          {niveis.map(n => (
            <div key={n.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              {editing?.id === n.id ? (
                <>
                  <div className="flex flex-col items-center gap-1">
                    {/* Image preview */}
                    <div className="w-14 h-14 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden relative">
                      {isUrl(editing.icone) ? (
                        <img src={editing.icone} alt="Ícone" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-2xl">{editing.icone}</span>
                      )}
                    </div>
                    <label className="cursor-pointer text-[10px] text-primary hover:underline">
                      {uploading ? 'Enviando...' : 'Trocar imagem'}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                    </label>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <Input placeholder="Nome" value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} />
                    <Input type="color" value={editing.cor} onChange={e => setEditing({ ...editing, cor: e.target.value })} className="w-full h-9" />
                    <Input type="number" placeholder="XP mínimo" value={editing.xp_minimo} onChange={e => setEditing({ ...editing, xp_minimo: parseInt(e.target.value) || 0 })} />
                  </div>
                  <Button size="sm" onClick={() => handleSave(editing)} disabled={saving}><Save className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>✕</Button>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 flex items-center justify-center">
                    {isUrl(n.icone) ? (
                      <img src={n.icone} alt={n.nome} className="w-10 h-10 object-contain rounded-lg" />
                    ) : (
                      <span className="text-2xl">{n.icone}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{n.nome}</span>
                      <Badge variant="outline" className="text-[10px]">Nível {n.nivel}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{n.xp_minimo.toLocaleString()} XP</span>
                  </div>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: n.cor }} />
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ ...n })}><Pencil className="w-4 h-4" /></Button>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ===================== Pontos por Tipo Manager =====================
function PontosTipoManager({ pontosTipo, onSave }: { pontosTipo: PontosTipoConfig[]; onSave: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PontosTipoConfig>>({});

  const handleSave = async (id: string) => {
    try {
      const { error } = await supabase
        .from('gamificacao_pontos_tipo' as any)
        .update({ pontos: editValues.pontos, label: editValues.label, icone: editValues.icone } as any)
        .eq('id', id);
      if (error) throw error;
      toast.success('Pontuação atualizada!');
      setEditingId(null);
      onSave();
    } catch { toast.error('Erro ao salvar'); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-600" /> Pontos por Tipo de Convite
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">Configure quantos XP o convidante ganha ao trazer cada tipo de perfil.</p>
        <div className="space-y-2">
          {pontosTipo.map(pt => (
            <div key={pt.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              {editingId === pt.id ? (
                <>
                  <Input className="w-12 text-center text-lg" value={editValues.icone || ''} onChange={e => setEditValues({ ...editValues, icone: e.target.value })} />
                  <Input className="flex-1" value={editValues.label || ''} onChange={e => setEditValues({ ...editValues, label: e.target.value })} />
                  <Input type="number" className="w-24" value={editValues.pontos || 0} onChange={e => setEditValues({ ...editValues, pontos: parseInt(e.target.value) || 0 })} />
                  <span className="text-xs text-muted-foreground">pts</span>
                  <Button size="sm" onClick={() => handleSave(pt.id)}><Save className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>✕</Button>
                </>
              ) : (
                <>
                  <span className="text-2xl w-10 text-center">{pt.icone}</span>
                  <div className="flex-1">
                    <span className="font-semibold">{pt.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">({pt.tipo_perfil})</span>
                  </div>
                  <Badge className="bg-orange-500/20 text-orange-600 border-0">+{pt.pontos} pts</Badge>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(pt.id); setEditValues(pt); }}><Pencil className="w-4 h-4" /></Button>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ===================== Desafios Manager =====================
function DesafiosManager({ desafios, onSave }: { desafios: DesafioConvite[]; onSave: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    titulo: '', descricao: '', icone: '🎯', cor: '#3b82f6',
    tipo_perfil_alvo: '' as string, pontos_bonus: 100, quantidade_meta: 3,
    badge_premio_tipo: '', badge_premio_nome: '', badge_premio_icone: '🏆', badge_premio_cor: '#ffd700',
    data_fim: '',
  });

  const handleCreate = async () => {
    if (!form.titulo) { toast.error('Título obrigatório'); return; }
    try {
      const tiposAlvo = form.tipo_perfil_alvo ? form.tipo_perfil_alvo.split(',').map(s => s.trim()).filter(Boolean) : [];
      const { error } = await supabase.from('desafios_convite' as any).insert({
        titulo: form.titulo,
        descricao: form.descricao || null,
        icone: form.icone,
        cor: form.cor,
        tipo_perfil_alvo: tiposAlvo,
        pontos_bonus: form.pontos_bonus,
        quantidade_meta: form.quantidade_meta,
        badge_premio_tipo: form.badge_premio_tipo || null,
        badge_premio_nome: form.badge_premio_nome || null,
        badge_premio_icone: form.badge_premio_icone,
        badge_premio_cor: form.badge_premio_cor,
        data_fim: form.data_fim || null,
      } as any);
      if (error) throw error;
      toast.success('Desafio criado!');
      setShowForm(false);
      setForm({ titulo: '', descricao: '', icone: '🎯', cor: '#3b82f6', tipo_perfil_alvo: '', pontos_bonus: 100, quantidade_meta: 3, badge_premio_tipo: '', badge_premio_nome: '', badge_premio_icone: '🏆', badge_premio_cor: '#ffd700', data_fim: '' });
      onSave();
    } catch { toast.error('Erro ao criar desafio'); }
  };

  const toggleDesafio = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from('desafios_convite' as any).update({ ativo } as any).eq('id', id);
    if (error) { toast.error('Erro ao atualizar'); return; }
    toast.success(ativo ? 'Desafio ativado' : 'Desafio desativado');
    onSave();
  };

  const deleteDesafio = async (id: string) => {
    const { error } = await supabase.from('desafios_convite' as any).delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Desafio excluído');
    onSave();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-purple-600" /> Desafios de Convite
          </CardTitle>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-1" /> Novo Desafio
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-muted/30 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Convide 3 técnicos" /></div>
              <div><Label>Ícone</Label><div className="flex gap-2"><Input className="w-16" value={form.icone} onChange={e => setForm({ ...form, icone: e.target.value })} /><Input type="color" value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })} className="w-16 h-9" /></div></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição do desafio..." rows={2} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Meta (qtd)</Label><Input type="number" value={form.quantidade_meta} onChange={e => setForm({ ...form, quantidade_meta: parseInt(e.target.value) || 1 })} /></div>
              <div><Label>Bônus (pts)</Label><Input type="number" value={form.pontos_bonus} onChange={e => setForm({ ...form, pontos_bonus: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Data Fim</Label><Input type="datetime-local" value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })} /></div>
            </div>
            <div><Label>Tipos de perfil alvo (separados por vírgula, vazio = todos)</Label><Input value={form.tipo_perfil_alvo} onChange={e => setForm({ ...form, tipo_perfil_alvo: e.target.value })} placeholder="tecnico, professor, scout" /></div>
            <div className="grid grid-cols-4 gap-2">
              <div><Label>Badge Tipo</Label><Input value={form.badge_premio_tipo} onChange={e => setForm({ ...form, badge_premio_tipo: e.target.value })} placeholder="desafio_x" /></div>
              <div><Label>Badge Nome</Label><Input value={form.badge_premio_nome} onChange={e => setForm({ ...form, badge_premio_nome: e.target.value })} placeholder="Caçador de Técnicos" /></div>
              <div><Label>Ícone</Label><Input value={form.badge_premio_icone} onChange={e => setForm({ ...form, badge_premio_icone: e.target.value })} /></div>
              <div><Label>Cor</Label><Input type="color" value={form.badge_premio_cor} onChange={e => setForm({ ...form, badge_premio_cor: e.target.value })} className="h-9" /></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate}>Criar Desafio</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {desafios.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Nenhum desafio criado ainda.</p>
        ) : (
          <div className="space-y-2">
            {desafios.map(d => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <span className="text-2xl">{d.icone}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{d.titulo}</span>
                    <Badge variant={d.ativo ? 'default' : 'secondary'} className="text-[10px]">
                      {d.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Meta: {d.quantidade_meta} | Bônus: +{d.pontos_bonus} pts
                    {d.tipo_perfil_alvo.length > 0 && ` | Alvo: ${d.tipo_perfil_alvo.join(', ')}`}
                    {d.data_fim && ` | Até ${format(new Date(d.data_fim), 'dd/MM/yyyy', { locale: ptBR })}`}
                  </p>
                </div>
                <Switch checked={d.ativo} onCheckedChange={(v) => toggleDesafio(d.id, v)} />
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteDesafio(d.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===================== Convites Manager =====================
function ConvitesManager() {
  const { data: convites = [], isLoading } = useQuery({
    queryKey: ['admin-convites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rede_convites')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      // Enrich with profile names
      const enriched = await Promise.all(
        (data || []).map(async (c: any) => {
          // Get inviter info from perfis_rede
          const { data: inviter } = await supabase
            .from('perfis_rede')
            .select('nome, tipo, slug, foto_url')
            .eq('id', c.convidante_perfil_id)
            .maybeSingle();

          // Get invitee info
          let inviteeName = 'Não cadastrado';
          let inviteeType = c.tipo_convidado || null;
          let inviteeSlug: string | null = null;

          if (c.convidado_user_id) {
            const { data: prInvitee } = await supabase
              .from('perfis_rede')
              .select('nome, tipo, slug')
              .eq('user_id', c.convidado_user_id)
              .maybeSingle();
            if (prInvitee) {
              inviteeName = prInvitee.nome;
              inviteeType = prInvitee.tipo;
              inviteeSlug = prInvitee.slug;
            } else {
              const { data: paInvitee } = await supabase
                .from('perfil_atleta')
                .select('nome, slug')
                .eq('user_id', c.convidado_user_id)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
              if (paInvitee) {
                inviteeName = paInvitee.nome;
                inviteeType = 'atleta_filho';
                inviteeSlug = paInvitee.slug;
              }
            }
          }

          return {
            ...c,
            inviter_nome: inviter?.nome || 'Desconhecido',
            inviter_tipo: inviter?.tipo || '',
            inviter_slug: inviter?.slug || null,
            invitee_nome: inviteeName,
            invitee_tipo: inviteeType,
            invitee_slug: inviteeSlug,
          };
        })
      );

      return enriched;
    },
  });

  // Group by inviter
  const byInviter = convites.reduce((acc: Record<string, any[]>, c: any) => {
    const key = c.convidante_perfil_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5 text-blue-600" /> Mapa de Convites
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Total: {convites.length} convite{convites.length !== 1 ? 's' : ''} registrado{convites.length !== 1 ? 's' : ''} 
          {' '}de {Object.keys(byInviter).length} convidante{Object.keys(byInviter).length !== 1 ? 's' : ''}
        </p>

        {convites.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Nenhum convite registrado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Convidante</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Convidado</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Pontos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {convites.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium text-sm">{c.inviter_nome}</span>
                      <span className="text-xs text-muted-foreground ml-1">({c.inviter_tipo})</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(c.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-sm">{c.invitee_nome}</span>
                  </TableCell>
                  <TableCell>
                    {c.invitee_tipo ? (
                      <Badge variant="outline" className="text-[10px]">{c.invitee_tipo}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.pontos_concedidos ? (
                      <Badge variant="secondary" className="bg-orange-500/20 text-orange-600">
                        +{c.pontos_concedidos}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ===================== Ações Config Manager =====================
interface AcaoConfig {
  id: string;
  acao_tipo: string;
  label: string;
  descricao: string | null;
  pontos: number;
  icone: string;
  ativo: boolean;
  categoria: string;
}

function AcoesConfigManager({ acoes, onSave }: { acoes: AcaoConfig[]; onSave: () => void }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPontos, setEditPontos] = useState('');

  const toggleAtivo = async (acao: AcaoConfig) => {
    setSaving(acao.id);
    try {
      const { error } = await supabase
        .from('gamificacao_acoes_config' as any)
        .update({ ativo: !acao.ativo } as any)
        .eq('id', acao.id);
      if (error) throw error;
      toast.success(`${acao.label} ${acao.ativo ? 'desativada' : 'ativada'}!`);
      onSave();
    } catch { toast.error('Erro ao atualizar'); }
    setSaving(null);
  };

  const savePontos = async (acao: AcaoConfig) => {
    const novosPontos = parseInt(editPontos);
    if (isNaN(novosPontos) || novosPontos < 0) { toast.error('Valor inválido'); return; }
    setSaving(acao.id);
    try {
      const { error } = await supabase
        .from('gamificacao_acoes_config' as any)
        .update({ pontos: novosPontos } as any)
        .eq('id', acao.id);
      if (error) throw error;
      toast.success(`Pontos de "${acao.label}" atualizados para ${novosPontos}!`);
      setEditingId(null);
      onSave();
    } catch { toast.error('Erro ao salvar'); }
    setSaving(null);
  };

  const categorias = [...new Set(acoes.map(a => a.categoria))];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TableProperties className="w-5 h-5 text-blue-600" /> Ações que Geram Pontos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Ative ou desative ações e configure quanto cada uma vale. Triggers automáticos computam os pontos.
        </p>
        {categorias.map(cat => (
          <div key={cat} className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 capitalize">{cat}</h4>
            <div className="space-y-2">
              {acoes.filter(a => a.categoria === cat).map(acao => (
                <div key={acao.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <span className="text-xl shrink-0">{acao.icone}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{acao.label}</p>
                    {acao.descricao && <p className="text-[10px] text-muted-foreground line-clamp-1">{acao.descricao}</p>}
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">tipo: {acao.acao_tipo}</p>
                  </div>
                  {editingId === acao.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={editPontos}
                        onChange={e => setEditPontos(e.target.value)}
                        className="w-20 h-8 text-xs"
                      />
                      <Button size="sm" variant="ghost" onClick={() => savePontos(acao)} disabled={saving === acao.id}>
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>✕</Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs font-bold"
                      onClick={() => { setEditingId(acao.id); setEditPontos(String(acao.pontos)); }}
                    >
                      {acao.pontos} XP
                    </Button>
                  )}
                  <Switch
                    checked={acao.ativo}
                    onCheckedChange={() => toggleAtivo(acao)}
                    disabled={saving === acao.id}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
