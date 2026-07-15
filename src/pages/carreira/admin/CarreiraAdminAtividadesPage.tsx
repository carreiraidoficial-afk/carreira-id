import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, Activity, Settings, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { TIPO_ATIVIDADE_LABELS } from '@/hooks/useAtividadesExternasData';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';

function useAtividadesExternasAdmin(search: string) {
  return useQuery({
    queryKey: ['carreira-admin-atividades', search],
    queryFn: async () => {
      const { data, error } = await supabase.from('atividades_externas').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      const criancaIds = [...new Set((data || []).map((a: any) => a.crianca_id))];
      let criancasMap: Record<string, string> = {};
      if (criancaIds.length > 0) {
        const { data: criancas } = await supabase.from('criancas').select('id, nome').in('id', criancaIds);
        if (criancas) criancas.forEach((c: any) => { criancasMap[c.id] = c.nome; });
      }
      let result = (data || []).map((a: any) => ({ ...a, crianca_nome: criancasMap[a.crianca_id] || '—' }));
      if (search) {
        const s = search.toLowerCase();
        result = result.filter((a: any) => a.crianca_nome?.toLowerCase().includes(s) || a.local_atividade?.toLowerCase().includes(s) || a.torneio_nome?.toLowerCase().includes(s));
      }
      return result;
    },
  });
}

function useAtividadesConfig() {
  return useQuery({
    queryKey: ['carreira-admin-atividades-config'],
    queryFn: async () => {
      const { data } = await supabase.from('saas_config').select('chave, valor').in('chave', ['atividades_externas_modo', 'carreira_limite_free']);
      const config: Record<string, string> = {};
      (data || []).forEach((c: any) => { config[c.chave] = c.valor; });
      return config;
    },
  });
}

function useWhitelist() {
  return useQuery({
    queryKey: ['carreira-admin-whitelist'],
    queryFn: async () => {
      const { data, error } = await supabase.from('atividades_externas_whitelist').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: string }) => {
      const { data: existing } = await supabase.from('saas_config').select('id').eq('chave', chave).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('saas_config').update({ valor }).eq('chave', chave);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('saas_config').insert({ chave, valor });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['carreira-admin-atividades-config'] }); toast.success('Configuração atualizada'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export default function CarreiraAdminAtividadesPage() {
  const [urlParams] = useSearchParams();
  const [search, setSearch] = useState(urlParams.get('q') || '');
  const { data: atividades, isLoading } = useAtividadesExternasAdmin(search);
  const { data: config } = useAtividadesConfig();
  const { data: whitelist, isLoading: loadingWhitelist } = useWhitelist();
  const updateConfig = useUpdateConfig();

  const modo = config?.atividades_externas_modo || 'desativado';
  const limite = config?.carreira_limite_free || '2';

  return (
    <CarreiraAdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Atividades Externas</h1>
          <p className="text-muted-foreground text-sm">Configuração global e monitoramento</p>
        </div>

        <Tabs defaultValue="config">
          <TabsList>
            <TabsTrigger value="config"><Settings className="w-4 h-4 mr-1" />Configuração</TabsTrigger>
            <TabsTrigger value="whitelist"><Shield className="w-4 h-4 mr-1" />Whitelist ({whitelist?.length || 0})</TabsTrigger>
            <TabsTrigger value="lista"><Activity className="w-4 h-4 mr-1" />Atividades ({atividades?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Modo da Funcionalidade</CardTitle></CardHeader>
                <CardContent>
                  <Select value={modo} onValueChange={(v) => updateConfig.mutate({ chave: 'atividades_externas_modo', valor: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desativado">🔴 Desativado</SelectItem>
                      <SelectItem value="beta">🟡 Beta (todos acessam)</SelectItem>
                      <SelectItem value="freemium">🟢 Freemium (com limite)</SelectItem>
                      <SelectItem value="pago">💎 Pago (apenas assinantes)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Limite Free</CardTitle></CardHeader>
                <CardContent>
                  <Input type="number" min={0} value={limite}
                    onChange={e => updateConfig.mutate({ chave: 'carreira_limite_free', valor: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Atividades gratuitas por atleta antes do paywall</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="whitelist" className="space-y-4">
            {loadingWhitelist ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : !whitelist?.length ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum usuário na whitelist</CardContent></Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Tipo Isenção</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expira em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {whitelist.map((w: any) => (
                        <TableRow key={w.id}>
                          <TableCell className="text-sm font-medium">{w.user_email}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{w.motivo}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{w.tipo_isencao || '—'}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={w.ativo ? 'default' : 'secondary'} className={w.ativo ? 'bg-emerald-500/10 text-emerald-600' : ''}>
                              {w.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{w.expires_at ? format(new Date(w.expires_at), 'dd/MM/yyyy', { locale: ptBR }) : 'Sem expiração'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="lista" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por atleta, local ou torneio..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : !atividades?.length ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma atividade encontrada</CardContent></Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atleta</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Local</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Credibilidade</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Público</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {atividades.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm font-medium">{a.crianca_nome}</TableCell>
                          <TableCell className="text-sm">{TIPO_ATIVIDADE_LABELS[a.tipo as keyof typeof TIPO_ATIVIDADE_LABELS] || a.tipo}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{a.local_atividade}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(a.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{a.credibilidade_status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{a.origem === 'atleta_id' ? '🔗 Atleta ID' : '📱 Carreira'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={a.tornar_publico ? 'default' : 'secondary'} className={a.tornar_publico ? 'bg-blue-500/10 text-blue-600' : ''}>
                              {a.tornar_publico ? 'Sim' : 'Não'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </CarreiraAdminLayout>
  );
}
