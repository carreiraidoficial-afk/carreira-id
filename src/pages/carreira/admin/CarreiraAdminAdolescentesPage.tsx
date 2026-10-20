import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, UserCheck } from 'lucide-react';

interface Resumo {
  iniciaram: number; aguardando: number; enviaram: number; responsavel_abriu: number;
  aprovados: number; expirados: number; recusados: number;
}
interface Linha {
  id: string; nome: string; idade: number; modalidade: string; categoria: string | null; local: string | null;
  escola: string | null; responsavel: string; telefone_mascarado: string | null;
  status: 'pendente' | 'aprovado' | 'recusado' | 'expirado';
  criado_em: string; enviado_em: string | null; link_aberto_em: string | null; link_aberturas: number;
  anuencia_em: string | null; expira_em: string; reenvios: number;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

const STATUS: Record<Linha['status'], { rotulo: string; classe: string }> = {
  pendente: { rotulo: 'Aguardando responsável', classe: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  aprovado: { rotulo: 'Autorizado', classe: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  expirado: { rotulo: 'Link vencido', classe: 'bg-muted text-muted-foreground' },
  recusado: { rotulo: 'Recusado', classe: 'bg-destructive/10 text-destructive border-destructive/30' },
};

/** Onde o adolescente parou: dá para ver se travou antes de mandar o pedido ou se o responsável não abriu o link. */
function etapa(l: Linha): string {
  if (l.status === 'aprovado') return 'Concluído';
  if (l.status === 'recusado') return 'Responsável recusou';
  if (!l.enviado_em) return 'Não mandou o pedido';
  if (!l.link_aberto_em) return 'Mandou; responsável não abriu';
  return 'Responsável abriu; não autorizou';
}

export default function CarreiraAdminAdolescentesPage() {
  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ['admin-pre-cadastros'],
    queryFn: async (): Promise<{ resumo: Resumo; linhas: Linha[] }> => {
      const { data, error } = await (supabase as any).rpc('admin_pre_cadastros');
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const r = data?.resumo;
  const pct = (n: number) => (r && r.iniciaram > 0 ? `${Math.round((n / r.iniciaram) * 100)}%` : '—');
  const passos = r ? [
    { rotulo: 'Iniciaram o cadastro', valor: r.iniciaram, sub: '100%' },
    { rotulo: 'Tocaram em enviar ao responsável', valor: r.enviaram, sub: pct(r.enviaram) },
    { rotulo: 'Responsável abriu o link', valor: r.responsavel_abriu, sub: pct(r.responsavel_abriu) },
    { rotulo: 'Autorizados', valor: r.aprovados, sub: pct(r.aprovados) },
  ] : [];

  return (
    <CarreiraAdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><UserCheck className="w-6 h-6" /> Cadastro de adolescentes</h1>
            <p className="text-sm text-muted-foreground">
              Atletas de 12 a 17 anos que iniciaram o cadastro e esperam a autorização do responsável. Pedidos vencidos e recusados são apagados 14 dias depois.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>

        {isLoading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
        {error && <p className="text-sm text-destructive">Não foi possível carregar: {(error as Error).message}</p>}

        {r && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {passos.map((p) => (
                <Card key={p.rotulo}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{p.rotulo}</p>
                    <p className="text-2xl font-bold">{p.valor}</p>
                    <p className="text-xs text-muted-foreground">{p.sub} de quem iniciou</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Aguardando agora: {r.aguardando}</Badge>
              <Badge variant="outline">Link vencido: {r.expirados}</Badge>
              <Badge variant="outline">Recusados: {r.recusados}</Badge>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Pedidos ({data!.linhas.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                {data!.linhas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhum adolescente iniciou o cadastro ainda.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atleta</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Onde parou</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Iniciou</TableHead>
                        <TableHead>Enviou</TableHead>
                        <TableHead>Abriu o link</TableHead>
                        <TableHead>Autorizou</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.linhas.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="whitespace-nowrap">
                            <p className="font-medium">{l.nome}, {l.idade} anos</p>
                            <p className="text-xs text-muted-foreground">{[l.modalidade, l.categoria, l.local].filter(Boolean).join(' · ')}</p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <p>{l.responsavel}</p>
                            <p className="text-xs text-muted-foreground">{l.telefone_mascarado || '—'}</p>
                          </TableCell>
                          <TableCell className="text-xs">{l.escola ? `Escola ${l.escola}` : 'Cadastro direto'}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{etapa(l)}{l.reenvios > 0 ? ` · ${l.reenvios} reenvio(s)` : ''}</TableCell>
                          <TableCell><Badge variant="outline" className={STATUS[l.status].classe}>{STATUS[l.status].rotulo}</Badge></TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmt(l.criado_em)}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmt(l.enviado_em)}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmt(l.link_aberto_em)}{l.link_aberturas > 1 ? ` (${l.link_aberturas}x)` : ''}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmt(l.anuencia_em)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">
              Por privacidade, só aparecem o primeiro nome e a inicial do sobrenome do atleta, e o telefone do responsável fica mascarado. "Tocaram em enviar" mostra que o adolescente chegou ao botão do WhatsApp, mas não prova que a mensagem foi enviada.
            </p>
          </>
        )}
      </div>
    </CarreiraAdminLayout>
  );
}
