import { Card } from '@/components/ui/card';
import { Eye } from 'lucide-react';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';

const TYPE_LABELS: Record<string, string> = {
  professor: 'Professor',
  tecnico: 'Técnico',
  dono_escola: 'Escola de Esportes',
  preparador_fisico: 'Preparador Físico',
  empresario: 'Empresário',
  influenciador: 'Influenciador',
  pai_responsavel: 'Atleta',
  scout: 'Scout',
  agente_clube: 'Agente de Clube',
  fotografo: 'Fotógrafo',
  torcedor: 'Torcedor',
};

export function ProfileViewsSection({ views, accentColor, navigate }: { views: any[]; accentColor: string; navigate: (path: string) => void }) {
  return (
    <Card className="p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
      <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
        <Eye className="w-3.5 h-3.5" style={{ color: accentColor }} />
        Quem viu este perfil ({views.length})
      </h3>
      <div className="max-h-[120px] overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {views.map((view) => (
            <div key={view.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 transition-colors"
              onClick={() => navigate(carreiraPath(`/perfil/${view.viewer_user_id}`))}>
              {view.viewer_foto_url ? (
                <img src={view.viewer_foto_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  {view.viewer_nome?.[0] || '?'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium truncate max-w-[100px]">{view.viewer_nome || 'Usuário'}</p>
                <p className="text-[10px] text-muted-foreground">{TYPE_LABELS[view.viewer_tipo || ''] || view.viewer_tipo || ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
