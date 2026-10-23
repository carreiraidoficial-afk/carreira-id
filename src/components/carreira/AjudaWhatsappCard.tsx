import { useEffect, useState } from 'react';
import { MessageCircle, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { copiarTelefoneParaConta } from '@/lib/telefone-conta';
import { formatPhoneInput, limparTelefone, validatePhone } from '@/lib/form-validators';

/**
 * Na escolha do tipo de perfil (onde a maioria desiste), oferece ajuda pelo WhatsApp. É opcional: a conta já existe, o número
 * só serve para a equipe ajudar a concluir o cadastro, e não bloqueia nada. Não aparece para quem já tem um número na conta.
 */
export function AjudaWhatsappCard({ userId }: { userId: string }) {
  const [jaTem, setJaTem] = useState<boolean | null>(null);
  const [numero, setNumero] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    let ativo = true;
    supabase.from('profiles').select('telefone').eq('user_id', userId).maybeSingle().then(({ data }) => {
      if (ativo) setJaTem(!!(data?.telefone && String(data.telefone).trim()));
    });
    return () => { ativo = false; };
  }, [userId]);

  if (jaTem === null || jaTem) return null;

  const salvar = async () => {
    const limpo = limparTelefone(numero);
    if (!validatePhone(limpo)) {
      toast.error('Digite um WhatsApp válido, com DDD.');
      return;
    }
    setSalvando(true);
    await copiarTelefoneParaConta(userId, limpo);
    setSalvando(false);
    setSalvo(true);
    toast.success('Anotado!');
  };

  return (
    <div className="mb-4 rounded-xl border p-4" style={{ borderColor: 'hsl(142 70% 40% / 0.4)', backgroundColor: 'hsl(142 70% 40% / 0.08)' }}>
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'hsl(142 70% 45%)' }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: 'hsl(0 0% 95%)' }}>Quer ajuda para concluir o cadastro?</p>
          {salvo ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: 'hsl(142 70% 55%)' }}>
              <Check className="h-3.5 w-3.5" />Anotado!
            </p>
          ) : (
            <div className="mt-2 flex gap-2">
              <Input
                inputMode="tel"
                placeholder="Seu WhatsApp (opcional)"
                value={numero}
                onChange={(e) => setNumero(formatPhoneInput(e.target.value))}
                className="min-w-0 flex-1"
                aria-label="Seu WhatsApp"
              />
              <Button type="button" size="sm" disabled={salvando || numero.length < 10} onClick={salvar}>
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
