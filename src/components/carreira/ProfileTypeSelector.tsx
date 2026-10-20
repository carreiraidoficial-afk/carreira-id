import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';

export type ProfileType =
  | 'atleta_filho'
  | 'jogador_profissional'
  | 'professor'
  | 'tecnico'
  | 'dono_escola'
  | 'preparador_fisico'
  | 'empresario'
  | 'influenciador'
  | 'scout'
  | 'agente_clube'
  | 'fotografo'
  | 'torcedor';

interface ProfileOption {
  type: ProfileType;
  icon: string;
  label: string;
  description: string;
}

const OPCOES: Record<ProfileType, ProfileOption> = {
  atleta_filho: { type: 'atleta_filho', icon: '⚽', label: 'Cadastrar meu Atleta', description: 'Crie o perfil esportivo do seu filho (você administra)' },
  jogador_profissional: { type: 'jogador_profissional', icon: '🏟️', label: 'Jogador Profissional', description: 'Joga ou já jogou profissionalmente' },
  professor: { type: 'professor', icon: '👨‍🏫', label: 'Professor / Treinador', description: 'Ensina e treina atletas em formação' },
  tecnico: { type: 'tecnico', icon: '📋', label: 'Técnico', description: 'Dirige equipes em competições e jogos' },
  dono_escola: { type: 'dono_escola', icon: '🏫', label: 'Dono de Escola', description: 'Administra escolinha ou clube de base' },
  preparador_fisico: { type: 'preparador_fisico', icon: '💪', label: 'Preparador Físico', description: 'Cuida da performance física dos atletas' },
  empresario: { type: 'empresario', icon: '💼', label: 'Empresário', description: 'Empreendedor do esporte: negócios, agências e projetos do ramo esportivo' },
  influenciador: { type: 'influenciador', icon: '⭐', label: 'Influenciador', description: 'Cria conteúdo sobre esporte' },
  scout: { type: 'scout', icon: '🎯', label: 'Scout', description: 'Observa e identifica talentos esportivos' },
  agente_clube: { type: 'agente_clube', icon: '🏢', label: 'Agente de Clube', description: 'Representa um clube na captação de talentos' },
  fotografo: { type: 'fotografo', icon: '📸', label: 'Fotógrafo', description: 'Registra momentos esportivos' },
  torcedor: { type: 'torcedor', icon: '🎉', label: 'Torcedor', description: 'Participe da rede e acompanhe o esporte' },
};

/** Opção da primeira tela: um perfil direto ou um grupo que abre a pergunta "qual é a sua função?". Os tipos
 * gravados no banco continuam os mesmos; só a escolha ficou mais curta. */
interface Entrada {
  chave: string;
  icon: string;
  label: string;
  description: string;
  tipo?: ProfileType;
  grupo?: ProfileType[];
}

const ENTRADAS: Entrada[] = [
  { chave: 'atleta_filho', tipo: 'atleta_filho', icon: OPCOES.atleta_filho.icon, label: OPCOES.atleta_filho.label, description: OPCOES.atleta_filho.description },
  { chave: 'jogador_profissional', tipo: 'jogador_profissional', icon: OPCOES.jogador_profissional.icon, label: OPCOES.jogador_profissional.label, description: OPCOES.jogador_profissional.description },
  { chave: 'treinadores', icon: '👨‍🏫', label: 'Professor, Técnico ou Preparador', description: 'Ensina, treina ou prepara atletas', grupo: ['professor', 'tecnico', 'preparador_fisico'] },
  { chave: 'dono_escola', tipo: 'dono_escola', icon: OPCOES.dono_escola.icon, label: OPCOES.dono_escola.label, description: OPCOES.dono_escola.description },
  { chave: 'agentes', icon: '💼', label: 'Empresário, Scout ou Agente', description: 'Empreende, observa ou capta talentos no esporte', grupo: ['empresario', 'scout', 'agente_clube'] },
  { chave: 'conteudo', icon: '⭐', label: 'Influenciador ou Fotógrafo', description: 'Cria ou registra conteúdo sobre esporte', grupo: ['influenciador', 'fotografo'] },
  { chave: 'torcedor', tipo: 'torcedor', icon: OPCOES.torcedor.icon, label: OPCOES.torcedor.label, description: OPCOES.torcedor.description },
];

interface Props {
  onSelect: (type: ProfileType) => void;
  /** Atleta menor de 18 anos que quer se cadastrar sozinho (o responsável confirma depois). */
  onSelectAdolescente?: () => void;
  /** Atleta com 18 anos ou mais se cadastrando sozinho. */
  onSelectAdulto?: () => void;
  /** Convite de professor da escola: mostra direto só as funções de equipe técnica. */
  somenteEquipe?: boolean;
}

export function ProfileTypeSelector({ onSelect, onSelectAdolescente, onSelectAdulto, somenteEquipe }: Props) {
  const [grupoAberto, setGrupoAberto] = useState<Entrada | null>(null);

  if (somenteEquipe) {
    const equipe = ENTRADAS.find((e) => e.chave === 'treinadores');
    return (
      <div className="animate-fade-in">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-foreground">Qual é a sua função?</h1>
          <p className="text-sm text-muted-foreground mt-1">Para entrar na equipe técnica da escola</p>
        </div>
        <div className="grid gap-2">
          {(equipe?.grupo || []).map((t) => (
            <CartaoOpcao key={t} icon={OPCOES[t].icon} label={OPCOES[t].label} description={OPCOES[t].description} onClick={() => onSelect(t)} />
          ))}
        </div>
      </div>
    );
  }

  if (grupoAberto?.grupo) {
    return (
      <div className="animate-fade-in">
        <button onClick={() => setGrupoAberto(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-foreground">Qual é a sua função?</h1>
          <p className="text-sm text-muted-foreground mt-1">{grupoAberto.label}</p>
        </div>
        <div className="grid gap-2">
          {grupoAberto.grupo.map((t) => (
            <CartaoOpcao key={t} icon={OPCOES[t].icon} label={OPCOES[t].label} description={OPCOES[t].description} onClick={() => onSelect(t)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-foreground">Como você quer participar?</h1>
        <p className="text-sm text-muted-foreground mt-1">Escolha o perfil que melhor representa você na rede</p>
      </div>

      <div className="grid gap-2">
        {ENTRADAS.map((e) => (
          <CartaoOpcao
            key={e.chave}
            icon={e.icon}
            label={e.label}
            description={e.description}
            onClick={() => (e.tipo ? onSelect(e.tipo) : setGrupoAberto(e))}
          />
        ))}
        {onSelectAdulto && (
          <CartaoOpcao
            icon="⚽"
            label="Sou atleta e tenho 18 anos ou mais"
            description="Faça o seu próprio cadastro"
            onClick={onSelectAdulto}
          />
        )}
        {onSelectAdolescente && (
          <CartaoOpcao
            icon="🎽"
            label="Sou atleta e tenho menos de 18 anos"
            description="Faça o seu cadastro; seu responsável confirma depois"
            onClick={onSelectAdolescente}
          />
        )}
      </div>
    </div>
  );
}

function CartaoOpcao({ icon, label, description, onClick }: { icon: string; label: string; description: string; onClick: () => void }) {
  return (
    <Card
      className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all active:scale-[0.98]"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 p-3">
        <span className="text-2xl flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </Card>
  );
}
