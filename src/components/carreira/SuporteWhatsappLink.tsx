import { MessageCircle } from 'lucide-react';
import { SUPPORT_WHATSAPP } from '@/lib/form-validators';

/** Link discreto para falar com o suporte pelo WhatsApp, com a mensagem já escrita. Um só componente para todas as telas de cadastro. */
export function SuporteWhatsappLink({
  mensagem = 'Olá, preciso de ajuda com meu cadastro no Carreira ID',
  className = '',
}: {
  mensagem?: string;
  className?: string;
}) {
  return (
    <div className={`text-center ${className}`}>
      <a
        href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(mensagem)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs hover:underline"
        style={{ color: 'hsl(0 0% 60%)' }}
      >
        <MessageCircle className="h-3.5 w-3.5" style={{ color: 'hsl(142 70% 45%)' }} />
        Dúvidas? Fale com a gente
      </a>
    </div>
  );
}
