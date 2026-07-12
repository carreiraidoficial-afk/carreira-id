import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Loader2, CreditCard, QrCode, RefreshCw } from 'lucide-react';
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

const METODO_ICON: Record<string, React.ReactNode> = {
  cartao_credito: <CreditCard className="w-3.5 h-3.5" />,
  pix: <QrCode className="w-3.5 h-3.5" />,
};

const METODO_LABEL: Record<string, string> = {
  cartao_credito: 'Cartão',
  pix: 'PIX',
};

export default function CarreiraAdminAssinaturasPage() {
  const [search, setSearch] = useState('');
  const [renewLoading, setRenewLoading] = useState(false);
  const queryClient = useQueryClient();
  const { data: assinaturas, isLoading } = useAdminAssinaturas(search);
  const ativas = assinaturas?.filter((a: any) => a.status === 'ativa').length || 0;
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assinaturas.map((ass: any) => (
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
                      <TableCell><Badge variant="outline" className="text-xs">{ass.plano_display}</Badge></TableCell>
                      <TableCell className="text-sm font-medium">
                        {ass.valor_display > 0 ? `R$ ${Number(ass.valor_display).toFixed(2).replace('.', ',')}` : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          {METODO_ICON[ass.metodo_pagamento] || null}
                          <span>{METODO_LABEL[ass.metodo_pagamento] || ass.metodo_pagamento || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ass.status === 'ativa' ? 'default' : 'secondary'}
                          className={
                            ass.status === 'ativa' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : ass.status === 'trial' ? 'bg-violet-500/10 text-violet-600 border-violet-500/20'
                            : ''
                          }>
                          {ass.status === 'ativa' ? 'Ativa'
                            : ass.status === 'trial' ? 'Trial'
                            : ass.status === 'cancelada' ? 'Cancelada'
                            : ass.status === 'pendente' ? 'Pendente'
                            : ass.status === 'expirada' ? 'Expirada'
                            : ass.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(ass.inicio_em), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ass.status === 'cancelada' && ass.cancelada_em
                          ? <span className="text-destructive">{format(new Date(ass.cancelada_em), 'dd/MM/yyyy', { locale: ptBR })}</span>
                          : ass.expira_em
                            ? format(new Date(ass.expira_em), 'dd/MM/yyyy', { locale: ptBR })
                            : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </CarreiraAdminLayout>
  );
}
