import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImagePlus, Loader2, X } from 'lucide-react';
import type { ColocacaoTrofeuEscola, TrofeuEscola, TrofeuEscolaInput } from '@/hooks/useSalaTrofeusEscola';
import { MAX_FOTOS_POR_TROFEU, type TrofeuFoto } from '@/lib/fotos-trofeu';

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
  /** Fotos novas (ainda não enviadas) e fotos já salvas que a pessoa tirou da conquista. */
  onSave: (input: TrofeuEscolaInput, editingId: string | undefined, fotos: { novas: File[]; removidas: TrofeuFoto[] }) => Promise<void>;
  /** Em Modo Suporte o admin adiciona fotos mas não apaga as que já existem. */
  podeRemoverFotos?: boolean;
}

export function SalaTrofeusEscolaFormDialog({ open, onOpenChange, editing, onSave, podeRemoverFotos = true }: Props) {
  const [novas, setNovas] = useState<{ file: File; preview: string }[]>([]);
  const [removidas, setRemovidas] = useState<TrofeuFoto[]>([]);
  const inputFotos = useRef<HTMLInputElement>(null);
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { titulo: '', colocacao: 'campeao', categoria: '', organizador: '', ano: new Date().getFullYear() },
  });

  useEffect(() => {
    // Ao abrir ou fechar, limpa as fotos escolhidas e libera as prévias da memória.
    setNovas((atuais) => { atuais.forEach((n) => URL.revokeObjectURL(n.preview)); return []; });
    setRemovidas([]);
  }, [open, editing]);

  const fotosSalvas = (editing?.fotos || []).filter((f) => !removidas.some((r) => r.id === f.id));
  const totalFotos = fotosSalvas.length + novas.length;

  const escolherFotos = (lista: FileList | null) => {
    if (!lista) return;
    const vagas = MAX_FOTOS_POR_TROFEU - totalFotos;
    const escolhidas = Array.from(lista).filter((f) => f.type.startsWith('image/'));
    if (escolhidas.length > vagas) toast.error(`Cada conquista aceita até ${MAX_FOTOS_POR_TROFEU} fotos.`);
    const aceitas = escolhidas.slice(0, Math.max(0, vagas));
    if (aceitas.length) setNovas((atuais) => [...atuais, ...aceitas.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    if (inputFotos.current) inputFotos.current.value = '';
  };

  const tirarNova = (indice: number) => setNovas((atuais) => {
    URL.revokeObjectURL(atuais[indice].preview);
    return atuais.filter((_, i) => i !== indice);
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
        { novas: novas.map((n) => n.file), removidas },
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Fotos da conquista</FormLabel>
                <span className="text-xs text-muted-foreground">{totalFotos}/{MAX_FOTOS_POR_TROFEU}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {fotosSalvas.map((f) => (
                  <div key={f.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                    <img src={f.thumb_url} alt="" className="h-full w-full object-cover" />
                    {podeRemoverFotos && (
                      <button
                        type="button"
                        onClick={() => setRemovidas((atuais) => [...atuais, f])}
                        aria-label="Remover foto"
                        disabled={saving}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {novas.map((n, i) => (
                  <div key={n.preview} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                    <img src={n.preview} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => tirarNova(i)}
                      aria-label="Tirar foto"
                      disabled={saving}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {totalFotos < MAX_FOTOS_POR_TROFEU && (
                  <button
                    type="button"
                    onClick={() => inputFotos.current?.click()}
                    disabled={saving}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted/50"
                  >
                    <ImagePlus className="h-5 w-5" />
                    Adicionar
                  </button>
                )}
              </div>
              <input ref={inputFotos} type="file" accept="image/*" multiple className="hidden" onChange={(e) => escolherFotos(e.target.files)} />
              <p className="text-xs text-muted-foreground">As fotos são reduzidas automaticamente antes de enviar.</p>
            </div>

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
