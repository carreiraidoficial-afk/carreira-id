import { useState, useEffect } from 'react';
import { useCidadesPorEstado } from '@/hooks/useCidadesPorEstado';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, X, Eye, Instagram, Palette, Lock, Trash2, UserCircle, Save, CreditCard, ShieldCheck, Fingerprint, Smartphone, Bell, KeyRound, HelpCircle, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PerfilAtleta, useUpdatePerfilAtleta } from '@/hooks/useCarreiraData';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { ProfilePhotoUpload } from './ProfilePhotoUpload';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { AssinaturaCard } from './AssinaturaCard';
import { toast } from 'sonner';

const POSICOES = ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meia', 'Atacante'];
const PES_DOMINANTES = [
  { value: 'direito', label: 'Direito' },
  { value: 'esquerdo', label: 'Esquerdo' },
  { value: 'ambidestro', label: 'Ambidestro' },
];

const formSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  categoria: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  bio: z.string().max(280, 'Máximo de 280 caracteres').optional(),
  instagram_url: z.string().max(200, 'Máximo de 200 caracteres').optional(),
  pe_dominante: z.string().optional(),
  posicao_principal: z.string().optional(),
  posicao_secundaria: z.string().optional(),
  data_nascimento: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

import { MODALIDADES, ESTADOS } from '@/constants/esportes';

function EditCidadeField({ form }: { form: any }) {
  const estado = form.watch('estado');
  const { data: cidades, isLoading } = useCidadesPorEstado(estado);
  return (
    <FormField
      control={form.control}
      name="cidade"
      render={({ field }: any) => (
        <FormItem>
          <FormLabel>Cidade</FormLabel>
          <Select onValueChange={field.onChange} value={field.value} disabled={!estado}>
            <FormControl><SelectTrigger><SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione'} /></SelectTrigger></FormControl>
            <SelectContent>
              {(cidades || []).map((c: string) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
interface EditPerfilDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perfil: PerfilAtleta;
}

export function EditPerfilDialog({ open, onOpenChange, perfil }: EditPerfilDialogProps) {
  const updatePerfil = useUpdatePerfilAtleta();
  const [photoUrl, setPhotoUrl] = useState(perfil.foto_url || '');
  const [bannerUrl, setBannerUrl] = useState(perfil.banner_url || '');
  const [selectedModalidades, setSelectedModalidades] = useState<string[]>([]);
  const [corDestaque, setCorDestaque] = useState(perfil.cor_destaque || '#3b82f6');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { isSupported: pushSupported, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const [dadosPublicos, setDadosPublicos] = useState({
    gols: true, campeonatos: true, amistosos: true, premiacoes: true, conquistas: true,
  });

  const isPlatformProfile = perfil.modalidade === 'Plataforma' || !perfil.crianca_id;

  const { data: hasActiveSchoolLink } = useQuery({
    queryKey: ['has-school-link', perfil.crianca_id],
    queryFn: async () => {
      if (!perfil.crianca_id) return false;
      const { data } = await supabase
        .from('crianca_escolinha')
        .select('id')
        .eq('crianca_id', perfil.crianca_id)
        .eq('ativo', true)
        .limit(1);
      return (data?.length || 0) > 0;
    },
    enabled: !!perfil.crianca_id && open,
  });

  // Fetch crianca data for birth date
  const { data: criancaData } = useQuery({
    queryKey: ['crianca-data', perfil.crianca_id],
    queryFn: async () => {
      if (!perfil.crianca_id) return null;
      const { data } = await supabase
        .from('criancas')
        .select('data_nascimento')
        .eq('id', perfil.crianca_id)
        .maybeSingle();
      return data;
    },
    enabled: !!perfil.crianca_id && open,
  });

  const isCarreiraOnly = !isPlatformProfile && !hasActiveSchoolLink;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: perfil.nome,
      categoria: perfil.categoria || '',
      cidade: perfil.cidade || '',
      estado: perfil.estado || '',
      bio: perfil.bio || '',
      instagram_url: (perfil as any).instagram_url || '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nome: perfil.nome,
        categoria: perfil.categoria || '',
        cidade: perfil.cidade || '',
        estado: perfil.estado || '',
        bio: perfil.bio || '',
        instagram_url: (perfil as any).instagram_url || '',
        pe_dominante: perfil.pe_dominante || '',
        posicao_principal: perfil.posicao_principal || '',
        posicao_secundaria: perfil.posicao_secundaria || '',
        data_nascimento: criancaData?.data_nascimento || '',
      });
      setPhotoUrl(perfil.foto_url || '');
      setBannerUrl(perfil.banner_url || '');
      setCorDestaque(perfil.cor_destaque || '#3b82f6');
      const initialModalidades = perfil.modalidades || [perfil.modalidade];
      setSelectedModalidades(initialModalidades.filter(Boolean));
      const dp = (perfil as any).dados_publicos;
      if (dp) {
        setDadosPublicos({
          gols: dp.gols !== false, campeonatos: dp.campeonatos !== false,
          amistosos: dp.amistosos !== false, premiacoes: dp.premiacoes !== false,
          conquistas: dp.conquistas !== false,
        });
      }
    }
  }, [open, perfil, form, criancaData]);

  const handleModalidadeChange = (modalidade: string, checked: boolean) => {
    if (checked) {
      setSelectedModalidades(prev => [...prev, modalidade]);
    } else {
      setSelectedModalidades(prev => prev.filter(m => m !== modalidade));
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!isPlatformProfile && selectedModalidades.length === 0) return;

    // Update crianca birth date if changed
    if (perfil.crianca_id && data.data_nascimento) {
      await supabase
        .from('criancas')
        .update({ data_nascimento: data.data_nascimento })
        .eq('id', perfil.crianca_id);
    }

    const updateData: any = {
      id: perfil.id,
      nome: data.nome,
      cidade: data.cidade || null,
      estado: data.estado || null,
      bio: data.bio || null,
      foto_url: photoUrl || null,
      banner_url: bannerUrl || null,
      instagram_url: data.instagram_url || null,
      cor_destaque: corDestaque,
      pe_dominante: data.pe_dominante || null,
      posicao_principal: data.posicao_principal || null,
      posicao_secundaria: data.posicao_secundaria || null,
    };

    if (!isPlatformProfile) {
      updateData.modalidade = selectedModalidades[0];
      updateData.modalidades = selectedModalidades;
      updateData.categoria = data.categoria || null;
      updateData.dados_publicos = dadosPublicos;
    }

    await updatePerfil.mutateAsync(updateData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="perfil" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="perfil">Dados do Atleta</TabsTrigger>
            <TabsTrigger value="responsavel" className="flex items-center gap-1.5">
              <UserCircle className="w-3.5 h-3.5" />
              Responsável
            </TabsTrigger>
            <TabsTrigger value="assinatura" className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              Assinatura
            </TabsTrigger>
            <TabsTrigger value="conta" className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Conta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="perfil" className="mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <ProfilePhotoUpload
                  currentPhotoUrl={photoUrl}
                  currentBannerUrl={bannerUrl}
                  onPhotoChange={setPhotoUrl}
                  onBannerChange={setBannerUrl}
                />

                {/* Name */}
                <FormField control={form.control} name="nome" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo *</FormLabel>
                    <FormControl><Input placeholder="Seu nome" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Birth date */}
                {!isPlatformProfile && (
                  <FormField control={form.control} name="data_nascimento" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {/* Modalidades */}
                {!isPlatformProfile && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Modalidades *</label>
                      <p className="text-xs text-muted-foreground mb-2">Selecione todas as modalidades que pratica</p>
                      <div className="grid grid-cols-2 gap-2">
                        {MODALIDADES.map((mod) => (
                          <div key={mod} className="flex items-center space-x-2">
                            <Checkbox
                              id={`mod-${mod}`}
                              checked={selectedModalidades.includes(mod)}
                              onCheckedChange={(checked) => handleModalidadeChange(mod, !!checked)}
                            />
                            <label htmlFor={`mod-${mod}`} className="text-sm cursor-pointer">{mod}</label>
                          </div>
                        ))}
                      </div>
                      {selectedModalidades.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {selectedModalidades.map((mod) => (
                            <Badge key={mod} variant="secondary" className="gap-1">
                              {mod}
                              <button type="button" onClick={() => handleModalidadeChange(mod, false)}><X className="w-3 h-3" /></button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      {selectedModalidades.length === 0 && (
                        <p className="text-sm text-destructive">Selecione pelo menos uma modalidade</p>
                      )}
                    </div>

                    {/* Categoria */}
                    <FormField control={form.control} name="categoria" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <FormControl><Input placeholder="Ex: Sub-11, Profissional, Master" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* Dados Técnicos */}
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="posicao_principal" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Posição principal</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {POSICOES.map((pos) => (<SelectItem key={pos} value={pos}>{pos}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="posicao_secundaria" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Posição secundária</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {POSICOES.map((pos) => (<SelectItem key={pos} value={pos}>{pos}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="pe_dominante" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pé dominante</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {PES_DOMINANTES.map((pe) => (<SelectItem key={pe.value} value={pe.value}>{pe.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </>
                )}

                {/* City and State */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="estado" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select onValueChange={(val) => { field.onChange(val); form.setValue('cidade', ''); }} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {ESTADOS.map((uf) => (<SelectItem key={uf} value={uf}>{uf}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <EditCidadeField form={form} />
                </div>

                {/* Bio */}
                <FormField control={form.control} name="bio" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Conte um pouco sobre você e sua trajetória esportiva" rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Instagram */}
                <FormField control={form.control} name="instagram_url" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5"><Instagram className="w-4 h-4" />Instagram</FormLabel>
                    <FormControl><Input placeholder="@usuario ou link do perfil" {...field} /></FormControl>
                    <p className="text-xs text-muted-foreground">Ex: @joaoatleta ou https://instagram.com/joaoatleta</p>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Cor de Destaque */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5"><Palette className="w-4 h-4" />Cor de destaque</label>
                  <p className="text-xs text-muted-foreground">Escolha a cor que personaliza o perfil público do atleta</p>
                  <div className="flex flex-wrap gap-2">
                    {['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6','#000000'].map((cor) => (
                      <button
                        key={cor} type="button" onClick={() => setCorDestaque(cor)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${corDestaque === cor ? 'border-foreground scale-110 ring-2 ring-offset-2 ring-offset-background' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: cor }}
                      />
                    ))}
                  </div>
                </div>

                {/* Dados Públicos */}
                {!isPlatformProfile && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-primary" />
                        <label className="text-sm font-medium">Dados visíveis no perfil público</label>
                      </div>
                      <p className="text-xs text-muted-foreground">Escolha quais informações da jornada esportiva serão exibidas na página pública do atleta.</p>
                      {isCarreiraOnly && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/60 border border-border">
                          <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                          <p className="text-xs text-muted-foreground">Recurso disponível ao vincular-se a uma escolinha no Atleta ID</p>
                        </div>
                      )}
                      {([
                        { key: 'gols' as const, label: 'Gols marcados' },
                        { key: 'amistosos' as const, label: 'Amistosos disputados' },
                        { key: 'campeonatos' as const, label: 'Campeonatos' },
                        { key: 'premiacoes' as const, label: 'Premiações individuais' },
                        { key: 'conquistas' as const, label: 'Conquistas coletivas' },
                      ]).map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className={`text-sm ${isCarreiraOnly ? 'text-muted-foreground' : ''}`}>{label}</span>
                          <Switch
                            checked={isCarreiraOnly ? false : dadosPublicos[key]}
                            disabled={isCarreiraOnly}
                            onCheckedChange={(checked) => setDadosPublicos((prev) => ({ ...prev, [key]: checked }))}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Buttons */}
                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  <Button type="submit" disabled={updatePerfil.isPending || (!isPlatformProfile && selectedModalidades.length === 0)}>
                    {updatePerfil.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>) : 'Salvar Alterações'}
                  </Button>
                </div>

                <Separator className="my-4" />
                <div className="pt-2">
                  <Button type="button" variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className="w-4 h-4 mr-2" />Apagar minha conta
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="responsavel" className="mt-4">
            <ResponsavelTab userId={perfil.user_id} criancaId={perfil.crianca_id || undefined} />
          </TabsContent>

          <TabsContent value="assinatura" className="mt-4">
            {perfil.crianca_id ? (
              <AssinaturaCard userId={perfil.user_id} criancaId={perfil.crianca_id} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Assinatura disponível apenas para perfis de atleta.</p>
            )}
          </TabsContent>

          <TabsContent value="conta" className="mt-4 space-y-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Autenticação</p>
              <div className="space-y-2">
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
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Notificações</p>
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
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Senha</p>
              <button type="button" className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Alterar senha</p>
                    <p className="text-xs text-muted-foreground">Defina uma nova senha de acesso</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Suporte</p>
              <button type="button" className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Central de Ajuda</p>
                    <p className="text-xs text-muted-foreground">Tire suas dúvidas com nosso suporte</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </TabsContent>
        </Tabs>

        <DeleteAccountDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          perfilId={perfil.id}
          perfilTable="perfil_atleta"
        />
      </DialogContent>
    </Dialog>
  );
}

/* --- Responsável Tab inside EditPerfilDialog --- */
function ResponsavelTab({ userId, criancaId }: { userId: string; criancaId?: string }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dirty, setDirty] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['responsavel-profile', userId],
    queryFn: async () => {
      // Try to fetch existing profile row
      const { data, error } = await supabase
        .from('profiles')
        .select('nome, email, telefone')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;

      // If no profiles row exists, create one from auth user metadata
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
            // Return fallback data even if insert fails
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

      {/* Assinatura movida para aba própria */}
    </div>
  );
}
