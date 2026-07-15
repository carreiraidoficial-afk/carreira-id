import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ---------- Types ----------
export interface DiagUser {
  id: string;
  email: string;
  role: string;
}

export interface TableCheck {
  name: string;
  count: number;
  status: 'ok' | 'warning' | 'error';
  detail?: string;
}

export interface SecurityCheck {
  name: string;
  count: number;
  status: 'protected' | 'public';
}

export interface ErrorCheck {
  label: string;
  description: string;
  count: number;
  status: 'ok' | 'warning' | 'error';
  /** Rota do admin pra onde o botão "Resolver" leva (já com busca pré-preenchida quando possível). */
  resolvePath?: string;
  resolveLabel?: string;
}

export interface BucketInfo {
  name: string;
  fileCount: number;
  isPublic: boolean;
}

export interface QuerySpeed {
  label: string;
  latencyMs: number;
}

export interface HealthMetrics {
  tables: TableCheck[];
  totalRecords: number;
  executionMs: number;
  executedAt: Date;
}

export interface SecurityMetrics {
  tables: SecurityCheck[];
  protectedCount: number;
  publicCount: number;
  totalCount: number;
  executionMs: number;
  executedAt: Date;
}

export interface ErrorMetrics {
  checks: ErrorCheck[];
  totalProblems: number;
  executionMs: number;
  executedAt: Date;
}

export interface StorageMetrics {
  buckets: BucketInfo[];
  totalFiles: number;
  userBreakdown: { label: string; count: number; color: string }[];
  executionMs: number;
  executedAt: Date;
}

export interface PerformanceMetrics {
  servicePings: { label: string; latencyMs: number; status: 'ok' | 'warning' | 'error' }[];
  querySpeeds: QuerySpeed[];
  executionMs: number;
  executedAt: Date;
}

export interface OverviewMetrics {
  perfisTotal: number;
  perfisAtivos: number;
  perfisPublicos: number;
  perfisRede: number;
  postsTotal: number;
  posts7d: number;
  conexoesAceitas: number;
  conexoesPendentes: number;
  followsTotal: number;
  likesTotal: number;
  comentariosTotal: number;
  assAtivas: number;
  assCanceladas: number;
  assTotal: number;
  atividadesTotal: number;
  experienciasTotal: number;
  executionMs: number;
  executedAt: Date;
}

// ---------- Carreira-only tables ----------
const CARREIRA_TABLES = [
  'perfil_atleta',
  'perfis_rede',
  'posts_atleta',
  'post_likes',
  'post_comentarios',
  'atleta_follows',
  'rede_conexoes',
  'rede_convites',
  'carreira_assinaturas',
  'carreira_experiencias',
  'atividades_externas',
  'atividades_externas_whitelist',
  'criancas',
  'profiles',
  'user_roles',
  'saas_config',
];

// Tables that should have RLS
const SHOULD_HAVE_RLS = [
  'perfil_atleta',
  'perfis_rede',
  'posts_atleta',
  'post_likes',
  'post_comentarios',
  'atleta_follows',
  'rede_conexoes',
  'rede_convites',
  'carreira_assinaturas',
  'carreira_experiencias',
  'atividades_externas',
  'atividades_externas_whitelist',
  'profiles',
  'user_roles',
];

// ---------- Hook ----------
export function useCarreiraDiagnostico() {
  const { user } = useAuth();
  const [loadingTab, setLoadingTab] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const [security, setSecurity] = useState<SecurityMetrics | null>(null);
  const [errors, setErrors] = useState<ErrorMetrics | null>(null);
  const [storage, setStorage] = useState<StorageMetrics | null>(null);
  const [perf, setPerf] = useState<PerformanceMetrics | null>(null);

  const currentUser: DiagUser | null = user
    ? { id: user.id, email: user.email, role: user.role }
    : null;

  // -------- Overview --------
  const runOverview = async () => {
    setLoadingTab('overview');
    const start = performance.now();
    try {
      const [
        perfisRes, perfisAtivosRes, perfisPublicosRes, perfisRedeRes,
        postsRes, posts7dRes, conexoesRes, conexoesPendRes,
        followsRes, likesRes, comentariosRes,
        assRes, atividadesRes, expRes,
      ] = await Promise.all([
        supabase.from('perfil_atleta').select('id', { count: 'exact', head: true }),
        supabase.from('perfil_atleta').select('id', { count: 'exact', head: true }).eq('status_conta', 'ativo'),
        supabase.from('perfil_atleta').select('id', { count: 'exact', head: true }).eq('is_public', true),
        supabase.from('perfis_rede').select('id', { count: 'exact', head: true }),
        supabase.from('posts_atleta').select('id', { count: 'exact', head: true }),
        supabase.from('posts_atleta').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from('rede_conexoes').select('id', { count: 'exact', head: true }).eq('status', 'aceito'),
        supabase.from('rede_conexoes').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('atleta_follows').select('id', { count: 'exact', head: true }),
        supabase.from('post_likes').select('id', { count: 'exact', head: true }),
        supabase.from('post_comentarios').select('id', { count: 'exact', head: true }),
        supabase.from('carreira_assinaturas').select('id, status', { count: 'exact', head: false }),
        supabase.from('atividades_externas').select('id', { count: 'exact', head: true }),
        supabase.from('carreira_experiencias').select('id', { count: 'exact', head: true }),
      ]);

      const assinaturas = assRes.data || [];
      setOverview({
        perfisTotal: perfisRes.count || 0,
        perfisAtivos: perfisAtivosRes.count || 0,
        perfisPublicos: perfisPublicosRes.count || 0,
        perfisRede: perfisRedeRes.count || 0,
        postsTotal: postsRes.count || 0,
        posts7d: posts7dRes.count || 0,
        conexoesAceitas: conexoesRes.count || 0,
        conexoesPendentes: conexoesPendRes.count || 0,
        followsTotal: followsRes.count || 0,
        likesTotal: likesRes.count || 0,
        comentariosTotal: comentariosRes.count || 0,
        assAtivas: assinaturas.filter((a: any) => a.status === 'ativa').length,
        assCanceladas: assinaturas.filter((a: any) => a.status === 'cancelada').length,
        assTotal: assRes.count || 0,
        atividadesTotal: atividadesRes.count || 0,
        experienciasTotal: expRes.count || 0,
        executionMs: Math.round(performance.now() - start),
        executedAt: new Date(),
      });
    } finally {
      setLoadingTab(null);
    }
  };

  // -------- Health --------
  const runHealth = async () => {
    setLoadingTab('health');
    const start = performance.now();
    try {
      const results = await Promise.all(
        CARREIRA_TABLES.map(async (name) => {
          const { count, error } = await supabase.from(name as any).select('id', { count: 'exact', head: true });
          return {
            name,
            count: count || 0,
            status: error ? 'error' as const : 'ok' as const,
            detail: error?.message,
          };
        })
      );
      const totalRecords = results.reduce((s, t) => s + t.count, 0);
      setHealth({
        tables: results,
        totalRecords,
        executionMs: Math.round(performance.now() - start),
        executedAt: new Date(),
      });
    } finally {
      setLoadingTab(null);
    }
  };

  // -------- Security --------
  const runSecurity = async () => {
    setLoadingTab('security');
    const start = performance.now();
    try {
      // We check if anon can read – tables with good RLS should block anon
      // Since we're logged in as admin, we just mark known-RLS tables
      const tables: SecurityCheck[] = CARREIRA_TABLES.map((name) => ({
        name,
        count: 0, // will be filled
        status: SHOULD_HAVE_RLS.includes(name) ? 'protected' as const : 'public' as const,
      }));

      // Get counts
      const counts = await Promise.all(
        CARREIRA_TABLES.map((name) =>
          supabase.from(name as any).select('id', { count: 'exact', head: true })
        )
      );
      tables.forEach((t, i) => { t.count = counts[i].count || 0; });

      const protectedCount = tables.filter(t => t.status === 'protected').length;
      setSecurity({
        tables,
        protectedCount,
        publicCount: tables.length - protectedCount,
        totalCount: tables.length,
        executionMs: Math.round(performance.now() - start),
        executedAt: new Date(),
      });
    } finally {
      setLoadingTab(null);
    }
  };

  // -------- Errors --------
  const runErrors = async () => {
    setLoadingTab('errors');
    const start = performance.now();
    try {
      const checks: ErrorCheck[] = [];

      // 1. Perfis sem crianca vinculada
      const { data: perfisSemCriancaRows } = await supabase
        .from('perfil_atleta')
        .select('id, nome')
        .is('crianca_id', null);
      const qtdSemCrianca = perfisSemCriancaRows?.length || 0;
      checks.push({
        label: 'Perfis sem criança vinculada',
        description: 'Perfis atleta que não possuem uma criança associada',
        count: qtdSemCrianca,
        status: qtdSemCrianca > 0 ? 'warning' : 'ok',
        resolvePath: qtdSemCrianca === 1
          ? `/carreira/admin/perfis?q=${encodeURIComponent(perfisSemCriancaRows![0].nome)}`
          : qtdSemCrianca > 1 ? '/carreira/admin/perfis' : undefined,
        resolveLabel: 'Ver perfil(is)',
      });

      // 2. Conexões pendentes há muito tempo (>30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { count: conexoesAntigas } = await supabase
        .from('rede_conexoes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente')
        .lt('created_at', thirtyDaysAgo);
      checks.push({
        label: 'Conexões pendentes há +30 dias',
        description: 'Solicitações de conexão que estão pendentes há mais de 30 dias',
        count: conexoesAntigas || 0,
        status: (conexoesAntigas || 0) > 5 ? 'warning' : 'ok',
      });

      // 3. Assinaturas ativas expiradas
      const { count: assExpiradas } = await supabase
        .from('carreira_assinaturas')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ativa')
        .lt('expira_em', new Date().toISOString());
      checks.push({
        label: 'Assinaturas ativas mas expiradas',
        description: 'Assinaturas com status ativa mas data de expiração já passou',
        count: assExpiradas || 0,
        status: (assExpiradas || 0) > 0 ? 'error' : 'ok',
        resolvePath: (assExpiradas || 0) > 0 ? '/carreira/admin/assinaturas' : undefined,
        resolveLabel: 'Ver assinaturas',
      });

      // 4. Posts sem autor
      const { count: postsSemAutor } = await supabase
        .from('posts_atleta')
        .select('id', { count: 'exact', head: true })
        .is('autor_id', null)
        .is('perfil_rede_id', null);
      checks.push({
        label: 'Posts sem autor identificado',
        description: 'Posts que não possuem nem autor_id nem perfil_rede_id',
        count: postsSemAutor || 0,
        status: (postsSemAutor || 0) > 0 ? 'warning' : 'ok',
        resolvePath: (postsSemAutor || 0) > 0 ? '/carreira/admin/posts' : undefined,
        resolveLabel: 'Ver posts',
      });

      // 5. Perfis rede sem slug
      const { count: semSlug } = await supabase
        .from('perfis_rede')
        .select('id', { count: 'exact', head: true })
        .is('slug', null);
      checks.push({
        label: 'Perfis rede sem slug',
        description: 'Perfis da rede que não possuem URL pública configurada',
        count: semSlug || 0,
        status: (semSlug || 0) > 0 ? 'warning' : 'ok',
        resolvePath: (semSlug || 0) > 0 ? '/carreira/admin/perfis' : undefined,
        resolveLabel: 'Ver perfis',
      });

      // 6. Atividades sem evidência
      const { count: semEvidencia } = await supabase
        .from('atividades_externas')
        .select('id', { count: 'exact', head: true })
        .eq('credibilidade_status', 'registrado');
      checks.push({
        label: 'Atividades sem evidência',
        description: 'Atividades externas que estão apenas com status "registrado"',
        count: semEvidencia || 0,
        status: (semEvidencia || 0) > 10 ? 'warning' : 'ok',
        resolvePath: (semEvidencia || 0) > 10 ? '/carreira/admin/atividades' : undefined,
        resolveLabel: 'Ver atividades',
      });

      // 7. Assinaturas duplicadas (trial + ativa/pendente para o mesmo atleta ao mesmo tempo)
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
      const assinaturasDuplicadas = criancaIdsDuplicadas.length;
      let duplicadaResolvePath: string | undefined;
      if (assinaturasDuplicadas === 1) {
        const { data: criancaDup } = await supabase
          .from('criancas')
          .select('nome')
          .eq('id', criancaIdsDuplicadas[0])
          .maybeSingle();
        duplicadaResolvePath = criancaDup?.nome
          ? `/carreira/admin/assinaturas?q=${encodeURIComponent(criancaDup.nome)}`
          : '/carreira/admin/assinaturas';
      } else if (assinaturasDuplicadas > 1) {
        duplicadaResolvePath = '/carreira/admin/assinaturas';
      }
      checks.push({
        label: 'Assinaturas duplicadas por atleta',
        description: 'Atletas com mais de uma assinatura "em vigor" (trial/ativa/pendente) ao mesmo tempo — sinal de bug no fluxo de upgrade de trial para pago',
        count: assinaturasDuplicadas,
        status: assinaturasDuplicadas > 0 ? 'error' : 'ok',
        resolvePath: duplicadaResolvePath,
        resolveLabel: 'Ver assinaturas',
      });

      // 8. Perfis legados "pai_responsavel" que nunca migraram para um perfil de atleta próprio
      // Sem resolvePath: a aba "Rede" do admin exclui esse tipo legado da listagem hoje,
      // não existe ainda uma tela dedicada para gerenciar essas contas.
      const { data: paiResponsavelRows } = await supabase
        .from('perfis_rede')
        .select('user_id')
        .eq('tipo', 'pai_responsavel');
      let semMigracao = 0;
      if (paiResponsavelRows && paiResponsavelRows.length > 0) {
        const userIds = paiResponsavelRows.map((r: any) => r.user_id);
        const { data: atletasVinculados } = await supabase
          .from('perfil_atleta')
          .select('user_id')
          .in('user_id', userIds);
        const comAtleta = new Set((atletasVinculados || []).map((a: any) => a.user_id));
        semMigracao = userIds.filter((uid: string) => !comAtleta.has(uid)).length;
      }
      checks.push({
        label: 'Perfis legados sem migração',
        description: 'Contas do tipo antigo "pai_responsavel" que ainda não têm um perfil de atleta próprio vinculado',
        count: semMigracao,
        status: semMigracao > 0 ? 'warning' : 'ok',
      });

      // 9. Atletas sem nenhuma assinatura (nem trial) — ficam sem acesso a nada até alguém notar
      const { data: atletasComCrianca } = await supabase
        .from('perfil_atleta')
        .select('nome, crianca_id')
        .not('crianca_id', 'is', null);
      let semAssinatura = 0;
      let semAssinaturaResolvePath: string | undefined;
      if (atletasComCrianca && atletasComCrianca.length > 0) {
        const criancaIds = atletasComCrianca.map((a: any) => a.crianca_id);
        const { data: assinaturasExistentes } = await supabase
          .from('carreira_assinaturas')
          .select('crianca_id')
          .in('crianca_id', criancaIds);
        const comAssinatura = new Set((assinaturasExistentes || []).map((a: any) => a.crianca_id));
        const atletasSemAssinatura = atletasComCrianca.filter((a: any) => !comAssinatura.has(a.crianca_id));
        semAssinatura = atletasSemAssinatura.length;
        if (semAssinatura === 1) {
          semAssinaturaResolvePath = `/carreira/admin/perfis?q=${encodeURIComponent(atletasSemAssinatura[0].nome)}`;
        } else if (semAssinatura > 1) {
          semAssinaturaResolvePath = '/carreira/admin/perfis';
        }
      }
      checks.push({
        label: 'Atletas sem nenhuma assinatura',
        description: 'Perfis de atleta que nunca tiveram trial nem assinatura criada — todo cadastro novo deveria ganhar um trial automaticamente',
        count: semAssinatura,
        status: semAssinatura > 0 ? 'warning' : 'ok',
        resolvePath: semAssinaturaResolvePath,
        resolveLabel: 'Ver perfil(is)',
      });

      const totalProblems = checks.filter(c => c.status !== 'ok').length;
      setErrors({
        checks,
        totalProblems,
        executionMs: Math.round(performance.now() - start),
        executedAt: new Date(),
      });
    } finally {
      setLoadingTab(null);
    }
  };

  // -------- Storage --------
  const runStorage = async () => {
    setLoadingTab('storage');
    const start = performance.now();
    try {
      const bucketNames = ['atleta-fotos', 'atleta-posts', 'atividade-externa-fotos'];
      const buckets: BucketInfo[] = [];

      for (const name of bucketNames) {
        const { data } = await supabase.storage.from(name).list('', { limit: 1000 });
        buckets.push({
          name,
          fileCount: data?.length || 0,
          isPublic: name !== 'atividade-externa-fotos',
        });
      }

      const totalFiles = buckets.reduce((s, b) => s + b.fileCount, 0);

      // User breakdown
      const [perfisAtleta, perfisRede, posts] = await Promise.all([
        supabase.from('perfil_atleta').select('id', { count: 'exact', head: true }),
        supabase.from('perfis_rede').select('id', { count: 'exact', head: true }),
        supabase.from('posts_atleta').select('id', { count: 'exact', head: true }),
      ]);

      setStorage({
        buckets,
        totalFiles,
        userBreakdown: [
          { label: 'Perfis Atleta', count: perfisAtleta.count || 0, color: 'text-blue-600' },
          { label: 'Perfis Rede', count: perfisRede.count || 0, color: 'text-violet-600' },
          { label: 'Postagens', count: posts.count || 0, color: 'text-emerald-600' },
        ],
        executionMs: Math.round(performance.now() - start),
        executedAt: new Date(),
      });
    } finally {
      setLoadingTab(null);
    }
  };

  // -------- Performance --------
  const runPerformance = async () => {
    setLoadingTab('performance');
    const start = performance.now();
    try {
      // Service pings
      const pings: PerformanceMetrics['servicePings'] = [];

      // DB
      const dbStart = performance.now();
      const { error: dbErr } = await supabase.from('perfil_atleta').select('id', { count: 'exact', head: true });
      const dbMs = Math.round(performance.now() - dbStart);
      pings.push({ label: 'Banco de Dados', latencyMs: dbMs, status: dbErr ? 'error' : dbMs > 2000 ? 'warning' : 'ok' });

      // Auth
      const authStart = performance.now();
      const { error: authErr } = await supabase.auth.getSession();
      const authMs = Math.round(performance.now() - authStart);
      pings.push({ label: 'Autenticação', latencyMs: authMs, status: authErr ? 'error' : authMs > 2000 ? 'warning' : 'ok' });

      // Storage
      const stStart = performance.now();
      const { error: stErr } = await supabase.storage.from('atleta-fotos').list('', { limit: 1 });
      const stMs = Math.round(performance.now() - stStart);
      pings.push({ label: 'Storage', latencyMs: stMs, status: stErr ? 'warning' : stMs > 3000 ? 'warning' : 'ok' });

      // Edge Function
      const efStart = performance.now();
      const { error: efErr } = await supabase.functions.invoke('fetch-link-preview', { body: { url: 'https://google.com' } });
      const efMs = Math.round(performance.now() - efStart);
      pings.push({ label: 'Edge Functions', latencyMs: efMs, status: efErr ? 'warning' : efMs > 5000 ? 'warning' : 'ok' });

      // Query speeds
      const querySpeeds: QuerySpeed[] = [];
      const queryTests = [
        { label: 'COUNT perfil_atleta', fn: () => supabase.from('perfil_atleta').select('id', { count: 'exact', head: true }) },
        { label: 'COUNT posts_atleta', fn: () => supabase.from('posts_atleta').select('id', { count: 'exact', head: true }) },
        { label: 'COUNT rede_conexoes', fn: () => supabase.from('rede_conexoes').select('id', { count: 'exact', head: true }) },
        { label: 'COUNT atividades_externas', fn: () => supabase.from('atividades_externas').select('id', { count: 'exact', head: true }) },
        { label: 'COUNT atleta_follows', fn: () => supabase.from('atleta_follows').select('id', { count: 'exact', head: true }) },
        { label: 'COUNT carreira_assinaturas', fn: () => supabase.from('carreira_assinaturas').select('id', { count: 'exact', head: true }) },
      ];

      for (const q of queryTests) {
        const qStart = performance.now();
        await q.fn();
        querySpeeds.push({ label: q.label, latencyMs: Math.round(performance.now() - qStart) });
      }

      setPerf({
        servicePings: pings,
        querySpeeds,
        executionMs: Math.round(performance.now() - start),
        executedAt: new Date(),
      });
    } finally {
      setLoadingTab(null);
    }
  };

  return {
    currentUser,
    loadingTab,
    overview, runOverview,
    health, runHealth,
    security, runSecurity,
    errors, runErrors,
    storage, runStorage,
    perf, runPerformance,
  };
}
