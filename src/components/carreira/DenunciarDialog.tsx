import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

export type TipoDenuncia = 'post' | 'comentario' | 'perfil_atleta' | 'perfil_rede';

export const MOTIVOS_DENUNCIA: { valor: string; rotulo: string }[] = [
  { valor: 'spam', rotulo: 'Spam ou propaganda enganosa' },
  { valor: 'assedio', rotulo: 'Assédio, ofensa ou bullying' },
  { valor: 'conteudo_sexual', rotulo: 'Conteúdo sexual ou impróprio' },
  { valor: 'violencia', rotulo: 'Violência ou ameaça' },
  { valor: 'menor_exposto', rotulo: 'Exposição indevida de criança ou adolescente' },
  { valor: 'info_falsa', rotulo: 'Informação falsa ou perfil falso' },
  { valor: 'outro', rotulo: 'Outro motivo' },
];

const TITULO: Record<TipoDenuncia, string> = {
  post: 'Denunciar publicação',
  comentario: 'Denunciar comentário',
  perfil_atleta: 'Denunciar perfil',
  perfil_rede: 'Denunciar perfil',
};

interface DenunciarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: TipoDenuncia;
  conteudoId: string;
}

/** Denúncia de conteúdo por qualquer usuário logado. A decisão é do time do Carreira ID (Admin → Denúncias). */
export function DenunciarDialog({ open, onOpenChange, tipo, conteudoId }: DenunciarDialogProps) {
  const [motivo, setMotivo] = useState('');
  const [detalhes, setDetalhes] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!motivo) return;
    setEnviando(true);
    const { error } = await (supabase as any).rpc('denunciar_conteudo', {
      p_tipo: tipo, p_conteudo_id: conteudoId, p_motivo: motivo, p_detalhes: detalhes.trim() || null,
    });
    setEnviando(false);
    if (error) {
      const msg = String(error.message || '');
      toast.error(msg.includes('proprio') ? 'Você não pode denunciar o seu próprio conteúdo.' : 'Não consegui enviar a denúncia. Tente novamente.');
      return;
    }
    toast.success('Denúncia enviada. Nossa equipe vai analisar. Obrigado por avisar!');
    setMotivo('');
    setDetalhes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!enviando) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{TITULO[tipo]}</DialogTitle>
          <DialogDescription>Quem denunciou não é revelado. Nossa equipe analisa e decide o que fazer.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={motivo} onValueChange={setMotivo} className="space-y-1.5">
          {MOTIVOS_DENUNCIA.map((m) => (
            <div key={m.valor} className="flex items-center gap-2">
              <RadioGroupItem value={m.valor} id={`den-${m.valor}`} />
              <Label htmlFor={`den-${m.valor}`} className="cursor-pointer text-sm font-normal">{m.rotulo}</Label>
            </div>
          ))}
        </RadioGroup>
        <Textarea
          value={detalhes}
          onChange={(e) => setDetalhes(e.target.value.slice(0, 500))}
          placeholder="Quer explicar melhor? (opcional)"
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={enviar} disabled={!motivo || enviando}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar denúncia'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
