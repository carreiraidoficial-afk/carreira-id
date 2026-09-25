import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Save } from 'lucide-react';
import { toast } from 'sonner';

interface LembreteTemplate {
  id: string;
  numero_lembrete: number;
  dias_apos_cadastro: number;
  ativo: boolean;
  assunto: string;
  titulo: string;
  corpo: string;
  cta_texto: string;
}

function useLembretesTemplates() {
  return useQuery({
    queryKey: ['carreira-admin-lembretes-perfil-templates'],
    queryFn: async (): Promise<LembreteTemplate[]> => {
      const { data, error } = await (supabase as any)
        .from('carreira_lembretes_perfil_templates')
        .select('*')
        .order('numero_lembrete', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

function useSalvarTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: LembreteTemplate) => {
      const { error } = await (supabase as any)
        .from('carreira_lembretes_perfil_templates')
        .update({
          dias_apos_cadastro: t.dias_apos_cadastro,
          ativo: t.ativo,
          assunto: t.assunto,
          titulo: t.titulo,
          corpo: t.corpo,
          cta_texto: t.cta_texto,
          updated_at: new Date().toISOString(),
        })
        .eq('id', t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carreira-admin-lembretes-perfil-templates'] });
      toast.success('Lembrete atualizado');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

function TemplateCard({ template }: { template: LembreteTemplate }) {
  const [form, setForm] = useState(template);
  const salvar = useSalvarTemplate();

  useEffect(() => { setForm(template); }, [template]);

  const alterado = JSON.stringify(form) !== JSON.stringify(template);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          Lembrete {form.numero_lembrete}
          <Badge variant="outline" className="text-xs font-normal">{form.dias_apos_cadastro} dia(s) após o cadastro</Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor={`ativo-${form.id}`} className="text-xs text-muted-foreground cursor-pointer">Ativo</Label>
          <Switch id={`ativo-${form.id}`} checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Dias após o cadastro</Label>
            <Input type="number" min={0} value={form.dias_apos_cadastro} onChange={(e) => setForm({ ...form, dias_apos_cadastro: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Texto do botão</Label>
            <Input value={form.cta_texto} onChange={(e) => setForm({ ...form, cta_texto: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Assunto do email</Label>
          <Input value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} />
        </div>
        <div>
          <Label>Título (dentro do email)</Label>
          <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        </div>
        <div>
          <Label>Corpo</Label>
          <Textarea rows={4} value={form.corpo} onChange={(e) => setForm({ ...form, corpo: e.target.value })} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" disabled={!alterado || salvar.isPending} onClick={() => salvar.mutate(form)}>
            {salvar.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CarreiraAdminLembretesPerfilPage() {
  const { data: templates, isLoading } = useLembretesTemplates();

  return (
    <CarreiraAdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Lembretes de Cadastro</h1>
          <p className="text-muted-foreground text-sm">
            Sequência automática de 3 emails pra quem criou conta mas não completou nenhum perfil ainda
            (ver aba "Perfil Incompleto" em Perfis). Roda 1x por dia; cada pessoa recebe no máximo um
            lembrete novo por execução, na ordem 1 → 2 → 3.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {(templates || []).map((t) => <TemplateCard key={t.id} template={t} />)}
          </div>
        )}
      </div>
    </CarreiraAdminLayout>
  );
}
