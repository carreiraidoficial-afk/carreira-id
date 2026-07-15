import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw, Database, Shield, Users, FileText, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface HealthCheck {
  name: string;
  description: string;
  status: 'ok' | 'warning' | 'error' | 'loading';
  detail?: string;
  resolvePath?: string;
  resolveLabel?: string;
}

function useHealthChecks() {
  return useQuery({
    queryKey: ['admin-health-checks'],
    queryFn: async () => {
      const checks: HealthCheck[] = [];

      // 1. Check criancas table insert (RLS)
      try {
        const testId = crypto.randomUUID();
        const { error } = await supabase
          .from('criancas')
          .insert({ id: testId, nome: '__health_check_test__', ativo: false })
          .select('id')
          .single();

        if (error) {
          checks.push({ name: 'Inserção Criancas (RLS)', description: 'Verifica se usuários autenticados podem criar registros', status: 'error', detail: error.message });
        } else {
          // Clean up
          await supabase.from('criancas').delete().eq('id', testId);
          checks.push({ name: 'Inserção Criancas (RLS)', description: 'Verifica se usuários autenticados podem criar registros', status: 'ok' });
        }
      } catch (err: any) {
        checks.push({ name: 'Inserção Criancas (RLS)', description: 'Verifica se usuários autenticados podem criar registros', status: 'error', detail: err.message });
      }

      // 2. Check perfil_atleta table read
      try {
        const { error } = await supabase.from('perfil_atleta').select('id').limit(1);
        checks.push({
          name: 'Leitura Perfil Atleta',
          description: 'Verifica se a tabela perfil_atleta está acessível',
          status: error ? 'error' : 'ok',
          detail: error?.message,
        });
      } catch (err: any) {
        checks.push({ name: 'Leitura Perfil Atleta', description: 'Verifica se a tabela perfil_atleta está acessível', status: 'error', detail: err.message });
      }

      // 3. Check storage bucket
      try {
        const { data, error } = await supabase.storage.from('atleta-fotos').list('', { limit: 1 });
        checks.push({
          name: 'Storage (atleta-fotos)',
          description: 'Verifica se o bucket de fotos está acessível',
          status: error ? 'error' : 'ok',
          detail: error?.message,
        });
      } catch (err: any) {
        checks.push({ name: 'Storage (atleta-fotos)', description: 'Verifica se o bucket de fotos está acessível', status: 'error', detail: err.message });
      }

      // 4. Check carreira-assets bucket
      try {
        const { error } = await supabase.storage.from('carreira-assets').list('', { limit: 1 });
        checks.push({
          name: 'Storage (carreira-assets)',
          description: 'Bucket de assets do carreira',
          status: error ? 'error' : 'ok',
          detail: error?.message,
        });
      } catch (err: any) {
        checks.push({ name: 'Storage (carreira-assets)', description: 'Bucket de assets do carreira', status: 'error', detail: err.message });
      }

      // 5. Check perfis_rede insert capability
      try {
        const { error } = await supabase.from('perfis_rede').select('id').limit(1);
        checks.push({
          name: 'Leitura Perfis Rede',
          description: 'Verifica se perfis de rede profissional estão acessíveis',
          status: error ? 'error' : 'ok',
          detail: error?.message,
        });
      } catch (err: any) {
        checks.push({ name: 'Leitura Perfis Rede', description: 'Verifica se perfis de rede profissional estão acessíveis', status: 'error', detail: err.message });
      }

      // 6. Check peneiras table
      try {
        const { error } = await supabase.from('peneiras').select('id').limit(1);
        checks.push({
          name: 'Leitura Peneiras',
          description: 'Verifica se eventos/peneiras estão acessíveis',
          status: error ? 'error' : 'ok',
          detail: error?.message,
        });
      } catch (err: any) {
        checks.push({ name: 'Leitura Peneiras', description: 'Verifica se eventos/peneiras estão acessíveis', status: 'error', detail: err.message });
      }

      // 7. Check auth session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        checks.push({
          name: 'Sessão Auth',
          description: 'Verifica se a sessão do admin está ativa',
          status: session ? 'ok' : 'error',
          detail: session ? `Logado como ${session.user.email}` : 'Sem sessão ativa',
        });
      } catch (err: any) {
        checks.push({ name: 'Sessão Auth', description: 'Verifica se a sessão do admin está ativa', status: 'error', detail: err.message });
      }

      // 8. Stats
      try {
        const { count: totalPerfis } = await supabase.from('perfil_atleta').select('id', { count: 'exact', head: true });
        const { count: totalRede } = await supabase.from('perfis_rede').select('id', { count: 'exact', head: true });
        const { count: totalPeneiras } = await supabase.from('peneiras').select('id', { count: 'exact', head: true });
        
        checks.push({
          name: 'Contagem de Registros',
          description: 'Total de registros nas tabelas principais',
          status: 'ok',
          detail: `Atletas: ${totalPerfis || 0} | Rede: ${totalRede || 0} | Peneiras: ${totalPeneiras || 0}`,
        });
      } catch (err: any) {
        checks.push({ name: 'Contagem de Registros', description: 'Total de registros nas tabelas principais', status: 'warning', detail: err.message });
      }

      // 9. Check for profiles without crianca_id (potential orphans)
      try {
        const { data: orphans } = await supabase
          .from('perfil_atleta')
          .select('id, nome, slug')
          .is('crianca_id', null)
          .limit(5);

        const orphanCount = orphans?.length || 0;
        checks.push({
          name: 'Perfis sem Criança vinculada',
          description: 'Perfis de atleta sem crianca_id associado',
          status: orphanCount > 0 ? 'warning' : 'ok',
          detail: orphanCount > 0
            ? `${orphanCount} perfis sem vínculo: ${orphans!.map(o => o.nome).join(', ')}`
            : 'Todos os perfis têm vínculo',
          resolvePath: orphanCount === 1
            ? `/carreira/admin/perfis?q=${encodeURIComponent(orphans![0].nome)}`
            : orphanCount > 1 ? '/carreira/admin/perfis' : undefined,
          resolveLabel: 'Ver perfil(is)',
        });
      } catch (err: any) {
        checks.push({ name: 'Perfis sem Criança vinculada', description: 'Perfis de atleta sem crianca_id associado', status: 'warning', detail: err.message });
      }

      // 10. Recent registration failures (profiles created in last 24h)
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recent, count } = await supabase
          .from('perfil_atleta')
          .select('id, nome, created_at', { count: 'exact' })
          .gte('created_at', oneDayAgo)
          .order('created_at', { ascending: false })
          .limit(5);
        
        checks.push({
          name: 'Cadastros Recentes (24h)',
          description: 'Novos perfis criados nas últimas 24 horas',
          status: 'ok',
          detail: `${count || 0} novos perfis${recent?.length ? ': ' + recent.map(r => r.nome).join(', ') : ''}`,
        });
      } catch (err: any) {
        checks.push({ name: 'Cadastros Recentes (24h)', description: 'Novos perfis criados nas últimas 24 horas', status: 'warning', detail: err.message });
      }

      // 11. Assinaturas duplicadas (trial + ativa/pendente pra mesma criança ao mesmo tempo)
      try {
        const { data: assinaturasEmVigor } = await supabase
          .from('carreira_assinaturas')
          .select('crianca_id')
          .in('status', ['trial', 'ativa', 'pendente']);
        const criancaCounts = new Map<string, number>();
        (assinaturasEmVigor || []).forEach((a: any) => {
          if (!a.crianca_id) return;
          criancaCounts.set(a.crianca_id, (criancaCounts.get(a.crianca_id) || 0) + 1);
        });
        const criancaIdsDuplicadas = [...criancaCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id);
        let resolvePath: string | undefined;
        let nomesDuplicados = '';
        if (criancaIdsDuplicadas.length > 0) {
          const { data: criancasDup } = await supabase
            .from('criancas')
            .select('nome')
            .in('id', criancaIdsDuplicadas);
          nomesDuplicados = (criancasDup || []).map((c: any) => c.nome).join(', ');
          resolvePath = criancaIdsDuplicadas.length === 1 && criancasDup?.[0]?.nome
            ? `/carreira/admin/assinaturas?q=${encodeURIComponent(criancasDup[0].nome)}`
            : '/carreira/admin/assinaturas';
        }
        checks.push({
          name: 'Assinaturas duplicadas por atleta',
          description: 'Atletas com mais de uma assinatura em vigor (trial/ativa/pendente) ao mesmo tempo',
          status: criancaIdsDuplicadas.length > 0 ? 'error' : 'ok',
          detail: criancaIdsDuplicadas.length > 0 ? `${criancaIdsDuplicadas.length} atleta(s): ${nomesDuplicados}` : undefined,
          resolvePath,
          resolveLabel: 'Ver assinaturas',
        });
      } catch (err: any) {
        checks.push({ name: 'Assinaturas duplicadas por atleta', description: 'Atletas com mais de uma assinatura em vigor ao mesmo tempo', status: 'warning', detail: err.message });
      }

      // 12. Perfis legados "pai_responsavel" sem migração para perfil de atleta próprio
      try {
        const { data: paiResponsavelRows } = await supabase
          .from('perfis_rede')
          .select('user_id, nome')
          .eq('tipo', 'pai_responsavel');
        let semMigracaoNomes: string[] = [];
        if (paiResponsavelRows && paiResponsavelRows.length > 0) {
          const userIds = paiResponsavelRows.map((r: any) => r.user_id);
          const { data: atletasVinculados } = await supabase
            .from('perfil_atleta')
            .select('user_id')
            .in('user_id', userIds);
          const comAtleta = new Set((atletasVinculados || []).map((a: any) => a.user_id));
          semMigracaoNomes = paiResponsavelRows.filter((r: any) => !comAtleta.has(r.user_id)).map((r: any) => r.nome);
        }
        checks.push({
          name: 'Perfis legados sem migração',
          description: 'Contas do tipo antigo "pai_responsavel" sem perfil de atleta próprio vinculado',
          status: semMigracaoNomes.length > 0 ? 'warning' : 'ok',
          detail: semMigracaoNomes.length > 0 ? `${semMigracaoNomes.length}: ${semMigracaoNomes.join(', ')}` : undefined,
          // Sem resolvePath: a aba Rede do admin exclui esse tipo legado da listagem hoje.
        });
      } catch (err: any) {
        checks.push({ name: 'Perfis legados sem migração', description: 'Contas antigas sem perfil de atleta vinculado', status: 'warning', detail: err.message });
      }

      // 13. Atletas sem nenhuma assinatura (nem trial)
      try {
        const { data: atletasComCrianca } = await supabase
          .from('perfil_atleta')
          .select('nome, crianca_id')
          .not('crianca_id', 'is', null);
        let atletasSemAssinatura: any[] = [];
        if (atletasComCrianca && atletasComCrianca.length > 0) {
          const criancaIds = atletasComCrianca.map((a: any) => a.crianca_id);
          const { data: assinaturasExistentes } = await supabase
            .from('carreira_assinaturas')
            .select('crianca_id')
            .in('crianca_id', criancaIds);
          const comAssinatura = new Set((assinaturasExistentes || []).map((a: any) => a.crianca_id));
          atletasSemAssinatura = atletasComCrianca.filter((a: any) => !comAssinatura.has(a.crianca_id));
        }
        checks.push({
          name: 'Atletas sem nenhuma assinatura',
          description: 'Perfis de atleta que nunca tiveram trial nem assinatura criada',
          status: atletasSemAssinatura.length > 0 ? 'warning' : 'ok',
          detail: atletasSemAssinatura.length > 0 ? `${atletasSemAssinatura.length}: ${atletasSemAssinatura.map(a => a.nome).join(', ')}` : undefined,
          resolvePath: atletasSemAssinatura.length === 1
            ? `/carreira/admin/perfis?q=${encodeURIComponent(atletasSemAssinatura[0].nome)}`
            : atletasSemAssinatura.length > 1 ? '/carreira/admin/perfis' : undefined,
          resolveLabel: 'Ver perfil(is)',
        });
      } catch (err: any) {
        checks.push({ name: 'Atletas sem nenhuma assinatura', description: 'Perfis sem trial nem assinatura', status: 'warning', detail: err.message });
      }

      return checks;
    },
    refetchOnWindowFocus: false,
  });
}

const statusIcon = (status: string) => {
  if (status === 'ok') return <CheckCircle className="w-5 h-5 text-green-500" />;
  if (status === 'warning') return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  if (status === 'error') return <XCircle className="w-5 h-5 text-red-500" />;
  return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
};

const statusBadge = (status: string) => {
  if (status === 'ok') return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">OK</Badge>;
  if (status === 'warning') return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Atenção</Badge>;
  if (status === 'error') return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Erro</Badge>;
  return <Badge variant="outline">Verificando...</Badge>;
};

export default function CarreiraAdminDiagnosticoPage() {
  const navigate = useNavigate();
  const { data: checks, isLoading, refetch, isFetching } = useHealthChecks();

  const summary = checks?.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <CarreiraAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Diagnóstico do Sistema</h1>
            <p className="text-muted-foreground text-sm">
              Verificação de saúde das tabelas, storage e fluxos críticos
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetch(); toast.info('Executando verificações...'); }}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Reexecutar
          </Button>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{summary.ok || 0}</p>
                  <p className="text-xs text-muted-foreground">OK</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{summary.warning || 0}</p>
                  <p className="text-xs text-muted-foreground">Atenção</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <XCircle className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{summary.error || 0}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Health checks list */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {checks?.map((check, i) => (
              <Card key={i}>
                <CardContent className="py-4 flex items-center gap-4">
                  {statusIcon(check.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{check.name}</p>
                      {statusBadge(check.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">{check.description}</p>
                    {check.detail && (
                      <p className={`text-xs mt-1 ${check.status === 'error' ? 'text-red-400' : check.status === 'warning' ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                        {check.detail}
                      </p>
                    )}
                  </div>
                  {check.resolvePath && (
                    <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => navigate(check.resolvePath!)}>
                      {check.resolveLabel || 'Resolver'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </CarreiraAdminLayout>
  );
}
