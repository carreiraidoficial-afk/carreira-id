import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2 } from 'lucide-react';
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
import { MOTIVOS_DENUNCIA } from '@/components/carreira/DenunciarDialog';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';

interface Denuncia {
  id: string; tipo_conteudo: string; conteudo_id: string; motivo: string; detalhes: string | null; trecho: string | null;
  status: string; acao_tomada: string | null; nota_admin: string | null; revisado_em: string | null; created_at: string;
  autor_id: string | null; denunciante_id: string; denunciante_nome: string | null; autor_nome: string | null;
  total_do_conteudo: number; conteudo_existe: boolean; perfil_slug: string | null;
}

const TIPO: Record<string, string> = { post: 'Publicação', comentario: 'Comentário', perfil_atleta: 'Perfil de atleta', perfil_rede: 'Perfil profissional' };
const MOTIVO = Object.fromEntries(MOTIVOS_DENUNCIA.map((m) => [m.valor, m.rotulo]));
const STATUS: Record<string, string> = { pendente: 'Pendente', procedente: 'Procedente', improcedente: 'Improcedente' };

const rpc = async <T,>(nome: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await (supabase as any).rpc(nome, args ?? {});
  if (error) throw error;
  return data as T;
};

const dataBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Link para ver o conteúdo denunciado, quando ele tem uma página própria. */
function linkDoConteudo(d: Denuncia): string | null {
  if (!d.conteudo_existe) return null;
  if (d.tipo_conteudo === 'post') return carreiraPath(`/post/${d.conteudo_id}`);
  if (d.tipo_conteudo === 'perfil_atleta' && d.perfil_slug) return carreiraPath(`/${d.perfil_slug}`);
  if (d.tipo_conteudo === 'perfil_rede' && d.autor_id) return carreiraPath(`/perfil/${d.autor_id}`);
  return null;
}

export default function CarreiraAdminDenunciasPage() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<'pendente' | 'todas'>('pendente');
  const [aberta, setAberta] = useState<Denuncia | null>(null);
  const [nota, setNota] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-denuncias', filtro],
    queryFn: () => rpc<Denuncia[]>('admin_listar_denuncias', { p_status: filtro === 'pendente' ? 'pendente' : null }),
    refetchOnMount: true,
  });

  const resolver = useMutation({
    mutationFn: (a: { procedente: boolean; remover: boolean }) =>
      rpc('admin_resolver_denuncia', { p_id: aberta!.id, p_procedente: a.procedente, p_remover: a.remover, p_nota: nota.trim() || null }),
    onSuccess: () => {
      toast.success('Denúncia resolvida');
      qc.invalidateQueries({ queryKey: ['admin-denuncias'] });
      qc.invalidateQueries({ queryKey: ['admin-denuncias-pendentes'] });
      setAberta(null);
    },
    onError: () => toast.error('Não consegui salvar a decisão'),
  });

  const abrir = (d: Denuncia) => { setAberta(d); setNota(d.nota_admin ?? ''); };
  const podeRemover = aberta && aberta.conteudo_existe && (aberta.tipo_conteudo === 'post' || aberta.tipo_conteudo === 'comentario');
  const link = aberta ? linkDoConteudo(aberta) : null;

  return (
    <CarreiraAdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Denúncias</h1>
          <p className="text-muted-foreground">Conteúdos que os usuários denunciaram. Decida se procede e, no caso de publicação ou comentário, se deve ser removido.</p>
        </div>
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as 'pendente' | 'todas')}>
          <TabsList>
            <TabsTrigger value="pendente">Pendentes</TabsTrigger>
            <TabsTrigger value="todas">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <Card>
          <CardContent className="overflow-x-auto pt-4">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : error ? (
              <p className="py-6 text-center text-destructive">Não consegui carregar as denúncias.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Motivo</TableHead><TableHead>Trecho</TableHead>
                    <TableHead>Autor</TableHead><TableHead className="text-right">Denúncias</TableHead><TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data || []).map((d) => (
                    <TableRow key={d.id} className="cursor-pointer" onClick={() => abrir(d)}>
                      <TableCell className="whitespace-nowrap">{dataBR(d.created_at)}</TableCell>
                      <TableCell>{TIPO[d.tipo_conteudo]}</TableCell>
                      <TableCell>{MOTIVO[d.motivo] ?? d.motivo}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{d.trecho || '—'}</TableCell>
                      <TableCell>{d.autor_nome || '—'}</TableCell>
                      <TableCell className="text-right">{d.total_do_conteudo}</TableCell>
                      <TableCell><Badge variant={d.status === 'pendente' ? 'destructive' : 'outline'}>{STATUS[d.status]}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {data && data.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      {filtro === 'pendente' ? 'Nenhuma denúncia pendente. 🎉' : 'Nenhuma denúncia registrada ainda.'}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{aberta && TIPO[aberta.tipo_conteudo]} denunciado</DialogTitle>
          </DialogHeader>
          {aberta && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border bg-muted/40 p-3 whitespace-pre-wrap">{aberta.trecho || 'Sem texto.'}</div>
              {!aberta.conteudo_existe && <p className="text-xs text-amber-600">Este conteúdo já foi apagado.</p>}
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Motivo: <b className="text-foreground">{MOTIVO[aberta.motivo] ?? aberta.motivo}</b></div>
                <div>Denúncias do mesmo conteúdo: <b className="text-foreground">{aberta.total_do_conteudo}</b></div>
                <div>Autor: <b className="text-foreground">{aberta.autor_nome || '—'}</b></div>
                <div>Denunciante: <b className="text-foreground">{aberta.denunciante_nome || '—'}</b></div>
              </div>
              {aberta.detalhes && <p className="text-xs"><span className="text-muted-foreground">Explicação do denunciante: </span>{aberta.detalhes}</p>}
              {link && (
                <Link to={link} target="_blank" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />Abrir o conteúdo
                </Link>
              )}
              {aberta.status === 'pendente' ? (
                <>
                  <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Anotação interna (opcional)" rows={2} />
                  <div className="flex flex-wrap gap-2">
                    {podeRemover && (
                      <Button variant="destructive" size="sm" disabled={resolver.isPending} onClick={() => resolver.mutate({ procedente: true, remover: true })}>
                        Procede: remover conteúdo
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" disabled={resolver.isPending} onClick={() => resolver.mutate({ procedente: true, remover: false })}>
                      Procede: manter
                    </Button>
                    <Button size="sm" variant="outline" disabled={resolver.isPending} onClick={() => resolver.mutate({ procedente: false, remover: false })}>
                      Não procede
                    </Button>
                  </div>
                  {(aberta.tipo_conteudo === 'perfil_atleta' || aberta.tipo_conteudo === 'perfil_rede') && (
                    <p className="text-xs text-muted-foreground">Para suspender ou excluir um perfil, use a tela Perfis. Aqui você só registra a decisão.</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {STATUS[aberta.status]}{aberta.acao_tomada === 'conteudo_removido' ? ' · conteúdo removido' : ''}
                  {aberta.revisado_em ? ` · em ${dataBR(aberta.revisado_em)}` : ''}{aberta.nota_admin ? ` · ${aberta.nota_admin}` : ''}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CarreiraAdminLayout>
  );
}
