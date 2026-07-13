import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, X, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useJornada } from '@/hooks/useJornada';
import type { CampeonatoComJogos, JogoComMidia, PosicaoJogo } from '@/types/jornada-esportiva';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criancaId: string;
  campeonatos: CampeonatoComJogos[];
  editingJogo?: JogoComMidia | null;
  onSaved?: () => Promise<void> | void;
}

const NONE = '__none__';
const MAX_IMG = 15 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;
const POSICAO_NONE = '__none__';
const POSICOES: { value: PosicaoJogo; label: string }[] = [
  { value: 'goleiro', label: 'Goleiro' },
  { value: 'zagueiro', label: 'Zagueiro' },
  { value: 'lateral-direito', label: 'Lateral Direito' },
  { value: 'lateral-esquerdo', label: 'Lateral Esquerdo' },
  { value: 'volante', label: 'Volante' },
  { value: 'meia', label: 'Meia' },
  { value: 'meia-atacante', label: 'Meia-Atacante' },
  { value: 'ala', label: 'Ala' },
  { value: 'ponta', label: 'Ponta' },
  { value: 'atacante', label: 'Atacante' },
];

export function JornadaJogoFormDialog({ open, onOpenChange, criancaId, campeonatos, editingJogo, onSaved }: Props) {
  const { criarJogo, editarJogo, adicionarMidiasJogo, excluirMidia } = useJornada(criancaId);
  const [saving, setSaving] = useState(false);
  const [campeonatoId, setCampeonatoId] = useState<string>(NONE);
  const [dataJogo, setDataJogo] = useState('');
  const [timeAtleta, setTimeAtleta] = useState('');
  const [adversario, setAdversario] = useState('');
  const [local, setLocal] = useState('');
  const [placarA, setPlacarA] = useState('');
  const [placarB, setPlacarB] = useState('');
  const [gols, setGols] = useState('');
  const [assist, setAssist] = useState('');
  const [fase, setFase] = useState('');
  const [obs, setObs] = useState('');
  const [posicao, setPosicao] = useState<string>(POSICAO_NONE);
  // Goleiro
  const [minutos, setMinutos] = useState('');
  const [golsSofridos, setGolsSofridos] = useState('');
  const [defesas, setDefesas] = useState('');
  const [penDef, setPenDef] = useState('');
  const [teveDisputa, setTeveDisputa] = useState(false);
  const [placarPenA, setPlacarPenA] = useState('');
  const [placarPenB, setPlacarPenB] = useState('');
  const [penDefDisputa, setPenDefDisputa] = useState('');
  const [penLadoCerto, setPenLadoCerto] = useState('');
  const [penLadoErrado, setPenLadoErrado] = useState('');
  const [novosArquivos, setNovosArquivos] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setCampeonatoId(editingJogo?.campeonato_id || NONE);
      setDataJogo(editingJogo?.data_jogo?.slice(0, 10) || '');
      setTimeAtleta(editingJogo?.time_atleta || '');
      setAdversario(editingJogo?.time_adversario || '');
      setLocal(editingJogo?.local || '');
      setPlacarA(editingJogo?.placar_time_atleta?.toString() ?? '');
      setPlacarB(editingJogo?.placar_adversario?.toString() ?? '');
      setGols(editingJogo?.gols_marcados?.toString() ?? '');
      setAssist(editingJogo?.assistencias?.toString() ?? '');
      setFase(editingJogo?.fase_campeonato || '');
      setObs(editingJogo?.observacoes || '');
      setPosicao(editingJogo?.posicao_jogo || POSICAO_NONE);
      setMinutos(editingJogo?.minutos_jogados?.toString() ?? '');
      setGolsSofridos(editingJogo?.gols_sofridos?.toString() ?? '');
      setDefesas(editingJogo?.defesas_importantes?.toString() ?? '');
      setPenDef(editingJogo?.penaltis_defendidos?.toString() ?? '');
      setTeveDisputa(!!editingJogo?.teve_disputa_penaltis);
      setPlacarPenA(editingJogo?.placar_penaltis_time?.toString() ?? '');
      setPlacarPenB(editingJogo?.placar_penaltis_adversario?.toString() ?? '');
      setPenDefDisputa(editingJogo?.penaltis_defendidos_disputa?.toString() ?? '');
      setPenLadoCerto(editingJogo?.penaltis_gol_lado_correto?.toString() ?? '');
      setPenLadoErrado(editingJogo?.penaltis_gol_lado_errado?.toString() ?? '');
      setNovosArquivos([]);
    }
  }, [open, editingJogo]);

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const ok: File[] = [];
    for (const f of Array.from(files)) {
      const name = f.name.toLowerCase();
      const isImg = f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif)$/i.test(name);
      const isVid = f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(name);
      if (!isImg && !isVid) { toast.error(`${f.name}: formato não suportado`); continue; }
      if (isImg && f.size > MAX_IMG) { toast.error(`${f.name}: imagem > 15MB`); continue; }
      if (isVid && f.size > MAX_VIDEO) { toast.error(`${f.name}: vídeo > 100MB`); continue; }

      // Convert HEIC/HEIF to JPEG so todos navegadores conseguem exibir a miniatura
      const isHeic = f.type === 'image/heic' || f.type === 'image/heif' || /\.(heic|heif)$/i.test(name);
      if (isHeic) {
        try {
          const heic2any = (await import('heic2any')).default;
          const blobResult = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.85 });
          const blob = Array.isArray(blobResult) ? blobResult[0] : blobResult;
          const newName = f.name.replace(/\.(heic|heif)$/i, '.jpg');
          ok.push(new File([blob], newName, { type: 'image/jpeg' }));
          continue;
        } catch (err) {
          console.error('Erro ao converter HEIC:', err);
          toast.error(`${f.name}: não foi possível converter o HEIC`);
          continue;
        }
      }
      ok.push(f);
    }
    setNovosArquivos((prev) => [...prev, ...ok]);
  };

  const removeNovo = (idx: number) => {
    setNovosArquivos((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeMidiaExistente = async (id: string) => {
    if (!confirm('Remover esta mídia?')) return;
    try {
      await excluirMidia(id);
      await onSaved?.();
      toast.success('Mídia removida');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao remover');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataJogo) { toast.error('Informe a data do jogo'); return; }
    if (!adversario.trim()) { toast.error('Informe o time adversário'); return; }
    setSaving(true);
    try {
      const isGoleiro = posicao === 'goleiro';
      const payload = {
        campeonato_id: campeonatoId === NONE ? null : campeonatoId,
        data_jogo: dataJogo,
        time_atleta: timeAtleta.trim() || null,
        time_adversario: adversario.trim(),
        local: local.trim() || undefined,
        placar_time_atleta: num(placarA),
        placar_adversario: num(placarB),
        gols_marcados: isGoleiro ? undefined : num(gols),
        assistencias: isGoleiro ? undefined : num(assist),
        posicao_jogo: posicao === POSICAO_NONE ? undefined : (posicao as PosicaoJogo),
        fase_campeonato: fase.trim() || undefined,
        observacoes: obs.trim() || undefined,
        // Goleiro
        minutos_jogados: isGoleiro ? (num(minutos) ?? null) : null,
        gols_sofridos: isGoleiro ? (num(golsSofridos) ?? null) : null,
        defesas_importantes: isGoleiro ? (num(defesas) ?? null) : null,
        penaltis_defendidos: isGoleiro ? (num(penDef) ?? null) : null,
        teve_disputa_penaltis: isGoleiro ? teveDisputa : null,
        placar_penaltis_time: isGoleiro && teveDisputa ? (num(placarPenA) ?? null) : null,
        placar_penaltis_adversario: isGoleiro && teveDisputa ? (num(placarPenB) ?? null) : null,
        penaltis_defendidos_disputa: isGoleiro && teveDisputa ? (num(penDefDisputa) ?? null) : null,
        penaltis_gol_lado_correto: isGoleiro && teveDisputa ? (num(penLadoCerto) ?? null) : null,
        penaltis_gol_lado_errado: isGoleiro && teveDisputa ? (num(penLadoErrado) ?? null) : null,
      };
      let jogoId: string;
      if (editingJogo) {
        await editarJogo(editingJogo.id, payload);
        jogoId = editingJogo.id;
      } else {
        jogoId = await criarJogo(payload);
      }
      if (novosArquivos.length > 0) {
        await adicionarMidiasJogo(jogoId, novosArquivos);
      }
      await onSaved?.();
      toast.success('Jogo salvo');
      onOpenChange(false);
    } catch (err: any) {
      console.error('[JogoForm] erro', err);
      toast.error(err.message || 'Erro ao salvar jogo');
    } finally {
      setSaving(false);
    }
  };

  const midiasExistentes = editingJogo?.midias || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingJogo ? 'Editar Jogo' : 'Novo Jogo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Campeonato (opcional)</Label>
            <Select value={campeonatoId} onValueChange={setCampeonatoId}>
              <SelectTrigger><SelectValue placeholder="Amistoso" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Amistoso (sem campeonato)</SelectItem>
                {campeonatos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Meu time</Label>
              <Input value={timeAtleta} onChange={(e) => setTimeAtleta(e.target.value)} placeholder="Ex: Serra Macaense" />
            </div>
            <div>
              <Label>Adversário *</Label>
              <Input value={adversario} onChange={(e) => setAdversario(e.target.value)} placeholder="Ex: Bonsucesso" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Placar (meu time)</Label>
              <Input type="number" min={0} value={placarA} onChange={(e) => setPlacarA(e.target.value)} />
            </div>
            <div>
              <Label>Placar (adversário)</Label>
              <Input type="number" min={0} value={placarB} onChange={(e) => setPlacarB(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data *</Label>
              <Input type="date" value={dataJogo} onChange={(e) => setDataJogo(e.target.value)} />
            </div>
            <div>
              <Label>Local</Label>
              <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex: Estádio Municipal" />
            </div>
          </div>
          <div>
            <Label>Posição neste jogo</Label>
            <Select value={posicao} onValueChange={setPosicao}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={POSICAO_NONE}>Não informar</SelectItem>
                {POSICOES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {posicao !== 'goleiro' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gols do atleta</Label>
                <Input type="number" min={0} value={gols} onChange={(e) => setGols(e.target.value)} />
              </div>
              <div>
                <Label>Assistências do atleta</Label>
                <Input type="number" min={0} value={assist} onChange={(e) => setAssist(e.target.value)} />
              </div>
            </div>
          )}
          {posicao === 'goleiro' && (
            <div className="rounded-lg border-2 p-3 space-y-3" style={{ borderColor: 'hsl(var(--border))' }}>
              <p className="text-sm font-semibold">🧤 Estatísticas de Goleiro</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Minutos jogados</Label>
                  <Input type="number" min={0} value={minutos} onChange={(e) => setMinutos(e.target.value)} />
                </div>
                <div>
                  <Label>Gols sofridos</Label>
                  <Input type="number" min={0} value={golsSofridos} onChange={(e) => setGolsSofridos(e.target.value)} />
                </div>
                <div>
                  <Label>Defesas importantes</Label>
                  <Input type="number" min={0} value={defesas} onChange={(e) => setDefesas(e.target.value)} />
                </div>
                <div>
                  <Label>Pênaltis defendidos (tempo normal)</Label>
                  <Input type="number" min={0} value={penDef} onChange={(e) => setPenDef(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch checked={teveDisputa} onCheckedChange={setTeveDisputa} id="teve-disputa" />
                <Label htmlFor="teve-disputa" className="cursor-pointer">Houve disputa de pênaltis?</Label>
              </div>
              {teveDisputa && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Placar pên. (meu time)</Label>
                    <Input type="number" min={0} value={placarPenA} onChange={(e) => setPlacarPenA(e.target.value)} />
                  </div>
                  <div>
                    <Label>Placar pên. (adversário)</Label>
                    <Input type="number" min={0} value={placarPenB} onChange={(e) => setPlacarPenB(e.target.value)} />
                  </div>
                  <div>
                    <Label>Pên. defendidos na disputa</Label>
                    <Input type="number" min={0} value={penDefDisputa} onChange={(e) => setPenDefDisputa(e.target.value)} />
                  </div>
                  <div>
                    <Label>Gol lado correto (leu certo)</Label>
                    <Input type="number" min={0} value={penLadoCerto} onChange={(e) => setPenLadoCerto(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label>Gol lado errado (leu errado)</Label>
                    <Input type="number" min={0} value={penLadoErrado} onChange={(e) => setPenLadoErrado(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}
          <div>
            <Label>Fase</Label>
            <Input value={fase} onChange={(e) => setFase(e.target.value)} placeholder="Ex: Final" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>

          {/* Mídias */}
          <div>
            <Label>Fotos e vídeos</Label>
            <div className="mt-1 space-y-2">
              {midiasExistentes.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {midiasExistentes.map((m) => (
                    <div key={m.id} className="relative aspect-square rounded-md overflow-hidden bg-muted group">
                      {m.tipo_midia === 'video' ? (
                        <video src={m.url_midia} className="w-full h-full object-cover" />
                      ) : (
                        <img src={m.url_midia} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMidiaExistente(m.id)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {novosArquivos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {novosArquivos.map((f, i) => {
                    const name = f.name.toLowerCase();
                    const isVid = f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(name);
                    const browserPreviewable =
                      f.type.startsWith('image/') &&
                      !/\.(heic|heif|tif|tiff)$/i.test(name) &&
                      f.type !== 'image/heic' && f.type !== 'image/heif' &&
                      f.type !== 'image/tiff';
                    return (
                      <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-muted border-2 border-dashed border-primary/40">
                        {isVid ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-xs gap-1 p-1 text-center">
                            <Video className="w-5 h-5" />
                            <span className="truncate max-w-full">{f.name}</span>
                          </div>
                        ) : browserPreviewable ? (
                          <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground p-1 text-center">
                            Pré-visualização indisponível<br />({f.name.split('.').pop()?.toUpperCase()})
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeNovo(i)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1" /> Adicionar fotos/vídeos
              </Button>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/bmp,image/tiff,image/heic,image/heif,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.tif,.tiff,.heic,.heif,video/*,.mp4,.mov,.webm,.m4v,.avi,.mkv"
                multiple
                onChange={(e) => { handleFiles(e.target.files); if (fileRef.current) fileRef.current.value = ''; }}
              />
              <p className="text-[11px] text-muted-foreground">JPG, PNG, GIF, WEBP, HEIC, TIF e vídeos. Imagens até 15MB, vídeos até 100MB.</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
