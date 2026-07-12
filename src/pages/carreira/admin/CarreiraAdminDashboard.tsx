import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, CreditCard, TrendingDown, DollarSign, Loader2, Calendar, Filter } from 'lucide-react';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';

type FilterMode = 'month' | 'custom';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = [
  { value: '0', label: 'Todos os meses' },
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

function useDateRange() {
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState('0');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const range = useMemo(() => {
    if (filterMode === 'custom' && customStart && customEnd) {
      return {
        start: new Date(customStart + 'T00:00:00').toISOString(),
        end: new Date(customEnd + 'T23:59:59').toISOString(),
      };
    }
    const y = parseInt(year);
    const m = parseInt(month);
    if (m === 0) {
      return {
        start: new Date(y, 0, 1).toISOString(),
        end: new Date(y, 11, 31, 23, 59, 59).toISOString(),
      };
    }
    return {
      start: new Date(y, m - 1, 1).toISOString(),
      end: new Date(y, m, 0, 23, 59, 59).toISOString(),
    };
  }, [filterMode, year, month, customStart, customEnd]);

  const label = useMemo(() => {
    if (filterMode === 'custom' && customStart && customEnd) {
      return `${customStart} a ${customEnd}`;
    }
    const m = parseInt(month);
    if (m === 0) return year;
    return `${MONTHS[m].label} ${year}`;
  }, [filterMode, year, month, customStart, customEnd]);

  return {
    filterMode, setFilterMode,
    year, setYear,
    month, setMonth,
    customStart, setCustomStart,
    customEnd, setCustomEnd,
    range, label,
  };
}

function useAdminDashboardData(range: { start: string; end: string }) {
  // Perfis — totals (no date filter, always current snapshot)
  const perfisQuery = useQuery({
    queryKey: ['admin-dash-perfis'],
    queryFn: async () => {
      const [atletaRes, redeRes] = await Promise.all([
        supabase.from('perfil_atleta').select('id', { count: 'exact', head: true }),
        supabase.from('perfis_rede').select('id', { count: 'exact', head: true }),
      ]);
      return {
        atletas: atletaRes.count || 0,
        rede: redeRes.count || 0,
      };
    },
    staleTime: 60_000,
  });

  // Financial data — filtered by date range
  const financeQuery = useQuery({
    queryKey: ['admin-dash-finance', range.start, range.end],
    queryFn: async () => {
      // Active subscriptions (snapshot — status=ativa now)
      const { data: activeSubs } = await supabase
        .from('carreira_assinaturas')
        .select('plano, valor, status')
        .eq('status', 'ativa');

      const byPlan = { base: 0, premium: 0 };
      (activeSubs || []).forEach((s: any) => {
        const p = normalizePlano(s.plano);
        byPlan[p] = (byPlan[p] || 0) + 1;
      });

      // Cancelamentos no período
      const { data: cancelados } = await supabase
        .from('carreira_assinaturas')
        .select('id, plano, valor, cancelada_em')
        .not('cancelada_em', 'is', null)
        .gte('cancelada_em', range.start)
        .lte('cancelada_em', range.end);

      // Receita por plano no período (assinaturas criadas no período com status ativa)
      const { data: receitaSubs } = await supabase
        .from('carreira_assinaturas')
        .select('plano, valor')
        .gte('inicio_em', range.start)
        .lte('inicio_em', range.end)
        .eq('status', 'ativa');

      const receitaPorPlano = { premium: 0 };
      (receitaSubs || []).forEach((s: any) => {
        const p = normalizePlano(s.plano);
        if (p === 'premium') {
          receitaPorPlano.premium += Number(s.valor) || 0;
        }
      });

      return {
        ativas: byPlan,
        totalAtivas: (activeSubs || []).length,
        cancelamentos: (cancelados || []).length,
        receita: receitaPorPlano,
        receitaTotal: receitaPorPlano.premium,
      };
    },
    staleTime: 30_000,
  });

  return { perfisQuery, financeQuery };
}

function normalizePlano(plano: string): 'base' | 'premium' {
  if (['premium', 'elite', 'competidor', 'mensal', 'pro_mensal'].includes(plano)) return 'premium';
  return 'base';
}

function formatCurrency(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function CarreiraAdminDashboard() {
  const dateRange = useDateRange();
  const { perfisQuery, financeQuery } = useAdminDashboardData(dateRange.range);

  const isLoading = perfisQuery.isLoading || financeQuery.isLoading;
  const perfis = perfisQuery.data;
  const finance = financeQuery.data;

  return (
    <CarreiraAdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard — Carreira ID</h1>
          <p className="text-muted-foreground text-sm">Visão geral da plataforma</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Filtro financeiro:</span>
              </div>

              <div className="flex gap-1">
                <Button
                  variant={dateRange.filterMode === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => dateRange.setFilterMode('month')}
                >
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  Mês/Ano
                </Button>
                <Button
                  variant={dateRange.filterMode === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => dateRange.setFilterMode('custom')}
                >
                  Personalizado
                </Button>
              </div>

              {dateRange.filterMode === 'month' ? (
                <>
                  <Select value={dateRange.year} onValueChange={dateRange.setYear}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={dateRange.month} onValueChange={dateRange.setMonth}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      className="w-[150px]"
                      value={dateRange.customStart}
                      onChange={(e) => dateRange.setCustomStart(e.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">até</span>
                    <Input
                      type="date"
                      className="w-[150px]"
                      value={dateRange.customEnd}
                      onChange={(e) => dateRange.setCustomEnd(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Perfis Section */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Perfis</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                  label="Perfis Atleta"
                  value={perfis?.atletas ?? 0}
                  icon={<Users className="w-5 h-5" />}
                  color="text-blue-600 bg-blue-100"
                />
                <StatCard
                  label="Demais Perfis (Rede)"
                  value={perfis?.rede ?? 0}
                  icon={<Users className="w-5 h-5" />}
                  color="text-violet-600 bg-violet-100"
                />
                <StatCard
                  label="Total de Perfis"
                  value={(perfis?.atletas ?? 0) + (perfis?.rede ?? 0)}
                  icon={<Users className="w-5 h-5" />}
                  color="text-foreground bg-muted"
                />
              </div>
            </div>

            {/* Financeiro Section */}
            <div>
              <h2 className="text-lg font-semibold mb-1">Financeiro</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Assinaturas ativas = snapshot atual · Cancelamentos e Receita = período: <strong>{dateRange.label}</strong>
              </p>

              {/* Assinaturas Ativas */}
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Assinaturas Ativas</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                <StatCard
                  label="Total Ativas"
                  value={finance?.totalAtivas ?? 0}
                  icon={<CreditCard className="w-5 h-5" />}
                  color="text-emerald-600 bg-emerald-100"
                />
                <StatCard
                  label="Base (Free)"
                  value={finance?.ativas.base ?? 0}
                  icon={<CreditCard className="w-5 h-5" />}
                  color="text-gray-600 bg-gray-100"
                />
                <StatCard
                  label="👑 Premium"
                  value={finance?.ativas.premium ?? 0}
                  icon={<CreditCard className="w-5 h-5" />}
                  color="text-violet-600 bg-violet-100"
                />
              </div>

              {/* Cancelamentos + Receita */}
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Cancelamentos & Receita no período</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                  label="Cancelamentos"
                  value={finance?.cancelamentos ?? 0}
                  icon={<TrendingDown className="w-5 h-5" />}
                  color="text-red-600 bg-red-100"
                />
                <StatCard
                  label="Receita Total"
                  value={formatCurrency(finance?.receitaTotal ?? 0)}
                  icon={<DollarSign className="w-5 h-5" />}
                  color="text-emerald-600 bg-emerald-100"
                />
                <StatCard
                  label="Receita Premium"
                  value={formatCurrency(finance?.receita.premium ?? 0)}
                  icon={<DollarSign className="w-5 h-5" />}
                  color="text-violet-600 bg-violet-100"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </CarreiraAdminLayout>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  const [iconColor, iconBg] = color.split(' ');
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${iconBg} ${iconColor}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
