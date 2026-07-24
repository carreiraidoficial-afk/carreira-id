import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

interface PlanoConfig {
  id: string;
  plano: string;
  nome: string;
  preco: number;
  cor: string;
  icone: string;
  descricao: string;
  ativo: boolean;
  jornada_mes: number;
  carreira_mes: number;
  posts_dia: number;
  video_seg: number;
  video_max_mb: number;
  youtube: boolean;
  selo_elite: boolean;
  ver_views: boolean;
  prioridade_busca: boolean;
  destaque_listagem: boolean;
  stats_avancadas: boolean;
  liga_conexoes: boolean;
  curriculo_pdf: boolean;
}

const FEATURE_LABELS: Record<string, { label: string; desc: string; type: 'boolean' | 'number' }> = {
  jornada_mes: { label: 'Registros de Jornada / mês', desc: 'Limite mensal de registros na jornada esportiva', type: 'number' },
  carreira_mes: { label: 'Registros de Carreira / mês', desc: 'Limite mensal de registros de carreira (escolinhas/clubes)', type: 'number' },
  posts_dia: { label: 'Posts por dia', desc: 'Limite diário de publicações no feed', type: 'number' },
  video_seg: { label: 'Duração de vídeo (seg)', desc: 'Tempo máximo de vídeo em segundos (0 = sem vídeo)', type: 'number' },
  video_max_mb: { label: 'Tamanho máx. vídeo (MB)', desc: 'Tamanho máximo do arquivo de vídeo em MB', type: 'number' },
  youtube: { label: 'Vídeos do YouTube', desc: 'Permite publicar vídeos do YouTube', type: 'boolean' },
  selo_elite: { label: 'Selo Elite', desc: 'Exibe selo de perfil Elite', type: 'boolean' },
  ver_views: { label: 'Ver visualizações', desc: 'Permite ver quem visualizou o perfil', type: 'boolean' },
  prioridade_busca: { label: 'Prioridade nas buscas', desc: 'Perfil aparece primeiro em listagens', type: 'boolean' },
  destaque_listagem: { label: 'Destaque em listagens', desc: 'Perfil destacado visualmente nas listagens', type: 'boolean' },
  stats_avancadas: { label: 'Estatísticas avançadas', desc: 'Acesso a estatísticas detalhadas', type: 'boolean' },
  liga_conexoes: { label: 'Liga de Conexões', desc: 'Participação na Liga de Conexões do Atleta', type: 'boolean' },
  curriculo_pdf: { label: 'Currículo em PDF', desc: 'Permite baixar o currículo esportivo em PDF', type: 'boolean' },
};

function usePlanosConfig() {
  return useQuery({
    queryKey: ['carreira-planos-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carreira_planos_config')
        .select('*')
        .order('preco', { ascending: true });
      if (error) throw error;
      return data as PlanoConfig[];
    },
  });
}

export default function CarreiraAdminPlanosPage() {
  const queryClient = useQueryClient();
  const { data: planos, isLoading } = usePlanosConfig();
  const [editState, setEditState] = useState<Record<string, Partial<PlanoConfig>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const getVal = (plano: PlanoConfig, key: keyof PlanoConfig) => {
    return editState[plano.id]?.[key] ?? plano[key];
  };

  const setVal = (planoId: string, key: string, value: any) => {
    setEditState(prev => ({
      ...prev,
      [planoId]: { ...prev[planoId], [key]: value },
    }));
  };

  const hasChanges = (planoId: string) => {
    return editState[planoId] && Object.keys(editState[planoId]).length > 0;
  };

  const handleSave = async (plano: PlanoConfig) => {
    const changes = editState[plano.id];
    if (!changes || Object.keys(changes).length === 0) return;

    setSaving(plano.id);
    try {
      const { error } = await supabase
        .from('carreira_planos_config')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('id', plano.id);

      if (error) throw error;

      setEditState(prev => {
        const next = { ...prev };
        delete next[plano.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['carreira-planos-config'] });
      queryClient.invalidateQueries({ queryKey: ['carreira-plano'] });
      toast.success(`Plano ${plano.nome} atualizado!`);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) {
    return (
      <CarreiraAdminLayout>
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </CarreiraAdminLayout>
    );
  }

  return (
    <CarreiraAdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="w-6 h-6" /> Planos & Features
          </h1>
          <p className="text-muted-foreground text-sm">Configure os limites e recursos de cada plano de assinatura</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {planos?.map(plano => (
            <Card key={plano.id} className="relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: getVal(plano, 'cor') as string }} />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>{plano.icone}</span>
                    {plano.nome}
                  </CardTitle>
                  <Badge variant={plano.plano === 'base' ? 'secondary' : 'default'}
                    style={plano.plano !== 'base' ? { backgroundColor: plano.cor } : {}}>
                    {plano.preco > 0 ? `R$ ${plano.preco.toFixed(2).replace('.', ',')}` : 'Gratuito'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{plano.descricao}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Price */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Preço (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={getVal(plano, 'preco') as number}
                    onChange={e => setVal(plano.id, 'preco', parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm"
                    disabled={plano.plano === 'base'}
                  />
                </div>

                {/* Numeric limits */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Limites</p>
                  {Object.entries(FEATURE_LABELS)
                    .filter(([, v]) => v.type === 'number')
                    .map(([key, meta]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{meta.label}</Label>
                        <Input
                          type="number"
                          min="0"
                          value={getVal(plano, key as keyof PlanoConfig) as number}
                          onChange={e => setVal(plano.id, key, parseInt(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground">{meta.desc}</p>
                      </div>
                    ))}
                </div>

                {/* Boolean toggles */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recursos</p>
                  {Object.entries(FEATURE_LABELS)
                    .filter(([, v]) => v.type === 'boolean')
                    .map(([key, meta]) => (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <Label className="text-xs cursor-pointer">{meta.label}</Label>
                          <p className="text-[10px] text-muted-foreground">{meta.desc}</p>
                        </div>
                        <Switch
                          checked={getVal(plano, key as keyof PlanoConfig) as boolean}
                          onCheckedChange={v => setVal(plano.id, key, v)}
                        />
                      </div>
                    ))}
                </div>

                {/* Save */}
                <Button
                  onClick={() => handleSave(plano)}
                  disabled={!hasChanges(plano.id) || saving === plano.id}
                  className="w-full gap-2"
                  size="sm"
                >
                  {saving === plano.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar alterações
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </CarreiraAdminLayout>
  );
}
