import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, ArrowLeft, Loader2, UserPlus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

/** Perfil de atleta restrito às conexões aprovadas, aberto por alguém que ainda não é conexão. Não mostra nenhum dado do perfil. */
export function PerfilRestritoCard({ slug, carreiraTheme }: { slug: string; carreiraTheme?: string }) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const pedirConexao = async () => {
    setEnviando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let meuPerfilId: string | null = null;
      if (session?.user) {
        const { data: meu } = await supabase
          .from('perfil_atleta')
          .select('id')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        meuPerfilId = meu?.id ?? null;
      }
      const { data, error } = await (supabase as any).rpc('solicitar_conexao_perfil_restrito', { p_slug: slug, p_meu_perfil_atleta_id: meuPerfilId });
      if (error) throw error;
      setEnviado(true);
      toast.success(data === 'ja_existe' ? 'Você já pediu conexão. Aguarde a resposta.' : 'Pedido enviado! Você será avisado quando for aprovado.');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível enviar o pedido.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" data-theme={carreiraTheme}>
      <div className="container py-20 text-center max-w-md">
        <Lock className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Perfil restrito</h1>
        <p className="text-muted-foreground mb-6">
          O responsável por este perfil permite que apenas as conexões aprovadas vejam as informações. Você pode pedir conexão e aguardar a aprovação.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={pedirConexao} disabled={enviando || enviado}>
            {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : enviado ? <Check className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            {enviado ? 'Pedido enviado' : 'Pedir conexão'}
          </Button>
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao início
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Visitante sem conta diante de um perfil que não é público. Não mostra nenhum dado do perfil. */
export function PerfilSoComContaCard({ slug, nivel, carreiraTheme }: { slug: string; nivel: 'conta' | 'conexoes'; carreiraTheme?: string }) {
  const irParaEntrar = `/auth?next=${encodeURIComponent(`/${slug}`)}`;
  return (
    <div className="min-h-screen bg-background" data-theme={carreiraTheme}>
      <div className="container py-20 text-center max-w-md">
        <Lock className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Este perfil não é público</h1>
        <p className="text-muted-foreground mb-6">
          {nivel === 'conexoes'
            ? 'O responsável permite que apenas as conexões aprovadas vejam este perfil. Entre ou crie sua conta no Carreira ID para pedir conexão.'
            : 'O responsável escolheu que só quem tem conta no Carreira ID pode ver este perfil. Entre ou crie sua conta gratuita para acessar.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild>
            <Link to={irParaEntrar}>Entrar ou criar conta</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao início
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
