import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';

interface Props {
  perfilId: string;
  nomeEscola: string;
  conviteCodigo: string | null;
  accentColor: string;
}

/** Só pro dono da escola: link de convite que entra direto vinculado (sem precisar aprovar),
 * pra mandar no grupo de pais. Gera o código na primeira vez, se a escola ainda não tem. */
export function EscolaConvidarAlunos({ perfilId, nomeEscola, conviteCodigo, accentColor }: Props) {
  const [codigo, setCodigo] = useState<string | null>(conviteCodigo);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (codigo) return;
    let ativo = true;
    const novo = Math.random().toString(36).substring(2, 8).toUpperCase();
    supabase
      .from('perfis_rede')
      .update({ convite_codigo: novo } as any)
      .eq('id', perfilId)
      .is('convite_codigo', null)
      .then(({ error }) => {
        if (ativo && !error) setCodigo(novo);
      });
    return () => { ativo = false; };
  }, [codigo, perfilId]);

  if (!codigo) return null;

  const link = `${window.location.origin}${carreiraPath('/cadastro')}?ref=atleta&convite=${codigo}`;
  const mensagem = `Olá! A ${nomeEscola} agora está no Carreira ID. Crie o perfil do seu atleta por este link e acompanhe a trajetória esportiva dele: ${link}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie o link manualmente.');
    }
  };

  return (
    <Card className="p-4 sm:p-5" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        <Send className="w-4 h-4" style={{ color: accentColor }} />
        Convide seus alunos
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Quem criar o perfil por este link já entra vinculado à escola, sem precisar da sua aprovação. Só você vê este bloco.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Link de convite da escola"
          className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-xs text-foreground"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copiar}>
            {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            Copiar
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            style={{ backgroundColor: accentColor, color: '#ffffff' }}
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank', 'noopener,noreferrer')}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </Button>
        </div>
      </div>
    </Card>
  );
}
