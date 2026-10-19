import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageCircle, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { linkAnuencia, mensagemParaResponsavel, linkWhatsApp } from '@/lib/adolescente-anuencia';

interface PreCadastro {
  status: 'pendente' | 'aprovado' | 'recusado' | 'expirado';
  nome: string;
  responsavel_nome: string;
  responsavel_whatsapp: string;
  expira_em: string;
}

export function usePreCadastroAdolescente(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['pre-cadastro-adolescente', userId],
    queryFn: async (): Promise<PreCadastro | null> => {
      const { data, error } = await (supabase as any).rpc('adolescente_meu_pre_cadastro');
      if (error) throw error;
      return (data as PreCadastro) || null;
    },
    enabled: !!userId,
    staleTime: 15_000,
  });
}

interface Props {
  userId: string;
  /** Token recém-criado (só existe logo após o cadastro). Depois disso, gera-se um link novo. */
  tokenInicial?: string | null;
  onAprovado?: () => void;
}

/** Tela da conta provisória: o perfil só nasce quando o responsável confirmar. */
export function AdolescenteAguardando({ userId, tokenInicial = null, onAprovado }: Props) {
  const queryClient = useQueryClient();
  const { data: pre, isLoading } = usePreCadastroAdolescente(userId);
  const [token, setToken] = useState<string | null>(tokenInicial);
  const [avisoAberto, setAvisoAberto] = useState(!!tokenInicial);
  const [gerando, setGerando] = useState(false);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!pre) return null;

  if (pre.status === 'aprovado') {
    return (
      <Card className="p-6 text-center space-y-3">
        <ShieldCheck className="w-10 h-10 mx-auto text-emerald-600" />
        <h2 className="text-lg font-bold">Seu responsável confirmou! 🎉</h2>
        <p className="text-sm text-muted-foreground">Seu perfil já está ativo.</p>
        <Button className="w-full" onClick={() => onAprovado?.()}>Ver meu perfil</Button>
      </Card>
    );
  }
  if (pre.status === 'recusado') {
    return (
      <Card className="p-6 text-center space-y-2">
        <h2 className="text-lg font-bold">Seu responsável não autorizou</h2>
        <p className="text-sm text-muted-foreground">Converse com ele(a). Se quiser tentar de novo, é só fazer um novo cadastro.</p>
      </Card>
    );
  }

  const primeiroNome = pre.nome.split(' ')[0];
  const venceu = pre.status === 'expirado';
  const expira = new Date(pre.expira_em).toLocaleDateString('pt-BR');

  const abrirWhatsApp = async () => {
    let t = token;
    if (!t || venceu) {
      setGerando(true);
      try {
        const { data, error } = await (supabase as any).rpc('adolescente_reenviar_link');
        if (error) throw error;
        t = (data as any).token as string;
        setToken(t);
        queryClient.invalidateQueries({ queryKey: ['pre-cadastro-adolescente', userId] });
      } catch (e: any) {
        toast.error(e?.message || 'Não foi possível gerar o link agora.');
        return;
      } finally {
        setGerando(false);
      }
    }
    const msg = mensagemParaResponsavel(pre.responsavel_nome, linkAnuencia(t!));
    window.open(linkWhatsApp(pre.responsavel_whatsapp, msg), '_blank', 'noopener');
  };

  return (
    <>
      <Card className="p-6 text-center space-y-4 animate-fade-in">
        <Clock className="w-10 h-10 mx-auto text-amber-500" />
        <h2 className="text-lg font-bold">{venceu ? 'O link venceu' : `Quase lá, ${primeiroNome}!`}</h2>
        <p className="text-sm text-muted-foreground">
          {venceu
            ? 'O prazo de 7 dias passou. Gere um novo link e envie de novo para o seu responsável.'
            : <>Seu perfil só é ativado quando <strong className="text-foreground">{pre.responsavel_nome}</strong> autorizar. Envie o pedido pelo seu WhatsApp. Vale até {expira}.</>}
        </p>
        <Button className="w-full" size="lg" onClick={abrirWhatsApp} disabled={gerando}>
          {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : venceu ? <RefreshCw className="w-4 h-4 mr-2" /> : <MessageCircle className="w-4 h-4 mr-2" />}
          {venceu ? 'Gerar novo link e enviar' : token ? 'Enviar pelo WhatsApp' : 'Enviar de novo pelo WhatsApp'}
        </Button>
        {!venceu && !token && (
          <p className="text-xs text-muted-foreground">Ao enviar de novo, o link anterior deixa de valer.</p>
        )}
      </Card>

      <Dialog open={avisoAberto} onOpenChange={setAvisoAberto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sua conta é provisória</DialogTitle>
            <DialogDescription className="space-y-2 pt-1">
              <span className="block">Por ser menor de 18 anos, seu perfil só fica ativo depois que seu responsável autorizar.</span>
              <span className="block">Vamos abrir o seu WhatsApp com uma mensagem pronta para ele(a). É só enviar.</span>
            </DialogDescription>
          </DialogHeader>
          <Button className="w-full" onClick={() => { setAvisoAberto(false); abrirWhatsApp(); }}>
            <MessageCircle className="w-4 h-4 mr-2" /> Entendi, enviar para meu responsável
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
