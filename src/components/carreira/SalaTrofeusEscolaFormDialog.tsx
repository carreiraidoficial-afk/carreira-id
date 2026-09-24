import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { ColocacaoTrofeuEscola, TrofeuEscola, TrofeuEscolaInput } from '@/hooks/useSalaTrofeusEscola';

const COLOCACAO_OPTIONS: { value: ColocacaoTrofeuEscola; label: string }[] = [
  { value: 'campeao', label: '🏆 Campeão' },
  { value: 'vice', label: '🥈 Vice-campeão' },
  { value: 'semifinalista', label: '🥉 Semifinalista' },
  { value: 'terceiro', label: '🥉 3º Lugar' },
  { value: 'quartas', label: '🎖️ Quartas de final' },
  { value: 'oitavas', label: '🎖️ Oitavas de final' },
  { value: 'fase_grupos', label: '🎖️ Fase de grupos' },
];

const formSchema = z.object({
  titulo: z.string().min(2, 'Informe o nome do campeonato/torneio'),
  colocacao: z.enum(['campeao', 'vice', 'semifinalista', 'terceiro', 'quartas', 'oitavas', 'fase_grupos']),
  categoria: z.string().optional(),
  organizador: z.string().optional(),
  ano: z.coerce.number().min(1990, 'Ano inválido').max(2100, 'Ano inválido'),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: TrofeuEscola | null;
  onSave: (input: TrofeuEscolaInput, editingId?: string) => Promise<void>;
}

export function SalaTrofeusEscolaFormDialog({ open, onOpenChange, editing, onSave }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { titulo: '', colocacao: 'campeao', categoria: '', organizador: '', ano: new Date().getFullYear() },
  });

  useEffect(() => {
    if (open && editing) {
      form.reset({
        titulo: editing.titulo,
        colocacao: editing.colocacao,
        categoria: editing.categoria || '',
        organizador: editing.organizador || '',
        ano: editing.ano,
      });
    } else if (open) {
      form.reset({ titulo: '', colocacao: 'campeao', categoria: '', organizador: '', ano: new Date().getFullYear() });
    }
  }, [open, editing, form]);

  const saving = form.formState.isSubmitting;

  const onSubmit = async (data: FormData) => {
    try {
      await onSave(
        {
          titulo: data.titulo,
          colocacao: data.colocacao,
          categoria: data.categoria || null,
          organizador: data.organizador || null,
          ano: data.ano,
        },
        editing?.id,
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar troféu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (saving && !v) return; onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Troféu' : 'Novo Troféu'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="titulo" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Campeonato/Torneio *</FormLabel>
                <FormControl><Input placeholder="Ex: Copa Regional de Base" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="colocacao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Colocação *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {COLOCACAO_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="ano" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ano *</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="categoria" render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <FormControl><Input placeholder="Ex: Sub-15" {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="organizador" render={({ field }) => (
              <FormItem>
                <FormLabel>Organizador</FormLabel>
                <FormControl><Input placeholder="Ex: Federação de Futebol do Estado" {...field} /></FormControl>
              </FormItem>
            )} />

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editing ? 'Atualizar' : 'Salvar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
