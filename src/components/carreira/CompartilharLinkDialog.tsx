import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MessageCircle, Mail, Copy, Check } from 'lucide-react';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nome de quem é o perfil (não de quem está compartilhando) */
  nome: string;
  slug: string;
}

/** Compartilhar o perfil de OUTRA pessoa: só o link do perfil, em terceira pessoa. Sem código de convite do dono
 * (o convite é de quem é o perfil) e sem texto em primeira pessoa ("Aqui é o Marco..."), que só serve ao próprio dono. */
export function CompartilharLinkDialog({ open, onOpenChange, nome, slug }: Props) {
  const link = `${window.location.origin}${carreiraPath(`/${slug}`)}`;
  const [mensagem, setMensagem] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) setMensagem(`Dá uma olhada no perfil de ${nome} no Carreira ID:\n${link}`);
  }, [open, nome, link]);

  const enviar = (canal: 'whatsapp' | 'email' | 'copy') => {
    if (!mensagem.trim()) {
      toast.error('A mensagem está vazia');
      return;
    }
    if (canal === 'whatsapp') {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const url = isMobile
        ? `https://wa.me/?text=${encodeURIComponent(mensagem)}`
        : `https://web.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (canal === 'email') {
      window.location.href = `mailto:?subject=${encodeURIComponent(`Perfil de ${nome} no Carreira ID`)}&body=${encodeURIComponent(mensagem)}`;
    } else {
      navigator.clipboard.writeText(mensagem);
      setCopied(true);
      toast.success('Mensagem copiada!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Compartilhar perfil</DialogTitle>
          <DialogDescription>Envie o perfil de {nome} para quem você quiser.</DialogDescription>
        </DialogHeader>
        <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={4} className="text-sm resize-y" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button type="button" size="sm" onClick={() => enviar('whatsapp')} className="bg-[#25D366] hover:bg-[#1ebe57] text-white">
            <MessageCircle className="w-4 h-4 mr-1" />
            WhatsApp
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => enviar('email')}>
            <Mail className="w-4 h-4 mr-1" />
            Email
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => enviar('copy')}>
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
