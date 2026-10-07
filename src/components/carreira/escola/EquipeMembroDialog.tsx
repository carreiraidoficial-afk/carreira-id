import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { compressImage } from '@/lib/image-compressor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Sugestões que preenchem o campo de função -- a pessoa ajusta o texto (ex.: "Técnica de Quadra"). */
export const FUNCOES_EQUIPE = [
  'Coordenador(a) Geral',
  'Diretor(a)',
  'Técnico(a) de Quadra',
  'Técnico(a) de Areia',
  'Professor(a)',
  'Preparador(a) Físico(a)',
  'Analista Técnico',
  'Fisioterapeuta',
];

export interface MembroEmEdicao {
  id: string;
  nome: string;
  foto_url: string | null;
  funcao: string;
  funcao_secundaria?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  escolaPerfilId: string;
  editando?: MembroEmEdicao | null;
}

/** Cadastro manual de um membro da equipe: foto, nome e função (foto obrigatória). */
export function EquipeMembroDialog({ open, onOpenChange, escolaPerfilId, editando }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const inputFoto = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState('');
  const [funcao, setFuncao] = useState('');
  const [funcao2, setFuncao2] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(editando?.nome ?? '');
    setFuncao(editando?.funcao ?? '');
    setFuncao2(editando?.funcao_secundaria ?? '');
    setArquivo(null);
    setPreview(editando?.foto_url ?? null);
  }, [open, editando]);

  const escolherFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('Escolha um arquivo de imagem.');
      return;
    }
    setArquivo(f);
    const leitor = new FileReader();
    leitor.onload = () => setPreview(leitor.result as string);
    leitor.readAsDataURL(f);
  };

  const salvar = async () => {
    const nomeLimpo = nome.trim();
    const funcaoLimpa = funcao.trim();
    if (nomeLimpo.length < 2) return toast.error('Informe o nome da pessoa.');
    if (funcaoLimpa.length < 2) return toast.error('Informe a função (ex.: Técnico(a) de Quadra).');
    const funcao2Limpa = funcao2.trim();
    if (funcao2Limpa && funcao2Limpa.length < 2) return toast.error('O segundo título precisa ter pelo menos 2 letras.');
    if (funcao2Limpa && funcao2Limpa.toLowerCase() === funcaoLimpa.toLowerCase()) return toast.error('Os dois títulos são iguais. Deixe o segundo vazio ou troque.');
    if (!arquivo && !preview) return toast.error('A foto é obrigatória.');
    if (!user?.id) return toast.error('Você precisa estar logado.');

    setSalvando(true);
    try {
      let fotoUrl = editando?.foto_url ?? null;
      if (arquivo) {
        const comprimida = await compressImage(arquivo, { maxWidth: 900, quality: 0.85 });
        const ext = (comprimida.name.split('.').pop() || 'jpg').toLowerCase();
        const caminho = `${user.id}/equipe-${Date.now()}.${ext}`;
        const { error: erroUpload } = await supabase.storage.from('atleta-fotos').upload(caminho, comprimida);
        if (erroUpload) throw erroUpload;
        fotoUrl = supabase.storage.from('atleta-fotos').getPublicUrl(caminho).data.publicUrl;
      }
      if (!fotoUrl) throw new Error('sem foto');

      if (editando) {
        const { data, error } = await supabase
          .from('escola_equipe')
          .update({ nome: nomeLimpo, funcao: funcaoLimpa, funcao_secundaria: funcao2Limpa || null, foto_url: fotoUrl, updated_at: new Date().toISOString() })
          .eq('id', editando.id)
          .select('id');
        if (error || !data || data.length === 0) throw error ?? new Error('nada atualizado');
      } else {
        const { error } = await supabase.from('escola_equipe').insert({
          escola_perfil_id: escolaPerfilId,
          nome: nomeLimpo,
          funcao: funcaoLimpa,
          funcao_secundaria: funcao2Limpa || null,
          foto_url: fotoUrl,
          origem: 'manual',
          status: 'aceita',
        });
        if (error) throw error;
      }
      toast.success(editando ? 'Membro atualizado!' : 'Membro adicionado à equipe!');
      queryClient.invalidateQueries({ queryKey: ['equipe-escola', escolaPerfilId] });
      onOpenChange(false);
    } catch (err) {
      console.error('[EquipeMembroDialog] erro ao salvar:', err);
      toast.error('Não foi possível salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(aberto) => { if (!salvando) onOpenChange(aberto); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar membro da equipe' : 'Adicionar à equipe técnica'}</DialogTitle>
          <DialogDescription>
            Aparece na página da escola. Se você também atua como técnico ou professor, adicione-se aqui como qualquer outro membro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => inputFoto.current?.click()}
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-dashed bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted"
              aria-label="Escolher foto"
            >
              {preview ? (
                <img src={preview} alt="" className="h-full w-full object-cover object-top" />
              ) : (
                <Camera className="h-6 w-6" />
              )}
            </button>
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Foto da pessoa *</p>
              <p>Rosto bem visível, de preferência na vertical. Envie só fotos de quem autorizou.</p>
            </div>
            <input ref={inputFoto} type="file" accept="image/*" className="hidden" onChange={escolherFoto} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="equipe-nome">Nome *</Label>
            <Input id="equipe-nome" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo ou como é conhecido" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="equipe-funcao">Título principal *</Label>
            <Input id="equipe-funcao" value={funcao} maxLength={60} onChange={(e) => setFuncao(e.target.value)} placeholder="Ex.: Técnica de Quadra" />
            <Select value="" onValueChange={setFuncao}>
              <SelectTrigger className="h-9 text-xs" aria-label="Escolher função da lista">
                <SelectValue placeholder="Ou escolha da lista e ajuste o texto" />
              </SelectTrigger>
              <SelectContent>
                {FUNCOES_EQUIPE.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="equipe-funcao-2">Segundo título (opcional)</Label>
            <Input id="equipe-funcao-2" value={funcao2} maxLength={60} onChange={(e) => setFuncao2(e.target.value)} placeholder="Ex.: Professor de Quadra" />
            <Select value="" onValueChange={setFuncao2}>
              <SelectTrigger className="h-9 text-xs" aria-label="Escolher segundo título da lista">
                <SelectValue placeholder="Ou escolha da lista e ajuste o texto" />
              </SelectTrigger>
              <SelectContent>
                {FUNCOES_EQUIPE.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Para quem tem duas funções, como Diretor(a) e Professor(a) de Quadra.</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={salvando} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={salvando} onClick={salvar}>
            {salvando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando…</> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
