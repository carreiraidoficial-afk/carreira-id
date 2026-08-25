import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, UserCircle, Save, CreditCard, ShieldCheck, Fingerprint, Smartphone, Bell, KeyRound, MessageCircle, FileText, ChevronRight, Users, Lock, Globe, Trash2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { SUPPORT_WHATSAPP_URL } from '@/lib/form-validators';
import { AssinaturaCard } from './AssinaturaCard';
import { ColaboradoresTab } from './ColaboradoresTab';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { toast } from 'sonner';

/** Subconjunto de campos usados aqui -- aceita tanto PerfilAtleta quanto
 * um perfil de rede (técnico, professor, scout etc), já que ambos abrem
 * este mesmo dialog de Configurações a partir do botão de engrenagem. */
interface ConfigPerfil {
  id: string;
  user_id: string;
  crianca_id?: string | null;
  is_public?: boolean;
}

interface EditConfiguracoesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perfil: ConfigPerfil;
  /** 'rede' esconde abas que só fazem sentido pra perfil de atleta
   * (Usuários/Colaboradores e Privacidade) e aponta a exclusão de conta
   * pra tabela certa. Default 'atleta' mantém o comportamento anterior. */
  perfilTipo?: 'atleta' | 'rede';
  /** Permite abrir o dialog já na aba desejada (ex: 'usuarios', vindo do
   * banner de convite de colaborador). Default 'responsavel'. */
  defaultTab?: string;
}

/**
 * Parte "administrativa" da conta -- separada de EditPerfilDialog (que fica
 * só com dados do atleta: foto, cor, modalidades etc) porque misturar as
 * duas coisas num só dialog com 5 abas estourava a tela no celular.
 */
export function EditConfiguracoesDialog({ open, onOpenChange, perfil, perfilTipo = 'atleta', defaultTab = 'responsavel' }: EditConfiguracoesDialogProps) {
  const isAtleta = perfilTipo === 'atleta';
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [isPublic, setIsPublic] = useState(perfil.is_public);
  const { isSupported: pushSupported, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotifications();

  useEffect(() => {
    setIsPublic(perfil.is_public);
  }, [perfil.is_public]);

  const togglePublic = useMutation({
    mutationFn: async (novoValor: boolean) => {
      const { error } = await supabase
        .from('perfil_atleta')
        .update({ is_public: novoValor })
        .eq('id', perfil.id);
      if (error) throw error;
      return novoValor;
    },
    onSuccess: (novoValor) => {
      setIsPublic(novoValor);
      queryClient.invalidateQueries({ queryKey: ['carreira-profile-by-slug'] });
      toast.success(novoValor ? 'Perfil agora está público.' : 'Perfil agora está oculto.');
    },
    onError: () => toast.error('Não foi possível alterar a privacidade do perfil.'),
  });

  const handleAlterarSenha = async () => {
    setEnviandoReset(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error('Não foi possível identificar seu e-mail.');
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(`Enviamos um link de redefinição para ${user.email}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar link de redefinição');
    } finally {
      setEnviandoReset(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="flex w-full overflow-x-auto justify-start gap-1 h-auto p-1">
            <TabsTrigger value="responsavel" className="shrink-0 flex items-center gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3">
              <UserCircle className="w-3.5 h-3.5" />
              Responsável
            </TabsTrigger>
            <TabsTrigger value="assinatura" className="shrink-0 flex items-center gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3">
              <CreditCard className="w-3.5 h-3.5" />
              Assinatura
            </TabsTrigger>
            {isAtleta && (
              <TabsTrigger value="usuarios" className="shrink-0 flex items-center gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3">
                <Users className="w-3.5 h-3.5" />
                Colaboradores
              </TabsTrigger>
            )}
            <TabsTrigger value="conta" className="shrink-0 flex items-center gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              Conta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="responsavel" className="mt-4">
            <ResponsavelTab userId={perfil.user_id} />
          </TabsContent>

          <TabsContent value="assinatura" className="mt-4">
            {perfil.crianca_id ? (
              <AssinaturaCard userId={perfil.user_id} criancaId={perfil.crianca_id} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Assinatura disponível apenas para perfis de atleta.</p>
            )}
          </TabsContent>

          {isAtleta && (
            <TabsContent value="usuarios" className="mt-4">
              <ColaboradoresTab userId={perfil.user_id} />
            </TabsContent>
          )}

          <TabsContent value="conta" className="mt-4 space-y-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Conta</p>
              <button
                type="button"
                className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors disabled:opacity-60"
                onClick={handleAlterarSenha}
                disabled={enviandoReset}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {enviandoReset ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Alterar senha</p>
                    <p className="text-xs text-muted-foreground">Enviamos um link por e-mail pra você definir uma nova senha</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {isAtleta && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Privacidade</p>
              <div className="rounded-lg border p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Perfil {isPublic ? 'público' : 'oculto'}</p>
                      <p className="text-xs text-muted-foreground">
                        {isPublic ? 'Visível pra qualquer pessoa com o link' : 'Visível só pra quem tem conta no Carreira ID'}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isPublic}
                    disabled={togglePublic.isPending}
                    onCheckedChange={(checked) => togglePublic.mutate(checked)}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed pt-2 border-t">
                  {isPublic
                    ? 'Com o perfil público, qualquer pessoa que tiver o link consegue ver a página — mesmo sem estar logada ou ter conta no Carreira ID, inclusive fora do app (ex: no Google ou compartilhado no WhatsApp).'
                    : 'Com o perfil oculto, a página só abre pra quem estiver logado com uma conta no Carreira ID. Visitantes sem conta (inclusive buscas do Google) não conseguem mais acessar, mesmo com o link em mãos.'}
                </p>
              </div>
            </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Notificações e Segurança</p>
              <div className="space-y-2">
                <div className={`flex items-center justify-between rounded-lg border p-3 bg-muted/30 ${!pushSupported ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        Notificações {isSubscribed ? 'ligadas' : 'desligadas'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {!pushSupported
                          ? 'Não suportado neste navegador/dispositivo'
                          : 'Dispositivo configurado para receber avisos'}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isSubscribed}
                    disabled={!pushSupported || pushLoading}
                    onCheckedChange={async (checked) => {
                      if (checked) {
                        const result = await subscribe();
                        if (!result.ok) {
                          toast.error(result.reason || 'Não foi possível ativar as notificações.');
                        }
                      } else {
                        await unsubscribe();
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Fingerprint className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Biometria</p>
                      <p className="text-xs text-muted-foreground">Use sua impressão digital ou Face ID para entrar mais rápido</p>
                    </div>
                  </div>
                  <Switch checked={false} disabled />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Autenticação em duas etapas</p>
                      <p className="text-xs text-muted-foreground">Código SMS para mais segurança</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Em breve</Badge>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Suporte</p>
              <a
                href={SUPPORT_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Falar com Suporte</p>
                    <p className="text-xs text-muted-foreground">Tire suas dúvidas direto pelo WhatsApp</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Sobre</p>
              <div className="space-y-2">
                <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-medium">Termos de Uso</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </a>
                <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-medium">Política de Privacidade</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </a>
              </div>
            </div>

            <div className="pt-2 border-t">
              <Button type="button" variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 mt-4" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2" />Apagar minha conta
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DeleteAccountDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          perfilId={perfil.id}
          perfilTable={isAtleta ? 'perfil_atleta' : 'perfis_rede'}
        />
      </DialogContent>
    </Dialog>
  );
}

/* --- Responsável Tab --- */
function ResponsavelTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dirty, setDirty] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['responsavel-profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('nome, email, telefone')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;

      if (!data) {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData?.user;
        if (authUser) {
          const fallbackNome = authUser.user_metadata?.nome || authUser.user_metadata?.full_name || '';
          const fallbackEmail = authUser.email || '';
          const fallbackTelefone = authUser.user_metadata?.telefone || null;

          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              user_id: userId,
              nome: fallbackNome,
              email: fallbackEmail,
              telefone: fallbackTelefone,
            });

          if (insertError) {
            console.warn('Could not auto-create profile row:', insertError.message);
            return { nome: fallbackNome, email: fallbackEmail, telefone: fallbackTelefone };
          }

          return { nome: fallbackNome, email: fallbackEmail, telefone: fallbackTelefone };
        }
      }

      return data as { nome: string; email: string; telefone: string | null } | null;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (profile) {
      setNome(profile.nome || '');
      setEmail(profile.email || '');
      setTelefone(profile.telefone || '');
      setDirty(false);
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ nome, telefone: telefone || null })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responsavel-profile', userId] });
      toast.success('Dados do responsável atualizados!');
      setDirty(false);
    },
    onError: () => toast.error('Erro ao atualizar dados'),
  });

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!profile) return <p className="text-sm text-muted-foreground text-center py-8">Dados do responsável não encontrados.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/60 border border-border">
        <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">Dados do responsável não são exibidos publicamente</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Nome do Responsável *</label>
          <Input value={nome} onChange={(e) => { setNome(e.target.value); setDirty(true); }} placeholder="Nome completo" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">E-mail</label>
          <Input value={email} disabled className="opacity-60" />
          <p className="text-[10px] text-muted-foreground mt-1">O e-mail não pode ser alterado por aqui.</p>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Celular / WhatsApp</label>
          <Input
            value={telefone}
            onChange={(e) => { setTelefone(formatPhone(e.target.value)); setDirty(true); }}
            placeholder="(11) 99999-9999"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending || !dirty || !nome.trim()}>
          {updateProfile.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Responsável
        </Button>
      </div>
    </div>
  );
}
