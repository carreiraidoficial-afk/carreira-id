import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, UserPlus, Copy, Check, ShieldOff, ShieldCheck, Clock, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMinhasCriancas } from '@/hooks/useCriancaAtiva';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';

interface ColaboradoresTabProps {
  userId: string;
}

interface ColaboradorRow {
  id: string;
  crianca_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  codigo_convite: string;
  status: string;
  user_id: string | null;
}

function gerarCodigoConvite(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function useMeusColaboradores(criancaIds: string[]) {
  return useQuery({
    queryKey: ['meus-colaboradores', criancaIds],
    queryFn: async (): Promise<ColaboradorRow[]> => {
      if (criancaIds.length === 0) return [];
      const { data, error } = await supabase
        .from('perfil_atleta_colaboradores')
        .select('id, crianca_id, nome, email, telefone, codigo_convite, status, user_id')
        .in('crianca_id', criancaIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ColaboradorRow[];
    },
    enabled: criancaIds.length > 0,
  });
}

export function ColaboradoresTab({ userId }: ColaboradoresTabProps) {
  const queryClient = useQueryClient();
  const { data: criancas = [], isLoading: criancasLoading } = useMinhasCriancas(userId);
  const criancaIds = criancas.map((c) => c.crianca_id).filter(Boolean) as string[];
  const { data: colaboradores = [], isLoading: colaboradoresLoading } = useMeusColaboradores(criancaIds);

  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkReenvioCodigo, setLinkReenvioCodigo] = useState<string | null>(null);
  const [reenvioCopied, setReenvioCopied] = useState(false);
  const [excluirCodigo, setExcluirCodigo] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Agrupa as linhas (uma por criança) pelo mesmo código de convite, pra
  // mostrar UMA pessoa com a lista de quais atletas ela tem acesso.
  const grupos = new Map<string, { nome: string; email: string | null; telefone: string | null; status: string; criancaIds: string[]; ids: string[] }>();
  for (const c of colaboradores) {
    const g = grupos.get(c.codigo_convite);
    if (g) {
      g.criancaIds.push(c.crianca_id);
      g.ids.push(c.id);
      if (c.status === 'ativo') g.status = 'ativo';
    } else {
      grupos.set(c.codigo_convite, { nome: c.nome, email: c.email, telefone: c.telefone, status: c.status, criancaIds: [c.crianca_id], ids: [c.id] });
    }
  }

  const nomeCrianca = (criancaId: string) => criancas.find((c) => c.crianca_id === criancaId)?.nome || '—';

  const handleConvidar = async () => {
    if (nome.trim().length < 2) { toast.error('Informe o nome da pessoa'); return; }
    if (!email.trim() && !telefone.trim()) { toast.error('Informe um e-mail ou telefone'); return; }
    if (selecionados.length === 0) { toast.error('Selecione pelo menos um atleta'); return; }

    setSaving(true);
    try {
      const emailNorm = email.trim().toLowerCase();
      const telNorm = telefone.trim().replace(/\D/g, '');
      const codigo = gerarCodigoConvite();

      // Reaproveita a linha existente (mesmo atleta + mesmo email/telefone)
      // em vez de criar uma nova -- evita a lista crescer indefinidamente
      // toda vez que a mesma pessoa e reconvidada apos ser revogada.
      const idsParaAtualizar: string[] = [];
      const linhasParaInserir: any[] = [];
      for (const criancaId of selecionados) {
        const existente = colaboradores.find((c) =>
          c.crianca_id === criancaId &&
          ((emailNorm && c.email?.trim().toLowerCase() === emailNorm) ||
            (telNorm && c.telefone?.replace(/\D/g, '') === telNorm))
        );
        if (existente) {
          idsParaAtualizar.push(existente.id);
        } else {
          linhasParaInserir.push({
            crianca_id: criancaId,
            convidado_por: userId,
            nome: nome.trim(),
            email: email.trim() || null,
            telefone: telefone.trim() || null,
            codigo_convite: codigo,
            status: 'pendente' as const,
          });
        }
      }

      if (idsParaAtualizar.length > 0) {
        const { error } = await supabase
          .from('perfil_atleta_colaboradores')
          .update({
            nome: nome.trim(),
            email: email.trim() || null,
            telefone: telefone.trim() || null,
            codigo_convite: codigo,
            status: 'pendente',
            revogado_em: null,
          } as any)
          .in('id', idsParaAtualizar);
        if (error) throw error;
      }
      if (linhasParaInserir.length > 0) {
        const { error } = await supabase.from('perfil_atleta_colaboradores').insert(linhasParaInserir);
        if (error) throw error;
      }

      const link = `${window.location.origin}${carreiraPath('/colaborar')}?codigo=${codigo}`;
      setLinkGerado(link);
      queryClient.invalidateQueries({ queryKey: ['meus-colaboradores'] });
      toast.success('Convite criado! Envie o link abaixo pra pessoa.');
    } catch (e: any) {
      toast.error('Erro ao criar convite: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!linkGerado) return;
    navigator.clipboard.writeText(linkGerado);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevogar = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from('perfil_atleta_colaboradores')
        .update({ status: 'revogado', revogado_em: new Date().toISOString() } as any)
        .in('id', ids);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['meus-colaboradores'] });
      toast.success('Acesso revogado');
    } catch (e: any) {
      toast.error('Erro ao revogar: ' + e.message);
    }
  };

  const handleReativar = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from('perfil_atleta_colaboradores')
        .update({ status: 'ativo', revogado_em: null } as any)
        .in('id', ids);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['meus-colaboradores'] });
      toast.success('Acesso reativado');
    } catch (e: any) {
      toast.error('Erro ao reativar: ' + e.message);
    }
  };

  const handleReenviar = (codigo: string) => {
    setLinkReenvioCodigo((atual) => (atual === codigo ? null : codigo));
    setReenvioCopied(false);
  };

  const handleCopyReenvio = (codigo: string) => {
    const link = `${window.location.origin}${carreiraPath('/colaborar')}?codigo=${codigo}`;
    navigator.clipboard.writeText(link);
    setReenvioCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setReenvioCopied(false), 2000);
  };

  const handleExcluir = async (ids: string[]) => {
    setExcluindo(true);
    try {
      const { error } = await supabase.from('perfil_atleta_colaboradores').delete().in('id', ids);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['meus-colaboradores'] });
      toast.success('Colaborador excluído');
    } catch (e: any) {
      toast.error('Erro ao excluir: ' + e.message);
    } finally {
      setExcluindo(false);
      setExcluirCodigo(null);
    }
  };

  const resetForm = () => {
    setNome(''); setEmail(''); setTelefone(''); setSelecionados([]); setLinkGerado(null); setShowForm(false);
  };

  if (criancasLoading || colaboradoresLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (criancas.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Cadastre um perfil de atleta primeiro pra poder convidar colaboradores.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Dê acesso a outra pessoa (ex: mãe, pai, o próprio atleta) pra postar e registrar jornada/campeonatos com o login dela — útil quando cada um está numa competição diferente.
      </p>

      {[...grupos.entries()].map(([codigo, g]) => (
        <div key={codigo} className="rounded-lg border p-3 space-y-2 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 max-w-full">
              <p className="text-sm font-semibold truncate">{g.nome}</p>
              <p className="text-xs text-muted-foreground truncate">{g.email || g.telefone || '—'}</p>
            </div>
            <Badge variant={g.status === 'ativo' ? 'default' : g.status === 'pendente' ? 'secondary' : 'outline'}
              className={`shrink-0 ${g.status === 'ativo' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1' : g.status === 'pendente' ? 'gap-1' : 'text-muted-foreground gap-1'}`}>
              {g.status === 'ativo' ? <ShieldCheck className="w-3 h-3" /> : g.status === 'pendente' ? <Clock className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
              {g.status === 'ativo' ? 'Ativo' : g.status === 'pendente' ? 'Convite pendente' : 'Revogado'}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {g.criancaIds.map((cid) => (
              <Badge key={cid} variant="outline" className="text-[10px]">{nomeCrianca(cid)}</Badge>
            ))}
          </div>

          {linkReenvioCodigo === codigo && (
            <div className="flex gap-2 pt-1">
              <Input value={`${window.location.origin}${carreiraPath('/colaborar')}?codigo=${codigo}`} readOnly className="text-xs h-8" />
              <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => handleCopyReenvio(codigo)}>
                {reenvioCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {g.status === 'pendente' && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleReenviar(codigo)}>
                <Send className="w-3 h-3" /> Reenviar convite
              </Button>
            )}
            {g.status === 'revogado' ? (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleReativar(g.ids)}>Reativar acesso</Button>
            ) : (
              <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => handleRevogar(g.ids)}>Revogar acesso</Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setExcluirCodigo(codigo)}>
              <Trash2 className="w-3 h-3" /> Excluir
            </Button>
          </div>
        </div>
      ))}

      <AlertDialog open={!!excluirCodigo} onOpenChange={(open) => !open && setExcluirCodigo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove o acesso e o registro do convite permanentemente. Publicações, jogos e experiências que essa pessoa já criou <strong>não são afetados</strong> — continuam no perfil normalmente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const g = excluirCodigo ? grupos.get(excluirCodigo) : undefined;
                if (g) handleExcluir(g.ids);
              }}
            >
              {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!showForm ? (
        <Button variant="outline" className="w-full gap-1.5" onClick={() => setShowForm(true)}>
          <UserPlus className="w-4 h-4" /> Convidar alguém
        </Button>
      ) : (
        <div className="rounded-lg border p-3 space-y-3">
          {linkGerado ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Convite criado! Envie esse link:</p>
              <div className="flex gap-2">
                <Input value={linkGerado} readOnly className="text-xs" />
                <Button size="icon" variant="outline" onClick={handleCopyLink}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <Button variant="outline" className="w-full" onClick={resetForm}>Fechar</Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Fernanda (mãe)" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone (opcional se já tem e-mail)</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(21) 99999-9999" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dar acesso a qual(is) atleta(s)?</Label>
                {criancas.map((c) => (
                  <label key={c.crianca_id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                    <Checkbox
                      checked={c.crianca_id ? selecionados.includes(c.crianca_id) : false}
                      onCheckedChange={(v) => {
                        if (!c.crianca_id) return;
                        setSelecionados((prev) => v ? [...prev, c.crianca_id!] : prev.filter((id) => id !== c.crianca_id));
                      }}
                    />
                    {c.nome}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={resetForm}>Cancelar</Button>
                <Button className="flex-1" onClick={handleConvidar} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gerar convite'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
