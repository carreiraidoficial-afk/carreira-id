import { useState } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useCarreiraSession } from '@/hooks/useCarreiraSession';
import { useCarreiraTheme } from '@/hooks/useCarreiraTheme';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import logoCarreira from '@/assets/logo-carreira-id-dark.png';

/** Guarda o código do convite antes de mandar a pessoa criar conta/logar,
 * pra CarreiraCadastroPage trazer ela de volta pra cá assim que autenticar
 * -- sem isso, o convite se perdia no meio do fluxo de cadastro geral. */
export const PENDING_COLAB_KEY = 'carreira_pending_colab_codigo';

function listaComE(nomes: string[]): string {
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

function useConvitePendente(codigo: string | null) {
  return useQuery({
    queryKey: ['convite-colaborador', codigo],
    queryFn: async () => {
      if (!codigo) return null;
      const { data, error } = await supabase
        .from('perfil_atleta_colaboradores')
        .select('id, crianca_id, nome, status, convidado_por')
        .eq('codigo_convite', codigo)
        .eq('status', 'pendente');
      if (error) throw error;
      if (!data || data.length === 0) return null;

      const criancaIds = data.map((d) => d.crianca_id);
      const { data: perfis } = await supabase
        .from('perfil_atleta')
        .select('crianca_id, nome, foto_url')
        .in('crianca_id', criancaIds);

      const { data: responsavel } = await supabase
        .from('profiles')
        .select('nome')
        .eq('user_id', data[0].convidado_por)
        .maybeSingle();

      return {
        ids: data.map((d) => d.id),
        nomeConvidado: data[0].nome,
        nomeResponsavel: responsavel?.nome || null,
        atletas: (perfis || []).map((p) => ({ nome: p.nome, foto_url: p.foto_url })),
      };
    },
    enabled: !!codigo,
  });
}

export default function ColaborarPage() {
  const [searchParams] = useSearchParams();
  const codigo = searchParams.get('codigo');
  const navigate = useNavigate();
  const { sessionUserId, loading: sessionLoading } = useCarreiraSession();
  const { theme } = useCarreiraTheme();
  const { data: convite, isLoading: conviteLoading } = useConvitePendente(codigo);
  const queryClient = useQueryClient();
  const [aceitando, setAceitando] = useState(false);

  const handleAceitar = async () => {
    if (!convite || !sessionUserId) return;
    setAceitando(true);
    try {
      const { error } = await supabase
        .from('perfil_atleta_colaboradores')
        .update({ user_id: sessionUserId, status: 'ativo', ativado_em: new Date().toISOString() } as any)
        .in('id', convite.ids);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['minhas-criancas'] });
      toast.success('Acesso liberado! Você já pode postar e registrar jornada.');
      navigate(carreiraPath('/minha'), { replace: true });
    } catch (e: any) {
      toast.error('Erro ao aceitar convite: ' + e.message);
    } finally {
      setAceitando(false);
    }
  };

  if (!codigo) {
    return <Navigate to={carreiraPath('/')} replace />;
  }

  if (sessionLoading || conviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-theme={theme}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4" data-theme={theme}>
      <img src={logoCarreira} alt="Carreira" className="h-16 mb-6" />
      <Card className="max-w-sm w-full p-6 text-center space-y-4">
        {!sessionUserId ? (
          <>
            <ShieldCheck className="w-10 h-10 mx-auto text-primary" />
            <div>
              <h1 className="text-lg font-bold">Convite de colaboração</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Entre ou crie sua conta grátis pra aceitar este convite. Depois de entrar, volte a abrir este mesmo link.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                try { sessionStorage.setItem(PENDING_COLAB_KEY, codigo); } catch { /* ignore */ }
                navigate(carreiraPath('/cadastro'));
              }}
            >
              Criar conta / Entrar
            </Button>
          </>
        ) : !convite ? (
          <>
            <Users className="w-10 h-10 mx-auto text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              Esse convite não existe mais, já foi usado, ou o acesso foi revogado.
            </p>
            <Button variant="outline" className="w-full" onClick={() => navigate(carreiraPath('/'))}>Voltar ao início</Button>
          </>
        ) : (
          <>
            <ShieldCheck className="w-10 h-10 mx-auto text-primary" />
            <div>
              <h1 className="text-lg font-bold">Convite de colaboração</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Oi, <strong>{convite.nomeConvidado}</strong>!{' '}
                {convite.nomeResponsavel ? (
                  <>
                    <strong>{convite.nomeResponsavel}</strong>, responsável por {listaComE(convite.atletas.map((a) => a.nome))}, está te convidando pra ajudar a registrar os momentos esportivos {convite.atletas.length > 1 ? 'deles' : 'dele(a)'}.
                  </>
                ) : (
                  <>Você foi convidado(a) pra ajudar a registrar os momentos esportivos de:</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {convite.atletas.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-medium">
                  {a.foto_url && <img src={a.foto_url} alt="" className="w-4 h-4 rounded-full object-cover" />}
                  {a.nome}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Você vai poder postar fotos/vídeos e registrar jogos e campeonatos com seu próprio login, direto de onde estiver.
            </p>
            <Button className="w-full" onClick={handleAceitar} disabled={aceitando}>
              {aceitando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aceitar convite'}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
