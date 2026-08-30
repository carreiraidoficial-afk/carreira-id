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
import type { CampeonatoComJogos, JogoComMidia, PosicaoJogo, SetDetalhe, QuartoDetalhe } from '@/types/jornada-esportiva';
import { isModalidadeVolei, isModalidadeBasquete } from '@/constants/esportes';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criancaId: string;
  campeonatos: CampeonatoComJogos[];
  modalidades: string[];
  editingJogo?: JogoComMidia | null;
  onSaved?: () => Promise<void> | void;
}

const NONE = '__none__';
const MAX_IMG = 15 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;
const POSICAO_NONE = '__none__';
const POSICOES_FUTEBOL_JOGO: { value: PosicaoJogo; label: string }[] = [
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
const POSICOES_VOLEI_JOGO: { value: PosicaoJogo; label: string }[] = [
  { value: 'levantador', label: 'Levantador' },
  { value: 'oposto', label: 'Oposto' },
  { value: 'ponteiro', label: 'Ponteiro' },
  { value: 'central', label: 'Central' },
  { value: 'libero', label: 'Líbero' },
];
const POSICOES_BASQUETE_JOGO: { value: PosicaoJogo; label: string }[] = [
  { value: 'armador', label: 'Armador' },
  { value: 'ala-armador', label: 'Ala-Armador' },
  { value: 'ala', label: 'Ala' },
  { value: 'ala-pivo', label: 'Ala-Pivô' },
  { value: 'pivo', label: 'Pivô' },
];
const MAX_SETS = 5;
const emptySets = (): { pontos_time: string; pontos_adversario: string }[] =>
  Array.from({ length: MAX_SETS }, () => ({ pontos_time: '', pontos_adversario: '' }));
const MAX_QUARTOS = 4;
const emptyQuartos = (): { pontos_time: string; pontos_adversario: string }[] =>
  Array.from({ length: MAX_QUARTOS }, () => ({ pontos_time: '', pontos_adversario: '' }));

export function JornadaJogoFormDialog({ open, onOpenChange, criancaId, campeonatos, modalidades, editingJogo, onSaved }: Props) {
  const { criarJogo, editarJogo, adicionarMidiasJogo, excluirMidia } = useJornada(criancaId);
  const [saving, setSaving] = useState(false);
  const [campeonatoId, setCampeonatoId] = useState<string>(NONE);
  const [modalidade, setModalidade] = useState<string>(modalidades[0] || 'Futebol');
  const [dataJogo, setDataJogo] = useState('');
  const [timeAtleta, setTimeAtleta] = useState('');
  const [adversario, setAdversario] = useState('');
  const [local, setLocal] = useState('');
  const [placarA, setPlacarA] = useState('');
  const [placarB, setPlacarB] = useState('');
  const [gols, setGols] = useState('');
  const [assist, setAssist] = useState('');
  const [golsPenalti, setGolsPenalti] = useState('');
  const [fase, setFase] = useState('');
  const [obs, setObs] = useState('');
  const [posicao, setPosicao] = useState<string>(POSICAO_NONE);
  // Prorrogação e disputa de pênaltis -- fatos do jogo, não dependem da posição
  const [teveProrrogacao, setTeveProrrogacao] = useState(false);
  const [teveDisputa, setTeveDisputa] = useState(false);
  const [placarPenA, setPlacarPenA] = useState('');
  const [placarPenB, setPlacarPenB] = useState('');
  const [penConvertidosDisputa, setPenConvertidosDisputa] = useState('');
  // Goleiro
  const [minutos, setMinutos] = useState('');
  const [golsSofridos, setGolsSofridos] = useState('');
  const [defesas, setDefesas] = useState('');
  const [penDef, setPenDef] = useState('');
  const [penDefDisputa, setPenDefDisputa] = useState('');
  const [penLadoCerto, setPenLadoCerto] = useState('');
  const [penLadoErrado, setPenLadoErrado] = useState('');
  // Vôlei -- bloco geral
  const [pontosAtaque, setPontosAtaque] = useState('');
  const [pontosBloqueio, setPontosBloqueio] = useState('');
  const [pontosSaque, setPontosSaque] = useState('');
  const [errosCometidos, setErrosCometidos] = useState('');
  // Vôlei -- bloco líbero
  const [recepcoes, setRecepcoes] = useState('');
  const [defesasVolei, setDefesasVolei] = useState('');
  const [errosRecepcao, setErrosRecepcao] = useState('');
  // Vôlei -- placar detalhado por set
  const [setsAtivo, setSetsAtivo] = useState(false);
  const [sets, setSets] = useState(emptySets());
  // Basquete
  const [pontosBasquete, setPontosBasquete] = useState('');
  const [rebotesOfensivos, setRebotesOfensivos] = useState('');
  const [rebotesDefensivos, setRebotesDefensivos] = useState('');
  const [roubosBola, setRoubosBola] = useState('');
  const [tocos, setTocos] = useState('');
  const [faltasCometidas, setFaltasCometidas] = useState('');
  const [arremessos2ptTentados, setArremessos2ptTentados] = useState('');
  const [arremessos2ptConvertidos, setArremessos2ptConvertidos] = useState('');
  const [arremessos3ptTentados, setArremessos3ptTentados] = useState('');
  const [arremessos3ptConvertidos, setArremessos3ptConvertidos] = useState('');
  const [lancesLivresTentados, setLancesLivresTentados] = useState('');
  const [lancesLivresConvertidos, setLancesLivresConvertidos] = useState('');
  // Basquete -- placar detalhado por quarto
  const [quartosAtivo, setQuartosAtivo] = useState(false);
  const [quartos, setQuartos] = useState(emptyQuartos());
  const [novosArquivos, setNovosArquivos] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isVolei = isModalidadeVolei(modalidade);
  const isBasquete = isModalidadeBasquete(modalidade);
  const posicoesDisponiveis = isVolei ? POSICOES_VOLEI_JOGO : isBasquete ? POSICOES_BASQUETE_JOGO : POSICOES_FUTEBOL_JOGO;
  const isLibero = isVolei && posicao === 'libero';
  const isGoleiro = !isVolei && !isBasquete && posicao === 'goleiro';

  useEffect(() => {
    if (open) {
      setCampeonatoId(editingJogo?.campeonato_id || NONE);
      setModalidade(editingJogo?.modalidade || modalidades[0] || 'Futebol');
      setPontosAtaque(editingJogo?.pontos_ataque?.toString() ?? '');
      setPontosBloqueio(editingJogo?.pontos_bloqueio?.toString() ?? '');
      setPontosSaque(editingJogo?.pontos_saque?.toString() ?? '');
      setErrosCometidos(editingJogo?.erros_cometidos?.toString() ?? '');
      setRecepcoes(editingJogo?.recepcoes_realizadas?.toString() ?? '');
      setDefesasVolei(editingJogo?.defesas_realizadas?.toString() ?? '');
      setErrosRecepcao(editingJogo?.erros_recepcao?.toString() ?? '');
      const existingSets = editingJogo?.sets_detalhe;
      if (existingSets && existingSets.length > 0) {
        setSetsAtivo(true);
        const filled = emptySets();
        existingSets.forEach((s) => {
          if (s.set >= 1 && s.set <= MAX_SETS) {
            filled[s.set - 1] = { pontos_time: s.pontos_time.toString(), pontos_adversario: s.pontos_adversario.toString() };
          }
        });
        setSets(filled);
      } else {
        setSetsAtivo(false);
        setSets(emptySets());
      }
      setPontosBasquete(editingJogo?.pontos?.toString() ?? '');
      setRebotesOfensivos(editingJogo?.rebotes_ofensivos?.toString() ?? '');
      setRebotesDefensivos(editingJogo?.rebotes_defensivos?.toString() ?? '');
      setRoubosBola(editingJogo?.roubos_bola?.toString() ?? '');
      setTocos(editingJogo?.tocos?.toString() ?? '');
      setFaltasCometidas(editingJogo?.faltas_cometidas?.toString() ?? '');
      setArremessos2ptTentados(editingJogo?.arremessos_2pt_tentados?.toString() ?? '');
      setArremessos2ptConvertidos(editingJogo?.arremessos_2pt_convertidos?.toString() ?? '');
      setArremessos3ptTentados(editingJogo?.arremessos_3pt_tentados?.toString() ?? '');
      setArremessos3ptConvertidos(editingJogo?.arremessos_3pt_convertidos?.toString() ?? '');
      setLancesLivresTentados(editingJogo?.lances_livres_tentados?.toString() ?? '');
      setLancesLivresConvertidos(editingJogo?.lances_livres_convertidos?.toString() ?? '');
      const existingQuartos = editingJogo?.quartos_detalhe;
      if (existingQuartos && existingQuartos.length > 0) {
        setQuartosAtivo(true);
        const filled = emptyQuartos();
        existingQuartos.forEach((q) => {
          if (q.quarto >= 1 && q.quarto <= MAX_QUARTOS) {
            filled[q.quarto - 1] = { pontos_time: q.pontos_time.toString(), pontos_adversario: q.pontos_adversario.toString() };
          }
        });
        setQuartos(filled);
      } else {
        setQuartosAtivo(false);
        setQuartos(emptyQuartos());
      }
      setDataJogo(editingJogo?.data_jogo?.slice(0, 10) || '');
      setTimeAtleta(editingJogo?.time_atleta || '');
      setAdversario(editingJogo?.time_adversario || '');
      setLocal(editingJogo?.local || '');
      setPlacarA(editingJogo?.placar_time_atleta?.toString() ?? '');
      setPlacarB(editingJogo?.placar_adversario?.toString() ?? '');
      setGols(editingJogo?.gols_marcados?.toString() ?? '');
      setAssist(editingJogo?.assistencias?.toString() ?? '');
      setGolsPenalti(editingJogo?.gols_penalti?.toString() ?? '');
      setFase(editingJogo?.fase_campeonato || '');
      setObs(editingJogo?.observacoes || '');
      setPosicao(editingJogo?.posicao_jogo || POSICAO_NONE);
      setTeveProrrogacao(!!editingJogo?.teve_prorrogacao);
      setTeveDisputa(!!editingJogo?.teve_disputa_penaltis);
      setPlacarPenA(editingJogo?.placar_penaltis_time?.toString() ?? '');
      setPlacarPenB(editingJogo?.placar_penaltis_adversario?.toString() ?? '');
      setPenConvertidosDisputa(editingJogo?.penaltis_convertidos_disputa?.toString() ?? '');
      setMinutos(editingJogo?.minutos_jogados?.toString() ?? '');
      setGolsSofridos(editingJogo?.gols_sofridos?.toString() ?? '');
      setDefesas(editingJogo?.defesas_importantes?.toString() ?? '');
      setPenDef(editingJogo?.penaltis_defendidos?.toString() ?? '');
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
      const setsDetalhe: SetDetalhe[] = isVolei && setsAtivo
        ? sets
            .map((s, idx) => ({ set: idx + 1, pontos_time: num(s.pontos_time), pontos_adversario: num(s.pontos_adversario) }))
            .filter((s): s is SetDetalhe => s.pontos_time !== undefined && s.pontos_adversario !== undefined)
        : [];
      const quartosDetalhe: QuartoDetalhe[] = isBasquete && quartosAtivo
        ? quartos
            .map((q, idx) => ({ quarto: idx + 1, pontos_time: num(q.pontos_time), pontos_adversario: num(q.pontos_adversario) }))
            .filter((q): q is QuartoDetalhe => q.pontos_time !== undefined && q.pontos_adversario !== undefined)
        : [];
      const payload = {
        campeonato_id: campeonatoId === NONE ? null : campeonatoId,
        modalidade,
        data_jogo: dataJogo,
        time_atleta: timeAtleta.trim() || null,
        time_adversario: adversario.trim(),
        local: local.trim() || undefined,
        placar_time_atleta: num(placarA),
        placar_adversario: num(placarB),
        gols_marcados: !isVolei && !isBasquete && !isGoleiro ? num(gols) : undefined,
        assistencias: !isVolei && !isGoleiro ? num(assist) : undefined,
        posicao_jogo: posicao === POSICAO_NONE ? undefined : (posicao as PosicaoJogo),
        fase_campeonato: fase.trim() || undefined,
        observacoes: obs.trim() || undefined,
        // Prorrogação e disputa de pênaltis -- fatos do jogo, visíveis pra qualquer posição
        teve_prorrogacao: !isVolei ? teveProrrogacao : null,
        teve_disputa_penaltis: !isVolei && !isBasquete ? teveDisputa : null,
        placar_penaltis_time: !isVolei && !isBasquete && teveDisputa ? (num(placarPenA) ?? null) : null,
        placar_penaltis_adversario: !isVolei && !isBasquete && teveDisputa ? (num(placarPenB) ?? null) : null,
        // Pênalti marcado por jogador de linha
        gols_penalti: !isVolei && !isBasquete && !isGoleiro ? (num(golsPenalti) ?? null) : null,
        penaltis_convertidos_disputa: !isVolei && !isBasquete && !isGoleiro && teveDisputa ? (num(penConvertidosDisputa) ?? null) : null,
        // Goleiro (minutos_jogados também reaproveitado pelo basquete)
        minutos_jogados: isGoleiro || isBasquete ? (num(minutos) ?? null) : null,
        gols_sofridos: isGoleiro ? (num(golsSofridos) ?? null) : null,
        defesas_importantes: isGoleiro ? (num(defesas) ?? null) : null,
        penaltis_defendidos: isGoleiro ? (num(penDef) ?? null) : null,
        penaltis_defendidos_disputa: isGoleiro && teveDisputa ? (num(penDefDisputa) ?? null) : null,
        penaltis_gol_lado_correto: isGoleiro && teveDisputa ? (num(penLadoCerto) ?? null) : null,
        penaltis_gol_lado_errado: isGoleiro && teveDisputa ? (num(penLadoErrado) ?? null) : null,
        // Vôlei -- bloco geral
        pontos_ataque: isVolei && !isLibero ? (num(pontosAtaque) ?? null) : null,
        pontos_bloqueio: isVolei && !isLibero ? (num(pontosBloqueio) ?? null) : null,
        pontos_saque: isVolei && !isLibero ? (num(pontosSaque) ?? null) : null,
        // erros_cometidos também reaproveitado pelo basquete (perdas de bola)
        erros_cometidos: (isVolei && !isLibero) || isBasquete ? (num(errosCometidos) ?? null) : null,
        // Vôlei -- bloco líbero
        recepcoes_realizadas: isLibero ? (num(recepcoes) ?? null) : null,
        defesas_realizadas: isLibero ? (num(defesasVolei) ?? null) : null,
        erros_recepcao: isLibero ? (num(errosRecepcao) ?? null) : null,
        sets_detalhe: setsDetalhe.length > 0 ? setsDetalhe : null,
        // Basquete
        pontos: isBasquete ? (num(pontosBasquete) ?? null) : null,
        rebotes_ofensivos: isBasquete ? (num(rebotesOfensivos) ?? null) : null,
        rebotes_defensivos: isBasquete ? (num(rebotesDefensivos) ?? null) : null,
        roubos_bola: isBasquete ? (num(roubosBola) ?? null) : null,
        tocos: isBasquete ? (num(tocos) ?? null) : null,
        faltas_cometidas: isBasquete ? (num(faltasCometidas) ?? null) : null,
        arremessos_2pt_tentados: isBasquete ? (num(arremessos2ptTentados) ?? null) : null,
        arremessos_2pt_convertidos: isBasquete ? (num(arremessos2ptConvertidos) ?? null) : null,
        arremessos_3pt_tentados: isBasquete ? (num(arremessos3ptTentados) ?? null) : null,
        arremessos_3pt_convertidos: isBasquete ? (num(arremessos3ptConvertidos) ?? null) : null,
        lances_livres_tentados: isBasquete ? (num(lancesLivresTentados) ?? null) : null,
        lances_livres_convertidos: isBasquete ? (num(lancesLivresConvertidos) ?? null) : null,
        quartos_detalhe: quartosDetalhe.length > 0 ? quartosDetalhe : null,
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
          {modalidades.length > 1 && (
            <div>
              <Label>Modalidade</Label>
              <Select value={modalidade} onValueChange={(val) => { setModalidade(val); setPosicao(POSICAO_NONE); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {modalidades.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
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
              <Label>{isVolei ? 'Sets ganhos (meu time)' : 'Placar (meu time)'}</Label>
              <Input type="number" min={0} value={placarA} onChange={(e) => setPlacarA(e.target.value)} />
            </div>
            <div>
              <Label>{isVolei ? 'Sets ganhos (adversário)' : 'Placar (adversário)'}</Label>
              <Input type="number" min={0} value={placarB} onChange={(e) => setPlacarB(e.target.value)} />
            </div>
          </div>
          {!isVolei && (
            <div className="flex items-center gap-2">
              <Switch checked={teveProrrogacao} onCheckedChange={setTeveProrrogacao} id="teve-prorrogacao" />
              <Label htmlFor="teve-prorrogacao" className="cursor-pointer">Teve prorrogação?</Label>
            </div>
          )}
          {isVolei && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch checked={setsAtivo} onCheckedChange={setSetsAtivo} id="sets-ativo" />
                <Label htmlFor="sets-ativo" className="cursor-pointer">Registrar placar detalhado por set?</Label>
              </div>
              {setsAtivo && (
                <div className="space-y-2 rounded-lg border-2 p-3" style={{ borderColor: 'hsl(var(--border))' }}>
                  {sets.map((s, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                      <Label className="text-sm">Set {idx + 1}</Label>
                      <Input type="number" min={0} placeholder="Meu time" value={s.pontos_time}
                        onChange={(e) => setSets((prev) => prev.map((p, i) => i === idx ? { ...p, pontos_time: e.target.value } : p))} />
                      <Input type="number" min={0} placeholder="Adversário" value={s.pontos_adversario}
                        onChange={(e) => setSets((prev) => prev.map((p, i) => i === idx ? { ...p, pontos_adversario: e.target.value } : p))} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {isBasquete && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch checked={quartosAtivo} onCheckedChange={setQuartosAtivo} id="quartos-ativo" />
                <Label htmlFor="quartos-ativo" className="cursor-pointer">Registrar placar detalhado por quarto?</Label>
              </div>
              {quartosAtivo && (
                <div className="space-y-2 rounded-lg border-2 p-3" style={{ borderColor: 'hsl(var(--border))' }}>
                  {quartos.map((q, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                      <Label className="text-sm">{idx + 1}º Quarto</Label>
                      <Input type="number" min={0} placeholder="Meu time" value={q.pontos_time}
                        onChange={(e) => setQuartos((prev) => prev.map((p, i) => i === idx ? { ...p, pontos_time: e.target.value } : p))} />
                      <Input type="number" min={0} placeholder="Adversário" value={q.pontos_adversario}
                        onChange={(e) => setQuartos((prev) => prev.map((p, i) => i === idx ? { ...p, pontos_adversario: e.target.value } : p))} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
                {posicoesDisponiveis.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isVolei && !isBasquete && posicao !== 'goleiro' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gols do atleta</Label>
                <Input type="number" min={0} value={gols} onChange={(e) => setGols(e.target.value)} />
              </div>
              <div>
                <Label>Assistências do atleta</Label>
                <Input type="number" min={0} value={assist} onChange={(e) => setAssist(e.target.value)} />
              </div>
              <div>
                <Label>Dos quais, gols de pênalti</Label>
                <Input type="number" min={0} value={golsPenalti} onChange={(e) => setGolsPenalti(e.target.value)} />
              </div>
            </div>
          )}
          {isBasquete && (
            <div className="rounded-lg border-2 p-3 space-y-3" style={{ borderColor: 'hsl(var(--border))' }}>
              <p className="text-sm font-semibold">🏀 Estatísticas de Basquete</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Pontos</Label>
                  <Input type="number" min={0} value={pontosBasquete} onChange={(e) => setPontosBasquete(e.target.value)} />
                </div>
                <div>
                  <Label>Assistências</Label>
                  <Input type="number" min={0} value={assist} onChange={(e) => setAssist(e.target.value)} />
                </div>
                <div>
                  <Label>Rebotes ofensivos</Label>
                  <Input type="number" min={0} value={rebotesOfensivos} onChange={(e) => setRebotesOfensivos(e.target.value)} />
                </div>
                <div>
                  <Label>Rebotes defensivos</Label>
                  <Input type="number" min={0} value={rebotesDefensivos} onChange={(e) => setRebotesDefensivos(e.target.value)} />
                </div>
                <div>
                  <Label>Roubos de bola</Label>
                  <Input type="number" min={0} value={roubosBola} onChange={(e) => setRoubosBola(e.target.value)} />
                </div>
                <div>
                  <Label>Tocos</Label>
                  <Input type="number" min={0} value={tocos} onChange={(e) => setTocos(e.target.value)} />
                </div>
                <div>
                  <Label>Erros (perdas de bola)</Label>
                  <Input type="number" min={0} value={errosCometidos} onChange={(e) => setErrosCometidos(e.target.value)} />
                </div>
                <div>
                  <Label>Faltas cometidas</Label>
                  <Input type="number" min={0} value={faltasCometidas} onChange={(e) => setFaltasCometidas(e.target.value)} />
                </div>
                <div>
                  <Label>Minutos jogados</Label>
                  <Input type="number" min={0} value={minutos} onChange={(e) => setMinutos(e.target.value)} />
                </div>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground">Arremessos (opcional)</summary>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label>Arremessos de 2 tentados</Label>
                    <Input type="number" min={0} value={arremessos2ptTentados} onChange={(e) => setArremessos2ptTentados(e.target.value)} />
                  </div>
                  <div>
                    <Label>Arremessos de 2 convertidos</Label>
                    <Input type="number" min={0} value={arremessos2ptConvertidos} onChange={(e) => setArremessos2ptConvertidos(e.target.value)} />
                  </div>
                  <div>
                    <Label>Arremessos de 3 tentados</Label>
                    <Input type="number" min={0} value={arremessos3ptTentados} onChange={(e) => setArremessos3ptTentados(e.target.value)} />
                  </div>
                  <div>
                    <Label>Arremessos de 3 convertidos</Label>
                    <Input type="number" min={0} value={arremessos3ptConvertidos} onChange={(e) => setArremessos3ptConvertidos(e.target.value)} />
                  </div>
                  <div>
                    <Label>Lances livres tentados</Label>
                    <Input type="number" min={0} value={lancesLivresTentados} onChange={(e) => setLancesLivresTentados(e.target.value)} />
                  </div>
                  <div>
                    <Label>Lances livres convertidos</Label>
                    <Input type="number" min={0} value={lancesLivresConvertidos} onChange={(e) => setLancesLivresConvertidos(e.target.value)} />
                  </div>
                </div>
              </details>
            </div>
          )}
          {isVolei && !isLibero && (
            <div className="rounded-lg border-2 p-3 space-y-3" style={{ borderColor: 'hsl(var(--border))' }}>
              <p className="text-sm font-semibold">🏐 Estatísticas de Vôlei</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Pontos de ataque</Label>
                  <Input type="number" min={0} value={pontosAtaque} onChange={(e) => setPontosAtaque(e.target.value)} />
                </div>
                <div>
                  <Label>Pontos de bloqueio</Label>
                  <Input type="number" min={0} value={pontosBloqueio} onChange={(e) => setPontosBloqueio(e.target.value)} />
                </div>
                <div>
                  <Label>Pontos de saque (aces)</Label>
                  <Input type="number" min={0} value={pontosSaque} onChange={(e) => setPontosSaque(e.target.value)} />
                </div>
                <div>
                  <Label>Erros cometidos</Label>
                  <Input type="number" min={0} value={errosCometidos} onChange={(e) => setErrosCometidos(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {isLibero && (
            <div className="rounded-lg border-2 p-3 space-y-3" style={{ borderColor: 'hsl(var(--border))' }}>
              <p className="text-sm font-semibold">🎯 Estatísticas de Líbero</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Recepções realizadas</Label>
                  <Input type="number" min={0} value={recepcoes} onChange={(e) => setRecepcoes(e.target.value)} />
                </div>
                <div>
                  <Label>Defesas realizadas</Label>
                  <Input type="number" min={0} value={defesasVolei} onChange={(e) => setDefesasVolei(e.target.value)} />
                </div>
                <div>
                  <Label>Erros de recepção</Label>
                  <Input type="number" min={0} value={errosRecepcao} onChange={(e) => setErrosRecepcao(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {!isVolei && !isBasquete && (
            <div className="rounded-lg border-2 p-3 space-y-3" style={{ borderColor: 'hsl(var(--border))' }}>
              <p className="text-sm font-semibold">⚽ Disputa de Pênaltis</p>
              <div className="flex items-center gap-2">
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
                  {isGoleiro && (
                    <>
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
                    </>
                  )}
                  {!isGoleiro && (
                    <div>
                      <Label>Pênaltis convertidos na disputa</Label>
                      <Input type="number" min={0} value={penConvertidosDisputa} onChange={(e) => setPenConvertidosDisputa(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {isGoleiro && (
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
