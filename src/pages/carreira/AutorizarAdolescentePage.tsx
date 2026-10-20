import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ShieldCheck, Users, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { VisibilidadePerfilEscolha, type VisibilidadePerfil } from '@/components/carreira/VisibilidadePerfilEscolha';
import { useCarreiraSession } from '@/hooks/useCarreiraSession';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useSEO } from '@/hooks/useSEO';
import { validateCPF, formatCPF } from '@/lib/cpf-validator';
import { PENDING_AUTORIZAR_KEY, TERMO_ANUENCIA_VERSAO } from '@/lib/adolescente-anuencia';
import logoCarreira from '@/assets/logo-carreira-id-dark.png';

interface Pedido {
  status: 'pendente' | 'invalido' | 'expirado' | 'aprovado' | 'recusado';
  primeiro_nome?: string;
  modalidade?: string;
  responsavel_nome?: string;
  escola_nome?: string | null;
}

function Moldura({ children, theme }: { children: React.ReactNode; theme: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8" data-theme={theme}>
      <img src={logoCarreira} alt="Carreira ID" className="h-14 mb-6" />
      <Card className="max-w-md w-full p-6 space-y-4">{children}</Card>
    </div>
  );
}

/** Página do link que o adolescente manda para o responsável. Confirmar cria o perfil no nome do responsável. */
export default function AutorizarAdolescentePage() {
  const [searchParams] = useSearchParams();
  const codigo = searchParams.get('codigo');
  const navigate = useNavigate();
  const { sessionUserId, loading: sessionLoading } = useCarreiraSession();
  const { theme } = useCarreiraTheme();
  const [cpf, setCpf] = useState('');
  const [aceite, setAceite] = useState(false);
  const [visibilidade, setVisibilidade] = useState<VisibilidadePerfil | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [recusado, setRecusado] = useState(false);

  useSEO({
    title: 'Autorização do responsável - CARREIRA ID',
    description: 'Autorize o cadastro esportivo de um atleta menor de idade no Carreira ID.',
    path: codigo ? `/autorizar?codigo=${codigo}` : '/autorizar',
    noindex: true,
  });

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['pedido-anuencia', codigo],
    queryFn: async (): Promise<Pedido> => {
      const { data, error } = await (supabase as any).rpc('responsavel_ver_pre_cadastro', { p_token: codigo });
      if (error) throw error;
      return data as Pedido;
    },
    enabled: !!codigo,
  });

  // Link que não vale mais não deve continuar redirecionando o login desta pessoa.
  useEffect(() => {
    if (pedido && pedido.status !== 'pendente') {
      try { localStorage.removeItem(PENDING_AUTORIZAR_KEY); } catch { /* ignore */ }
    }
  }, [pedido]);

  if (!codigo) return <Navigate to={carreiraPath('/')} replace />;

  if (sessionLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-theme={theme}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const entrar = () => {
    try { localStorage.setItem(PENDING_AUTORIZAR_KEY, codigo); } catch { /* ignore */ }
    navigate(carreiraPath('/cadastro'));
  };

  const autorizar = async () => {
    if (!validateCPF(cpf.replace(/\D/g, ''))) { toast.error('CPF inválido. Confira os números.'); return; }
    if (!visibilidade) { toast.error('Escolha quem pode ver o perfil.'); return; }
    if (!aceite) { toast.error('Marque a caixa de autorização para continuar.'); return; }
    setEnviando(true);
    try {
      const { data, error } = await (supabase as any).rpc('responsavel_aprovar_pre_cadastro', {
        p_token: codigo, p_cpf: cpf.replace(/\D/g, ''), p_termo_versao: TERMO_ANUENCIA_VERSAO, p_perfil_publico: visibilidade === 'publico',
      });
      if (error) throw error;
      try { localStorage.removeItem(PENDING_AUTORIZAR_KEY); } catch { /* ignore */ }
      toast.success('Perfil autorizado e criado! 🎉');
      navigate(carreiraPath(`/${(data as any).slug}`), { replace: true });
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível autorizar agora.');
    } finally {
      setEnviando(false);
    }
  };

  const nao = async () => {
    if (!window.confirm('Tem certeza que não autoriza? O pedido será encerrado e os dados de contato apagados.')) return;
    setEnviando(true);
    try {
      await (supabase as any).rpc('responsavel_recusar_pre_cadastro', { p_token: codigo });
      try { localStorage.removeItem(PENDING_AUTORIZAR_KEY); } catch { /* ignore */ }
      setRecusado(true);
    } finally {
      setEnviando(false);
    }
  };

  if (recusado) {
    return (
      <Moldura theme={theme}>
        <div className="text-center space-y-2">
          <XCircle className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-bold">Pedido encerrado</h1>
          <p className="text-sm text-muted-foreground">Você não autorizou o cadastro e nenhum perfil foi criado.</p>
        </div>
      </Moldura>
    );
  }

  if (!pedido || pedido.status !== 'pendente') {
    const texto =
      pedido?.status === 'aprovado' ? 'Este pedido já foi autorizado.'
      : pedido?.status === 'recusado' ? 'Este pedido foi encerrado.'
      : pedido?.status === 'expirado' ? 'Este link venceu. Peça para o atleta enviar um novo pelo Carreira ID.'
      : 'Este link não existe ou não vale mais. Peça para o atleta enviar um novo.';
    return (
      <Moldura theme={theme}>
        <div className="text-center space-y-3">
          <Users className="w-10 h-10 mx-auto text-muted-foreground opacity-60" />
          <p className="text-sm text-muted-foreground">{texto}</p>
          <Button variant="outline" className="w-full" onClick={() => navigate(carreiraPath('/'))}>Conhecer o Carreira ID</Button>
        </div>
      </Moldura>
    );
  }

  const nome = pedido.primeiro_nome || 'O atleta';

  return (
    <Moldura theme={theme}>
      <div className="text-center space-y-2">
        <ShieldCheck className="w-10 h-10 mx-auto text-primary" />
        <h1 className="text-lg font-bold">{nome} quer criar um perfil de atleta</h1>
        <p className="text-sm text-muted-foreground">
          Como {nome} é menor de idade, o cadastro só vale com a sua autorização como responsável legal.
        </p>
        {pedido.escola_nome && (
          <p className="text-sm text-muted-foreground">
            {nome} veio pelo convite da escola <strong className="text-foreground">{pedido.escola_nome}</strong>. Depois da autorização, a escola confirma o vínculo.
          </p>
        )}
      </div>

      <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-2">
        <p><strong>O que é o Carreira ID?</strong> Uma plataforma brasileira onde atletas de base registram a trajetória esportiva (jogos, campeonatos, conquistas) e ganham visibilidade com segurança. Você pode conhecer em <a className="underline" href="https://carreiraid.com.br" target="_blank" rel="noopener noreferrer">carreiraid.com.br</a>.</p>
      </div>

      <div className="text-sm space-y-2">
        <p className="font-semibold">Se você autorizar:</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>O perfil de {nome} ({pedido.modalidade}) é criado <strong className="text-foreground">no seu nome</strong>: você é o responsável e administra a conta.</li>
          <li>{nome} ganha um acesso próprio para atualizar foto, capa, bio, posições e registrar a jornada. Nome, privacidade e plano ficam só com você.</li>
          <li>O Carreira ID é gratuito. Você experimenta o plano Elite por 15 dias (e ganha mais 15 se o perfil for completado). Depois, o plano Base continua gratuito; o Elite só se você quiser (R$ 12/mês).</li>
          <li>O perfil nasce público (sem telefone, e-mail ou data de nascimento) e você pode mudar isso nas Configurações. Pode revogar o acesso de {nome} ou excluir tudo a qualquer momento.</li>
        </ul>
        <p className="text-xs text-muted-foreground">Usamos seu CPF apenas para identificar você como responsável. Ele não aparece no perfil.</p>
      </div>

      {!sessionUserId ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Para autorizar, entre ou crie sua conta grátis. Depois você volta direto para esta tela.</p>
          <Button className="w-full" size="lg" onClick={entrar}>Criar conta / Entrar</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="resp-cpf">Seu CPF *</Label>
            <Input id="resp-cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
          </div>
          <VisibilidadePerfilEscolha value={visibilidade} onChange={setVisibilidade} ajuda={`Você decide quem pode ver o perfil de ${nome}.`} />
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={aceite} onCheckedChange={(v) => setAceite(!!v)} className="mt-0.5" />
            <span>
              Declaro que sou pai, mãe ou responsável legal de {nome}, li os{' '}
              <Link to="/termos-de-uso" className="underline" target="_blank">Termos de Uso</Link> e a{' '}
              <Link to="/politica-de-privacidade" className="underline" target="_blank">Política de Privacidade</Link> e autorizo o tratamento dos dados pessoais de {nome} para criar e manter o perfil esportivo. Confirmo que as informações de {nome}, inclusive a data de nascimento, são verdadeiras e estou ciente de que dados falsos podem prejudicar o atleta, inclusive em campeonatos organizados por idade.
            </span>
          </label>
          <Button className="w-full" size="lg" onClick={autorizar} disabled={enviando}>
            {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Autorizar o perfil de {nome}
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={nao} disabled={enviando}>Não autorizo</Button>
        </div>
      )}
    </Moldura>
  );
}
