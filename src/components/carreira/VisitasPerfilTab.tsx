import { useState } from 'react';
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

export function VisitasPerfilCard({ perfilAtletaId, accentColor }: { perfilAtletaId: string; accentColor: string }) {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const { data: resumo, isLoading } = useVisitasResumo(perfilAtletaId);
  const podeVer = !!resumo?.pode_ver;
  const { data: visitantes, isLoading: carregandoLista } = useVisitantes(perfilAtletaId, podeVer);

  if (isLoading) return null;
  const total = resumo?.total ?? 0;

  const cabecalho = (
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Eye className="h-4 w-4" style={{ color: accentColor }} />
        Quem viu seu perfil
      </h3>
      <span className="text-xs text-muted-foreground">
        {total} {total === 1 ? 'visita' : 'visitas'} em 30 dias
      </span>
    </div>
  );

  // Base: só o número e um convite. A lista fica para o Elite.
  if (!podeVer) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-3">
        {cabecalho}
        {total > 0 ? (
          <div className="relative overflow-hidden rounded-lg border">
            <div className="select-none space-y-2 p-3 blur-sm" aria-hidden>
              {Array.from({ length: Math.min(total, 2) }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-28 rounded bg-muted" />
                    <div className="h-2.5 w-16 rounded bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 p-2 text-center">
              <p className="flex items-center gap-1 text-xs font-medium text-foreground">
                <Lock className="h-3.5 w-3.5" /> Veja quem visitou o perfil
              </p>
              <Button size="sm" className="h-8 gap-1.5 text-xs text-white" style={{ backgroundColor: accentColor }} onClick={() => navigate(carreiraPath('/planos'))}>
                <Crown className="h-3.5 w-3.5" /> Conhecer o Elite
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Compartilhe o link do perfil para receber visitas. Com o Elite você vê quem foram.</p>
        )}
      </div>
    );
  }

  if (carregandoLista) {
    return <div className="flex justify-center rounded-xl border bg-card p-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!visitantes || visitantes.length === 0) {
    return (
      <div className="space-y-1 rounded-xl border bg-card p-3">
        {cabecalho}
        <p className="text-xs text-muted-foreground">Ninguém visitou o perfil nos últimos 30 dias. Compartilhe o link para receber visitas.</p>
      </div>
    );
  }

  const PREVIA = 4;
  const mostrados = aberto ? visitantes : visitantes.slice(0, PREVIA);

  return (
    <div className="space-y-2 rounded-xl border bg-card p-3">
      {cabecalho}
      <div className="space-y-1">
        {mostrados.map((v: any) => (
          <button
            key={v.id}
            type="button"
            onClick={() => navigate(carreiraPath(`/perfil/${v.viewer_user_id}`))}
            className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-muted/50"
          >
            {v.foto ? (
              <img src={v.foto} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
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
      {visitantes.length > PREVIA && (
        <button type="button" onClick={() => setAberto((a) => !a)} className="w-full pt-1 text-center text-xs font-medium" style={{ color: accentColor }}>
          {aberto ? 'Mostrar menos' : `Ver todas (${visitantes.length})`}
        </button>
      )}
    </div>
  );
}
