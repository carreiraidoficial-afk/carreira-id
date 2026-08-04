import { ArrowLeft, Mail, MessageCircle, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isCarreiraDomain } from '@/hooks/useCarreiraBasePath';
import logoCarreiraId from '@/assets/logo-carreira-id-dark.png';
import logoAtletaId from '@/assets/logo-atleta-id.png';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { useSEO } from '@/hooks/useSEO';

export default function ContatoPage() {
  const navigate = useNavigate();
  const isCarreira = isCarreiraDomain();
  const logo = isCarreira ? logoCarreiraId : logoAtletaId;
  const brand = isCarreira ? 'Carreira ID' : 'Atleta ID';
  const { theme } = useCarreiraTheme();

  useSEO({
    title: `Contato do ${brand}: Email, WhatsApp e Suporte Rápido`,
    description: 'Fale com o Carreira ID por email ou WhatsApp. Tire dúvidas, peça suporte ou fale com nossa equipe sobre a plataforma de carreira esportiva de base.',
    path: '/contato',
  });

  return (
    <div className="min-h-screen bg-background" data-theme={theme}>
      <div className="h-1 w-full bg-[hsl(25_95%_55%)]" />
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container flex items-center h-14 px-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <img src={logo} alt={brand} className="h-10" />
          </button>
        </div>
      </header>

      <main className="container max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-[hsl(25_95%_55%)] mb-1">Contato — {brand}</h1>
        <p className="text-sm text-muted-foreground mb-8">Entre em contato conosco. Estamos prontos para ajudar!</p>

        <div className="space-y-4">
          <div className="flex items-start gap-4 p-5 rounded-xl border border-border bg-card">
            <Mail className="w-6 h-6 text-[hsl(25_95%_55%)] mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold text-foreground">Email</h2>
              <a href="mailto:contato@carreiraid.com.br" className="text-[hsl(25_95%_55%)] hover:underline">
                contato@carreiraid.com.br
              </a>
            </div>
          </div>

          <div className="flex items-start gap-4 p-5 rounded-xl border border-border bg-card">
            <MessageCircle className="w-6 h-6 text-green-500 mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold text-foreground">WhatsApp</h2>
              <a href="https://wa.me/5521969622045" target="_blank" rel="noopener noreferrer" className="text-[hsl(25_95%_55%)] hover:underline">
                (21) 96962-2045
              </a>
              <p className="text-sm text-muted-foreground mt-1">Atendimento de segunda a sexta, das 9h às 18h.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-5 rounded-xl border border-border bg-card">
            <MapPin className="w-6 h-6 text-[hsl(25_95%_55%)] mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold text-foreground">Localização</h2>
              <p className="text-muted-foreground">Rio de Janeiro, RJ — Brasil</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
