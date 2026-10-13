import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

interface PeneiraAdmin {
  id: string; titulo: string; descricao: string | null; data_evento: string; local_nome: string; local_endereco: string | null;
  cidade: string | null; estado: string | null; modalidade: string; categorias: string[] | null; vagas: number | null; requisitos: string | null;
  contato_whatsapp: string | null; contato_email: string | null; status: string; aprovacao_status: string; aprovacao_nota: string | null;
  created_at: string; organizador: string | null; organizador_tipo: string | null; organizador_verificado: boolean; convites: number;
}
interface Organizador {
  id: string; user_id: string; nome: string; tipo: string; cidade: string | null; verificado: boolean; verificado_em: string | null; created_at: string; peneiras: number;
}

const TIPO: Record<string, string> = { tecnico: 'Técnico', scout: 'Scout', agente_clube: 'Agente/Clube', dono_escola: 'Dono de escola' };
const STATUS: Record<string, string> = { em_analise: 'Em análise', aprovada: 'Aprovada', recusada: 'Recusada' };

const rpc = async <T,>(nome: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await (supabase as any).rpc(nome, args ?? {});
  if (error) throw error;
  return data as T;
};
const dataBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

function PeneirasTab() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<'em_analise' | 'todas'>('em_analise');
  const [aberta, setAberta] = useState<PeneiraAdmin | null>(null);
  const [nota, setNota] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-peneiras', filtro],
    queryFn: () => rpc<PeneiraAdmin[]>('admin_listar_peneiras', { p_status: filtro === 'todas' ? null : 'em_analise' }),
    refetchOnMount: true,
  });
  const decidir = useMutation({
    mutationFn: (aprovar: boolean) => rpc('admin_aprovar_peneira', { p_id: aberta!.id, p_aprovar: aprovar, p_nota: nota.trim() || null }),
    onSuccess: () => { toast.success('Decisão salva'); qc.invalidateQueries({ queryKey: ['admin-peneiras'] }); setAberta(null); },
    onError: () => toast.error('Não consegui salvar'),
  });

  return (
    <div className="space-y-3">
      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as 'em_analise' | 'todas')}>
        <TabsList><TabsTrigger value="em_analise">Em análise</TabsTrigger><TabsTrigger value="todas">Todas</TabsTrigger></TabsList>
      </Tabs>
      <Card>
        <CardContent className="overflow-x-auto pt-4">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Criada</TableHead><TableHead>Peneira</TableHead><TableHead>Organizador</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Convites</TableHead><TableHead>Situação</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(data || []).map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => { setAberta(p); setNota(p.aprovacao_nota ?? ''); }}>
                    <TableCell className="whitespace-nowrap">{dataBR(p.created_at)}</TableCell>
                    <TableCell className="max-w-[220px] truncate font-medium">{p.titulo}</TableCell>
                    <TableCell>{p.organizador || '—'} <span className="text-xs text-muted-foreground">{p.organizador_tipo ? TIPO[p.organizador_tipo] : ''}</span></TableCell>
                    <TableCell className="whitespace-nowrap">{dataBR(p.data_evento)}</TableCell>
                    <TableCell className="text-right">{p.convites}</TableCell>
                    <TableCell><Badge variant={p.aprovacao_status === 'em_analise' ? 'destructive' : 'outline'}>{STATUS[p.aprovacao_status]}</Badge></TableCell>
                  </TableRow>
                ))}
                {data && data.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{filtro === 'em_analise' ? 'Nenhuma peneira esperando análise.' : 'Nenhuma peneira ainda.'}</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{aberta?.titulo}</DialogTitle></DialogHeader>
          {aberta && (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">
                Organizador: <b className="text-foreground">{aberta.organizador || '—'}</b> {aberta.organizador_verificado ? '(verificado)' : '(NÃO verificado)'}
              </p>
              <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-xs">
                <p><span className="text-muted-foreground">Quando: </span>{dataBR(aberta.data_evento)}</p>
                <p><span className="text-muted-foreground">Local: </span>{aberta.local_nome}{aberta.cidade ? `, ${aberta.cidade}` : ''}{aberta.estado ? ` - ${aberta.estado}` : ''}</p>
                <p><span className="text-muted-foreground">Endereço: </span>{aberta.local_endereco || '—'}</p>
                <p><span className="text-muted-foreground">Contato: </span>{[aberta.contato_whatsapp, aberta.contato_email].filter(Boolean).join(' · ') || '—'}</p>
                <p><span className="text-muted-foreground">Categorias: </span>{aberta.categorias?.join(', ') || 'todas'}{aberta.vagas ? ` · ${aberta.vagas} vagas` : ''}</p>
              </div>
              {aberta.descricao && <p className="whitespace-pre-wrap text-xs">{aberta.descricao}</p>}
              {aberta.requisitos && <p className="whitespace-pre-wrap text-xs"><span className="text-muted-foreground">Requisitos: </span>{aberta.requisitos}</p>}
              <div className="rounded-md bg-amber-500/10 p-2 text-[11px] text-muted-foreground">
                Confira: sem cobrança, local identificável (clube, CT ou escola), organizador conhecido e texto sem promessas de contrato ou ganho.
              </div>
              <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota para o organizador (obrigatória ao recusar)" rows={2} />
              <div className="flex gap-2">
                <Button size="sm" disabled={decidir.isPending || !aberta.organizador_verificado} onClick={() => decidir.mutate(true)}>Aprovar</Button>
                <Button size="sm" variant="destructive" disabled={decidir.isPending || !nota.trim()} onClick={() => decidir.mutate(false)}>Recusar</Button>
              </div>
              {!aberta.organizador_verificado && <p className="text-[11px] text-muted-foreground">Verifique o organizador na aba Organizadores antes de aprovar.</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrganizadoresTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-organizadores'], queryFn: () => rpc<Organizador[]>('admin_listar_organizadores'), refetchOnMount: true });
  const verificar = useMutation({
    mutationFn: (a: { id: string; v: boolean }) => rpc('admin_verificar_organizador', { p_id: a.id, p_verificado: a.v }),
    onSuccess: () => { toast.success('Atualizado'); qc.invalidateQueries({ queryKey: ['admin-organizadores'] }); },
    onError: () => toast.error('Não consegui salvar'),
  });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Só perfis verificados criam peneiras. Verifique depois de conferir quem é a pessoa (escola, clube, documento ou indicação conhecida).</p>
      <Card>
        <CardContent className="overflow-x-auto pt-4">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Cidade</TableHead><TableHead>Cadastro</TableHead><TableHead className="text-right">Peneiras</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data || []).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.nome}</TableCell>
                    <TableCell>{TIPO[o.tipo] ?? o.tipo}</TableCell>
                    <TableCell>{o.cidade || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{dataBR(o.created_at)}</TableCell>
                    <TableCell className="text-right">{o.peneiras}</TableCell>
                    <TableCell>
                      {o.verificado ? (
                        <Button size="sm" variant="outline" className="gap-1.5 text-green-600" disabled={verificar.isPending} onClick={() => verificar.mutate({ id: o.id, v: false })}>
                          <BadgeCheck className="h-4 w-4" />Verificado (remover)
                        </Button>
                      ) : (
                        <Button size="sm" disabled={verificar.isPending} onClick={() => verificar.mutate({ id: o.id, v: true })}>Verificar</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {data && data.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum técnico, scout, agente ou escola cadastrado ainda.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CarreiraAdminPeneirasPage() {
  const [aba, setAba] = useState<'peneiras' | 'organizadores'>('peneiras');
  return (
    <CarreiraAdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Peneiras</h1>
          <p className="text-muted-foreground">Verifique quem organiza e aprove cada peneira antes de ela poder convidar atletas.</p>
        </div>
        <Tabs value={aba} onValueChange={(v) => setAba(v as 'peneiras' | 'organizadores')}>
          <TabsList><TabsTrigger value="peneiras">Peneiras</TabsTrigger><TabsTrigger value="organizadores">Organizadores</TabsTrigger></TabsList>
        </Tabs>
        {aba === 'peneiras' ? <PeneirasTab /> : <OrganizadoresTab />}
      </div>
    </CarreiraAdminLayout>
  );
}
