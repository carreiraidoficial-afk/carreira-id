import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, ArrowLeft, Lock, Sparkles } from 'lucide-react';
import { CarreiraPlano, PLANOS, planoNivel, TRIAL_DIAS } from '@/config/carreiraPlanos';
import { useCarreiraPlano } from '@/hooks/useCarreiraPlano';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CarreiraPaywall } from '@/components/carreira/CarreiraPaywall';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { trackInitiateCheckout, trackSubscribe, pushDataLayer } from '@/lib/fbPixel';

export default function CarreiraPlanos() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: perfil } = useQuery({
    queryKey: ['perfil-atleta-planos', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('perfil_atleta').select('crianca_id, nome').eq('user_id', user!.id).limit(1);
      return data?.[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: crianca } = useQuery({
    queryKey: ['crianca-planos', perfil?.crianca_id],
    queryFn: async () => {
      const { data } = await supabase.from('criancas').select('nome').eq('id', perfil!.crianca_id!).single();
      return data;
    },
    enabled: !!perfil?.crianca_id,
  });

  const criancaId = perfil?.crianca_id || null;
  const { plano: planoAtual } = useCarreiraPlano(criancaId);
  const [selectedPlano, setSelectedPlano] = useState<CarreiraPlano | null>(null);

  const planos: CarreiraPlano[] = ['base', 'premium'];

  return (
    <div className="min-h-screen bg-[hsl(220,15%,6%)] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[hsl(220,15%,6%)]/95 backdrop-blur border-b border-white/10">
        <div className="container flex items-center gap-3 h-14 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">Planos Carreira ID</h1>
        </div>
      </header>

      <main className="container max-w-3xl py-6 px-4 space-y-6 animate-fade-in">
        {/* Subtitle */}
        <div className="text-center space-y-1">
          <p className="text-sm text-white/50">
            Escolha o plano ideal para sua jornada esportiva
          </p>
          {/* Current plan */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="text-xs text-white/40">Seu plano:</span>
            <Badge
              className="font-bold border"
              style={{
                backgroundColor: `${PLANOS[planoAtual].cor}20`,
                color: PLANOS[planoAtual].cor,
                borderColor: `${PLANOS[planoAtual].cor}40`,
              }}
            >
              {PLANOS[planoAtual].icone} {PLANOS[planoAtual].nome}
            </Badge>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
          {planos.map((plano) => {
            const info = PLANOS[plano];
            const isAtual = plano === planoAtual;
            const isUpgrade = planoNivel(plano) > planoNivel(planoAtual);
            const isDowngrade = planoNivel(plano) < planoNivel(planoAtual);
            const isPopular = plano === 'premium';

            return (
              <div
                key={plano}
                className={`relative rounded-xl overflow-hidden transition-all border-2 ${
                  isAtual
                    ? 'shadow-lg'
                    : isPopular
                    ? 'border-amber-500/40'
                    : 'border-white/10'
                }`}
                style={{
                  backgroundColor: 'hsl(220 15% 10%)',
                  ...(isAtual
                    ? { borderColor: info.cor, boxShadow: `0 0 24px ${info.cor}25` }
                    : {}),
                }}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white rounded-bl-lg" style={{ backgroundColor: info.cor }}>
                    {TRIAL_DIAS} dias grátis
                  </div>
                )}
                {isAtual && (
                  <div
                    className="absolute top-0 left-0 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white rounded-br-lg"
                    style={{ backgroundColor: info.cor }}
                  >
                    Seu plano
                  </div>
                )}

                <div className="pt-8 pb-6 px-5 space-y-4">
                  {/* Plan header */}
                  <div className="text-center space-y-1">
                    <span className="text-3xl">{info.icone}</span>
                    <h3 className="text-xl font-bold" style={{ color: info.cor }}>
                      {info.nome}
                    </h3>
                    <p className="text-xs text-white/40">{info.descricao}</p>
                  </div>

                  {/* Price */}
                  <div className="text-center">
                    {info.preco === 0 ? (
                      <span className="text-3xl font-extrabold text-white">Grátis</span>
                    ) : (
                      <div>
                        <span className="text-sm text-white/40">R$</span>
                        <span className="text-3xl font-extrabold text-white mx-0.5">
                          {info.preco.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="text-sm text-white/40">/mês</span>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/10" />

                  {/* Features */}
                  <ul className="space-y-2">
                    {info.destaques.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                        <Check
                          className="w-4 h-4 mt-0.5 flex-shrink-0"
                          style={{ color: info.cor }}
                        />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="pt-2">
                    {isAtual ? (
                      <Button
                        variant="outline"
                        className="w-full border-white/20 text-white/50 hover:bg-white/5"
                        disabled
                      >
                        Plano atual
                      </Button>
                    ) : isDowngrade ? (
                      <Button
                        variant="ghost"
                        className="w-full text-white/20"
                        disabled
                      >
                        —
                      </Button>
                    ) : (
                      <Button
                        className="w-full gap-1.5 text-white font-bold"
                        style={{ backgroundColor: info.cor }}
                        onClick={() => {
                          trackInitiateCheckout(plano, info.preco);
                          pushDataLayer('initiate_checkout', { plan: plano });
                          setSelectedPlano(plano);
                        }}
                      >
                        {plano === 'premium' ? <Crown className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        {isUpgrade ? 'Fazer upgrade' : 'Assinar'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="text-center space-y-1.5 pt-4 pb-8">
          <p className="text-xs text-white/30">
            Todos os planos incluem perfil público, conexões e visibilidade para scouts.
          </p>
          <p className="text-xs text-white/30">
            Cancele quando quiser • Sem taxa de cancelamento
          </p>
        </div>
      </main>

      {/* Checkout Dialog */}
      <Dialog open={!!selectedPlano} onOpenChange={(open) => !open && setSelectedPlano(null)}>
        <DialogContent className="max-w-md bg-[hsl(220,15%,10%)] border-white/10 text-white max-h-[90vh] overflow-y-auto">
          {selectedPlano && (
            <CarreiraPaywall
              limitResult={{ status: 'limit_reached', source: 'freemium', count: 0, limit: 0 }}
              childName={crianca?.nome}
              criancaId={criancaId || undefined}
              planoSelecionado={selectedPlano}
              onClose={() => setSelectedPlano(null)}
              onSubscribed={() => {
                trackSubscribe(selectedPlano, PLANOS[selectedPlano].preco);
                pushDataLayer('purchase', { plan: selectedPlano });
                setSelectedPlano(null);
                navigate(-1);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
