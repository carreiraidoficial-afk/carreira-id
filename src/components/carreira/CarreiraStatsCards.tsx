import { useState } from 'react';
import { useCarreiraStats } from '@/hooks/useCarreiraJornadaData';
import { Card } from '@/components/ui/card';
import { Goal, Trophy, Medal, Swords, Target, Award, Shield, Timer, Hand } from 'lucide-react';

interface CarreiraStatsCardsProps {
  criancaId: string | null | undefined;
  accentColor?: string;
}

const statConfig = [
  { key: 'totalJogos', label: 'Jogos', icon: Swords },
  { key: 'totalGols', label: 'Gols', icon: Goal },
  { key: 'totalAssistencias', label: 'Assist.', icon: Target },
  { key: 'totalVitorias', label: 'Vitórias', icon: Award },
  { key: 'totalCampeonatos', label: 'Campeonatos', icon: Trophy },
  { key: 'totalPremiacoes', label: 'Premiações', icon: Medal },
] as const;

const goleiroConfig = [
  { key: 'totalDefesas', label: 'Defesas', icon: Shield },
  { key: 'totalGolsSofridos', label: 'Gols sofridos', icon: Goal },
  { key: 'totalPenaltisDefendidos', label: 'Pên. defendidos', icon: Hand },
  { key: 'minutosGoleiro', label: 'Minutos', icon: Timer },
] as const;

export function CarreiraStatsCards({ criancaId, accentColor = '#3b82f6' }: CarreiraStatsCardsProps) {
  const [ano, setAno] = useState<number | 'todos'>('todos');
  const { stats, anosDisponiveis } = useCarreiraStats(criancaId, ano);

  const hasAnyStats =
    stats.totalGols > 0 || stats.totalJogos > 0 ||
    stats.totalCampeonatos > 0 || stats.totalPremiacoes > 0 ||
    stats.totalAssistencias > 0 || stats.totalVitorias > 0;

  return (
    <div className="space-y-3">
      {anosDisponiveis.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          <label className="text-xs text-muted-foreground">Ano:</label>
          <select
            value={ano}
            onChange={(e) => setAno(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
            className="text-xs rounded-md border-2 px-2 py-1 bg-transparent focus:outline-none"
            style={{ borderColor: `${accentColor}40`, color: accentColor }}
          >
            <option value="todos">Todos</option>
            {anosDisponiveis.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {!hasAnyStats ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg" style={{ borderColor: `${accentColor}25` }}>
          <Trophy className="w-10 h-10 mx-auto opacity-40 mb-2" style={{ color: accentColor }} />
          <p className="text-sm">
            {ano === 'todos' ? 'Nenhuma estatística ainda.' : `Nenhuma estatística em ${ano}.`}
          </p>
          <p className="text-xs mt-1">Registre campeonatos e jogos na aba <strong>Jornada Esportiva</strong> para ver suas estatísticas aqui.</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statConfig.map(({ key, label, icon: Icon }) => {
            const value = stats[key];
            return (
              <Card
                key={key}
                className="p-4 flex flex-col items-center justify-center text-center gap-1 border"
                style={{ borderColor: `${accentColor}25` }}
              >
                <Icon className="w-6 h-6" style={{ color: accentColor }} />
                <span className="text-2xl font-bold">{value}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </Card>
            );
          })}
        </div>
        {stats.jogosComoGoleiro > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground mt-2">
              🧤 Estatísticas como goleiro ({stats.jogosComoGoleiro} jogo{stats.jogosComoGoleiro > 1 ? 's' : ''})
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {goleiroConfig.map(({ key, label, icon: Icon }) => (
                <Card
                  key={key}
                  className="p-4 flex flex-col items-center justify-center text-center gap-1 border"
                  style={{ borderColor: `${accentColor}25` }}
                >
                  <Icon className="w-6 h-6" style={{ color: accentColor }} />
                  <span className="text-2xl font-bold">{stats[key]}</span>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </Card>
              ))}
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
