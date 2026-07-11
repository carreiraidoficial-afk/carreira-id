import React, { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FileText, Upload, CheckCircle2, AlertCircle, Loader2, Trash2, FileImage, File } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png';

interface Doc {
  id: string;
  tipo_documento: string;
  nome_arquivo: string;
  storage_path: string;
  tamanho_bytes: number;
  mime_type: string;
}

const CONFIGS_CNPJ = [
  { key: 'contrato_social', label: 'Contrato Social', description: 'Contrato social ou requerimento de empresário' },
  { key: 'documento_responsavel_pj', label: 'Documento do responsável (RG/CNH)', description: 'RG ou CNH do responsável legal' },
];
const CONFIGS_CPF = [
  { key: 'documento_foto_pf', label: 'Documento com foto (RG/CNH)', description: 'RG ou CNH do titular' },
];

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function icon(mime: string | undefined) {
  return mime?.startsWith('image/') ? <FileImage className="w-4 h-4" /> : <File className="w-4 h-4" />;
}

export default function DocumentUploadCarreira({ tipoPessoa }: { tipoPessoa: 'cpf' | 'cnpj' }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);
  const configs = tipoPessoa === 'cnpj' ? CONFIGS_CNPJ : CONFIGS_CPF;

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['carreira-documentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('carreira_documentos').select('*');
      if (error) throw error;
      return data as Doc[];
    },
  });

  const uploadMut = useMutation({
    mutationFn: async ({ file, tipo }: { file: File; tipo: string }) => {
      if (!user?.id) throw new Error('Sem sessão');
      if (!ACCEPTED_TYPES.includes(file.type)) throw new Error('Use PDF, JPG ou PNG');
      if (file.size > MAX_FILE_SIZE) throw new Error('Máx. 10MB');
      const ext = file.name.split('.').pop()?.toLowerCase();
      const path = `${user.id}/${tipo}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('carreira-asaas-documentos')
        .upload(path, file);
      if (upErr) throw upErr;
      const existing = docs.find((d) => d.tipo_documento === tipo);
      if (existing) {
        await supabase.storage.from('carreira-asaas-documentos').remove([existing.storage_path]);
        await supabase.from('carreira_documentos').delete().eq('id', existing.id);
      }
      const { error: dbErr } = await supabase.from('carreira_documentos').insert({
        tipo_documento: tipo,
        nome_arquivo: file.name,
        storage_path: path,
        tamanho_bytes: file.size,
        mime_type: file.type,
      });
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      toast.success('Documento enviado');
      qc.invalidateQueries({ queryKey: ['carreira-documentos'] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setUploading(null),
  });

  const delMut = useMutation({
    mutationFn: async (d: Doc) => {
      await supabase.storage.from('carreira-asaas-documentos').remove([d.storage_path]);
      const { error } = await supabase.from('carreira_documentos').delete().eq('id', d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Documento removido');
      qc.invalidateQueries({ queryKey: ['carreira-documentos'] });
    },
  });

  const onSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, tipo: string) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setUploading(tipo);
      uploadMut.mutate({ file: f, tipo });
      e.target.value = '';
    },
    [uploadMut],
  );

  if (isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-medium">Documentos</h3>
      </div>
      <p className="text-sm text-muted-foreground">PDF, JPG ou PNG (máx. 10MB).</p>
      <div className="space-y-3">
        {configs.map((c) => {
          const existing = docs.find((d) => d.tipo_documento === c.key);
          const isUp = uploading === c.key;
          return (
            <div key={c.key} className={cn('border rounded-lg p-4', existing ? 'border-green-600/40 bg-green-950/10' : 'border-dashed border-muted-foreground/30')}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Label className="font-medium">{c.label} <span className="text-xs text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                  {existing && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-green-500">
                      {icon(existing.mime_type)}
                      <span className="truncate max-w-[220px]">{existing.nome_arquivo}</span>
                      <span className="text-muted-foreground">({fmt(existing.tamanho_bytes)})</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {existing ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => delMut.mutate(existing)} disabled={delMut.isPending}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <label className="cursor-pointer">
                        <input type="file" className="hidden" accept={ACCEPTED_EXTENSIONS} onChange={(e) => onSelect(e, c.key)} disabled={isUp} />
                        <Button type="button" variant="outline" size="sm" className="gap-1.5 pointer-events-none" disabled={isUp}>
                          {isUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Substituir
                        </Button>
                      </label>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                      <label className="cursor-pointer">
                        <input type="file" className="hidden" accept={ACCEPTED_EXTENSIONS} onChange={(e) => onSelect(e, c.key)} disabled={isUp} />
                        <Button type="button" size="sm" className="gap-1.5 pointer-events-none" disabled={isUp}>
                          {isUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Enviar
                        </Button>
                      </label>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}