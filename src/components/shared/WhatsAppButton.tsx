import { Button } from '@/components/ui/button';
import { telefoneParaWhatsapp } from '@/lib/form-validators';
import { MessageCircle } from 'lucide-react';

interface WhatsAppButtonProps {
  telefone: string | null | undefined;
  size?: 'sm' | 'default' | 'icon';
  variant?: 'outline' | 'ghost' | 'default';
  className?: string;
  showLabel?: boolean;
}

const WhatsAppButton = ({ 
  telefone, 
  size = 'icon', 
  variant = 'ghost',
  className = '',
  showLabel = false 
}: WhatsAppButtonProps) => {
  if (!telefone) return null;

  const openWhatsApp = () => {
    window.open(`https://wa.me/${telefoneParaWhatsapp(telefone)}`, '_blank');
  };

  return (
    <Button 
      type="button" 
      variant={variant} 
      size={size} 
      onClick={openWhatsApp}
      className={className}
      title="Abrir WhatsApp"
    >
      <MessageCircle className="w-4 h-4 text-green-600" />
      {showLabel && <span className="ml-2">WhatsApp</span>}
    </Button>
  );
};

export default WhatsAppButton;