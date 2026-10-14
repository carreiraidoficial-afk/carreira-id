import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Eye, Lock, Loader2, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';

const TIPOS: Record<string, string> = {
  professor: 'Professor', tecnico: 'Técnico', dono_escola: 'Escola de Esportes', preparador_fisico: 'Preparador Físico',
  empresario: 'Empresário', influenciador: 'Influenciador', pai_responsavel: 'Atleta', atleta: 'Atleta', scout: 'Scout',
  agente_clube: 'Agente de Clube', fotografo: 'Fotógrafo', torcedor: 'Torcedor',
};

interface Resumo { total: number; pode_ver: boolean }

/** Resumo para o dono do perfil: visitantes distintos nos últimos 30 dias e se o plano permite ver quem foram. */
export function useVisitasResumo(perfilAtletaId?: string | null) {
  return useQuery({
    queryKey: ['visitas-resumo', perfilAtletaId],
    queryFn: async (): Promise<Resumo> => {
      const { data, error } = await (supabase as any).rpc('perfil_visualizacoes_resumo', { p_perfil_atleta_id: perfilAtletaId });
      if (error || !data) return { total: 0, pode_ver: false };
      return data as Resumo;
    },
    enabled: !!perfilAtletaId,
    staleTime: 60_000,
  });
}

function useVisitantes(perfilAtletaId: string, ativo: boolean) {
  return useQuery({
    queryKey: ['visitas-lista', perfilAtletaId],
    queryFn: async () => {
      const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('perfil_visualizacoes')
        .select('*')
        .eq('perfil_atleta_id', perfilAtletaId)
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const ids = [...new Set(data.map((v) => v.viewer_user_id))];
      const [{ data: rede }, { data: atletas }] = await Promise.all([
        supabase.from('perfis_rede').select('user_id, foto_url, nome, tipo').in('user_id', ids),
        supabase.from('perfil_atleta').select('user_id, foto_url, nome').in('user_id', ids),
      ]);
      const redeMap = new Map((rede || []).map((p) => [p.user_id, p]));
      const atletaMap = new Map((atletas || []).map((p) => [p.user_id, p]));

      const vistos = new Set<string>();
      return data
        .filter((v) => (vistos.has(v.viewer_user_id) ? false : (vistos.add(v.viewer_user_id), true)))
        .map((v) => {
          const r = redeMap.get(v.viewer_user_id);
          const a = atletaMap.get(v.viewer_user_id);
          const tipo = a ? 'atleta' : r?.tipo === 'pai_responsavel' ? 'atleta' : r?.tipo || v.viewer_tipo;
          return { ...v, foto: r?.foto_url || a?.foto_url || v.viewer_foto_url, nome: r?.nome || a?.nome || v.viewer_nome, tipo };
        });
    },
    enabled: ativo && !!perfilAtletaId,
  });
}

function haQuanto(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

export function VisitasPerfilTab({ perfilAtletaId, accentColor }: { perfilAtletaId: string; accentColor: string }) {
  const navigate = useNavigate();
  const { data: resumo, isLoading } = useVisitasResumo(perfilAtletaId);
  const podeVer = !!resumo?.pode_ver;
  const { data: visitantes, isLoading: carregandoLista } = useVisitantes(perfilAtletaId, podeVer);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const total = resumo?.total ?? 0;

  if (!podeVer) {
    // Base: só o número. A lista fica para o Premium.
    return (
      <div className="space-y-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <Eye className="mx-auto mb-1 h-5 w-5" style={{ color: accentColor }} />
          <p className="text-3xl font-extrabold leading-none text-foreground">{total}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 1 ? 'pessoa visitou' : 'pessoas visitaram'} este perfil nos últimos 30 dias
          </p>
        </div>
        {total > 0 && (
          <div className="relative overflow-hidden rounded-xl border bg-card">
            <div className="space-y-2 p-3 blur-sm select-none" aria-hidden>
              {Array.from({ length: Math.min(total, 3) }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-32 rounded bg-muted" />
                    <div className="h-2.5 w-20 rounded bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 p-3 text-center">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Veja quem visitou o perfil</p>
              <Button size="sm" className="gap-1.5 text-white" style={{ backgroundColor: accentColor }} onClick={() => navigate(carreiraPath('/planos'))}>
                <Crown className="h-3.5 w-3.5" /> Conhecer o Premium
              </Button>
            </div>
          </div>
        )}
        {total === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Compartilhe o link do perfil para receber visitas. Com o Premium você vê quem foram.
          </p>
        )}
      </div>
    );
  }

  if (carregandoLista) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!visitantes || visitantes.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Ninguém visitou o perfil nos últimos 30 dias. Compartilhe o link para receber visitas.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs text-muted-foreground">
        {visitantes.length} {visitantes.length === 1 ? 'pessoa' : 'pessoas'} nos últimos 30 dias
      </p>
      {visitantes.map((v: any) => (
        <button
          key={v.id}
          type="button"
          onClick={() => navigate(carreiraPath(`/perfil/${v.viewer_user_id}`))}
          className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50"
        >
          {v.foto ? (
            <img src={v.foto} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
              {v.nome?.[0] || '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{v.nome || 'Usuário'}</p>
            <p className="truncate text-xs text-muted-foreground">{TIPOS[v.tipo || ''] || v.tipo || ''}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{haQuanto(v.created_at)}</span>
        </button>
      ))}
    </div>
  );
}
