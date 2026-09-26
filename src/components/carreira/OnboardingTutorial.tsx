import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, Shield, Camera, MapPin, Trophy, Share2, ChevronRight, ChevronLeft } from 'lucide-react';

interface Props {
  onStart: () => void;
  brandName: string;
  /** Veio pelo botão dedicado a pais de atleta (?ref=atleta) -- já sabemos o
   * tipo de perfil, então o tutorial pula a etapa de escolha (que só serviria
   * pra confundir/assustar quem já veio decidido) e reforça a privacidade
   * dos dados do responsável, que costuma ser a maior hesitação aqui. */
  paraAtleta?: boolean;
}

const STEPS_PADRAO = [
  {
    icon: UserPlus,
    emoji: '👋',
    title: 'Crie sua conta',
    description: 'Use seu Google ou cadastre com email e senha. É rápido e gratuito!',
    details: [
      'Nome completo',
      'Email válido',
      'Senha (mínimo 6 caracteres)',
    ],
  },
  {
    icon: Trophy,
    emoji: '⚽',
    title: 'Escolha o tipo de perfil',
    description: 'Selecione como você participa do mundo esportivo.',
    details: [
      'Cadastrar meu Atleta (filho)',
      'Professor / Treinador',
      'Dono de Escola',
      'Empresário, Scout e mais...',
    ],
  },
  {
    icon: Shield,
    emoji: '📋',
    title: 'Preencha o perfil',
    description: 'Para o perfil de atleta, você precisará dos seguintes dados:',
    details: [
      'Nome do atleta e data de nascimento',
      'CPF e WhatsApp do responsável (privados)',
      'Modalidade e categoria esportiva',
      'Cidade e estado',
      'Foto do atleta (opcional)',
    ],
  },
  {
    icon: Share2,
    emoji: '🚀',
    title: 'Compartilhe e conecte!',
    description: 'Após criar, seu atleta terá uma vitrine profissional completa.',
    details: [
      'Link público para compartilhar',
      'Timeline de atividades e conquistas',
      'Conexão com escolas e profissionais',
      'Histórico de carreira esportiva',
    ],
  },
];

const STEPS_ATLETA = [
  STEPS_PADRAO[0],
  {
    icon: Shield,
    emoji: '📋',
    title: 'Preencha o perfil do seu atleta',
    description: 'Alguns dados básicos pra criar o perfil esportivo dele:',
    details: [
      'Nome do atleta e data de nascimento',
      'CPF e WhatsApp do responsável (privados, nunca aparecem no perfil)',
      'Modalidade e categoria esportiva',
      'Cidade e estado',
      'Foto do atleta (opcional)',
    ],
  },
  STEPS_PADRAO[3],
];

export function OnboardingTutorial({ onStart, brandName, paraAtleta }: Props) {
  const STEPS = paraAtleta ? STEPS_ATLETA : STEPS_PADRAO;
  const [currentStep, setCurrentStep] = useState(0);
  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'hsl(0 0% 95%)' }}>
          {paraAtleta ? `Como cadastrar seu atleta no ${brandName}?` : `Como funciona o ${brandName}?`}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'hsl(0 0% 55%)' }}>
          {paraAtleta ? 'São só 3 passos rápidos, com controle total dos dados do seu filho.' : 'Veja o passo a passo antes de começar'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentStep(i)}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: i === currentStep ? '2rem' : '0.5rem',
              backgroundColor: i === currentStep
                ? 'hsl(25 95% 55%)'
                : i < currentStep
                  ? 'hsl(25 95% 55% / 0.4)'
                  : 'hsl(0 0% 30%)',
            }}
          />
        ))}
      </div>

      {/* Step content */}
      <div
        className="rounded-xl p-6 mb-6 min-h-[280px] flex flex-col"
        style={{
          backgroundColor: 'hsl(220 12% 10%)',
          border: '1px solid hsl(25 95% 55% / 0.15)',
        }}
      >
        <div className="text-center mb-4">
          <span className="text-4xl mb-2 block">{step.emoji}</span>
          <div
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full mb-2"
            style={{ backgroundColor: 'hsl(25 95% 55% / 0.12)', color: 'hsl(25 95% 60%)' }}
          >
            Passo {currentStep + 1} de {STEPS.length}
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'hsl(0 0% 95%)' }}>{step.title}</h2>
          <p className="text-sm mt-1" style={{ color: 'hsl(0 0% 55%)' }}>{step.description}</p>
        </div>

        <ul className="space-y-2.5 flex-1">
          {step.details.map((detail, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span
                className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: 'hsl(200 100% 50% / 0.15)', color: 'hsl(200 90% 60%)' }}
              >
                {i + 1}
              </span>
              <span style={{ color: 'hsl(0 0% 85%)' }}>{detail}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        {currentStep > 0 && (
          <Button
            variant="outline"
            size="lg"
            className="gap-1"
            style={{ borderColor: 'hsl(220 10% 25%)', backgroundColor: 'transparent', color: 'hsl(0 0% 80%)' }}
            onClick={() => setCurrentStep(currentStep - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>
        )}
        
        {isLast ? (
          <Button size="lg" className="flex-1 gap-2" onClick={onStart}
            style={{ backgroundColor: 'hsl(25 95% 55%)', color: 'hsl(0 0% 100%)' }}
          >
            Começar Cadastro
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button size="lg" className="flex-1 gap-2" onClick={() => setCurrentStep(currentStep + 1)}
            style={{ backgroundColor: 'hsl(25 95% 55%)', color: 'hsl(0 0% 100%)' }}
          >
            Próximo
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      <button
        onClick={onStart}
        className="w-full mt-3 text-center text-sm transition-colors hover:underline"
        style={{ color: 'hsl(0 0% 45%)' }}
      >
        Pular tutorial →
      </button>
    </div>
  );
}
