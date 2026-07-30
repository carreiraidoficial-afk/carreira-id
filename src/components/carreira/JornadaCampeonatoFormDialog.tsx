import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Image as ImageIcon, X, Upload, Plus, Trash2, Medal } from 'lucide-react';
import { toast } from 'sonner';
import { useJornada } from '@/hooks/useJornada';
import { CATEGORIAS, isModalidadeVolei } from '@/constants/esportes';
import type {
  CampeonatoComJogos,
  PosicaoFinalCampeonato,
  TipoPremiacaoIndividual,
  TorneioAbrangencia,
} from '@/types/jornada-esportiva';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criancaId: string;
  modalidades: string[];
  editingCampeonato?: CampeonatoComJogos | null;
  onSaved?: () => Promise<void> | void;
}

const ABRANGENCIAS: TorneioAbrangencia[] = ['regional', 'estadual', 'nacional', 'internacional'];

const POSICOES_FINAIS: { value: PosicaoFinalCampeonato; label: string }[] = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'campeao', label: '🏆 Campeão' },
  { value: 'vice', label: '🥈 Vice-campeão' },
  { value: 'semifinalista', label: '🥉 Semifinalista' },
  { value: 'quartas', label: 'Quartas de final' },
  { value: 'oitavas', label: 'Oitavas de final' },
  { value: 'fase_grupos', label: 'Fase de grupos' },
  { value: 'eliminado', label: 'Eliminado' },
];

const TIPOS_PREMIACAO_FUTEBOL: { value: TipoPremiacaoIndividual; label: string; emoji: string }[] = [
  { value: 'melhor_jogador', label: 'Melhor jogador', emoji: '🏆' },
  { value: 'melhor_goleiro', label: 'Melhor goleiro', emoji: '🧤' },
  { value: 'artilheiro', label: 'Artilheiro', emoji: '⚽' },
  { value: 'melhor_defesa', label: 'Melhor defesa', emoji: '🛡️' },
  { value: 'destaque', label: 'Destaque', emoji: '⭐' },
  { value: 'outro', label: 'Outro', emoji: '🏅' },
];
const TIPOS_PREMIACAO_VOLEI: { value: TipoPremiacaoIndividual; label: string; emoji: string }[] = [
  { value: 'melhor_jogador', label: 'Melhor jogador', emoji: '🏆' },
  { value: 'melhor_levantador', label: 'Melhor levantador', emoji: '🙌' },
  { value: 'melhor_atacante', label: 'Melhor atacante', emoji: '⚡' },
  { value: 'melhor_saque', label: 'Melhor saque', emoji: '🎾' },
  { value: 'melhor_bloqueio', label: 'Melhor bloqueio', emoji: '🧱' },
  { value: 'melhor_libero', label: 'Melhor líbero', emoji: '🎯' },
  { value: 'destaque', label: 'Destaque', emoji: '⭐' },
  { value: 'outro', label: 'Outro', emoji: '🏅' },
];

export function JornadaCampeonatoFormDialog({ open, onOpenChange, criancaId, modalidades, editingCampeonato, onSaved }: Props) {
  const {
    criarCampeonato, editarCampeonato, uploadArquivo,
    adicionarPremiacaoCampeonato, excluirPremiacaoCampeonato,
  } = useJornada(criancaId);
  const [saving, setSaving] = useState(false);
  const [modalidade, setModalidade] = useState<string>(modalidades[0] || 'Futebol');
  const [nome, setNome] = useState('');
  const [organizador, setOrganizador] = useState('');
  const [abrangencia, setAbrangencia] = useState<TorneioAbrangencia>('regional');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [posicaoFinal, setPosicaoFinal] = useState<PosicaoFinalCampeonato>('em_andamento');
  const [categoria, setCategoria] = useState<string>('');
  const [nomeTime, setNomeTime] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Premiações individuais (apenas em modo edição, requer ID do campeonato)
  const [novaPremTipo, setNovaPremTipo] = useState<TipoPremiacaoIndividual>('melhor_jogador');
  const [novaPremTitulo, setNovaPremTitulo] = useState('');
  const [novaPremJogoId, setNovaPremJogoId] = useState<string>('');

  useEffect(() => {
    if (open) {
      setModalidade(editingCampeonato?.modalidade || modalidades[0] || 'Futebol');
      setNome(editingCampeonato?.nome || '');
      setOrganizador(editingCampeonato?.organizador || '');
      setAbrangencia(editingCampeonato?.abrangencia || 'regional');
      setDataInicio(editingCampeonato?.data_inicio?.slice(0, 10) || '');
      setDataFinal(editingCampeonato?.data_final?.slice(0, 10) || '');
      setPosicaoFinal((editingCampeonato?.posicao_final as PosicaoFinalCampeonato) || 'em_andamento');
      setCategoria((editingCampeonato as any)?.categoria || '');
      setNomeTime((editingCampeonato as any)?.nome_time || '');
      setLogoUrl(editingCampeonato?.logo_url || null);
      setLogoFile(null);
      setNovaPremTipo('melhor_jogador');
      setNovaPremTitulo('');
      setNovaPremJogoId('');
    }
  }, [open, editingCampeonato]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error('Informe o nome do campeonato'); return; }
    if (!dataInicio) { toast.error('Informe a data de início'); return; }
    setSaving(true);
    try {
      let finalLogo: string | null = logoUrl;
      if (logoFile) {
        finalLogo = await uploadArquivo(logoFile, 'campeonatos');
      }
      const payload = {
        nome: nome.trim(),
        organizador: organizador.trim() || undefined,
        abrangencia,
        data_inicio: dataInicio,
        data_final: dataFinal || undefined,
        logo_url: finalLogo,
        posicao_final: posicaoFinal,
        categoria: categoria || null,
        nome_time: nomeTime.trim() || null,
        modalidade,
      };
      if (editingCampeonato) {
        await editarCampeonato(editingCampeonato.id, payload);
      } else {
        await criarCampeonato(payload);
      }
      await onSaved?.();
      toast.success('Campeonato salvo');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar campeonato');
    } finally {
      setSaving(false);
    }
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('A logomarca deve ser uma imagem');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 5MB)');
      return;
    }
    setLogoFile(f);
    setLogoUrl(URL.createObjectURL(f));
  };

  const handleAddPremiacao = async () => {
    if (!editingCampeonato) return;
    try {
      await adicionarPremiacaoCampeonato({
        campeonato_id: editingCampeonato.id,
        tipo_premiacao: novaPremTipo,
        titulo: novaPremTitulo.trim() || null,
        jogo_id: novaPremJogoId || null,
      });
      await onSaved?.();
      setNovaPremTitulo('');
      setNovaPremJogoId('');
      toast.success('Reconhecimento adicionado');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar reconhecimento');
    }
  };

  const handleRemovePremiacao = async (id: string) => {
    try {
      await excluirPremiacaoCampeonato(id);
      await onSaved?.();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover');
    }
  };

  const tiposPremiacaoDisponiveis = isModalidadeVolei(modalidade) ? TIPOS_PREMIACAO_VOLEI : TIPOS_PREMIACAO_FUTEBOL;
  const tipoLabel = (t: string) =>
    tiposPremiacaoDisponiveis.find((x) => x.value === t) ||
    TIPOS_PREMIACAO_FUTEBOL.find((x) => x.value === t) ||
    TIPOS_PREMIACAO_VOLEI.find((x) => x.value === t);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingCampeonato ? 'Editar Campeonato' : 'Novo Campeonato'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {modalidades.length > 1 && (
            <div>
              <Label>Modalidade</Label>
              <Select value={modalidade} onValueChange={setModalidade}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {modalidades.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Logomarca (opcional)</Label>
            <div className="flex items-center gap-3 mt-1">
              <div className="w-16 h-16 rounded-lg border flex items-center justify-center bg-muted overflow-hidden shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5 mr-1" /> {logoUrl ? 'Trocar' : 'Enviar'}
                </Button>
                {logoUrl && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setLogoUrl(null); setLogoFile(null); }}>
                    <X className="w-3.5 h-3.5 mr-1" /> Remover
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Copa SP 2025" />
          </div>
          <div>
            <Label>Organizador</Label>
            <Input value={organizador} onChange={(e) => setOrganizador(e.target.value)} placeholder="Ex: Federação Paulista" />
          </div>
          <div>
            <Label>Nome do time que defendeu</Label>
            <Input value={nomeTime} onChange={(e) => setNomeTime(e.target.value)} placeholder="Ex: Serra Macaense Sub-9" />
          </div>
          <div>
            <Label>Abrangência *</Label>
            <Select value={abrangencia} onValueChange={(v) => setAbrangencia(v as TorneioAbrangencia)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ABRANGENCIAS.map((a) => (
                  <SelectItem key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoria || 'none'} onValueChange={(v) => setCategoria(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data início *</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Data fim</Label>
              <Input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Posição final do time</Label>
            <Select value={posicaoFinal} onValueChange={(v) => setPosicaoFinal(v as PosicaoFinalCampeonato)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POSICOES_FINAIS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {editingCampeonato && (
            <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <Medal className="w-4 h-4" />
                <Label className="m-0">Reconhecimentos individuais</Label>
              </div>
              {(editingCampeonato.premiacoes || []).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum reconhecimento ainda.</p>
              )}
              {(editingCampeonato.premiacoes || []).map((p) => {
                const t = tipoLabel(p.tipo_premiacao);
                const jogo = editingCampeonato.jogos?.find((j) => j.id === p.jogo_id);
                return (
                  <div key={p.id} className="flex items-center gap-2 text-sm bg-background rounded p-2">
                    <span>{t?.emoji || '🏅'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t?.label || p.tipo_premiacao}</div>
                      {p.titulo && <div className="text-xs text-muted-foreground truncate">{p.titulo}</div>}
                      {jogo && <div className="text-[11px] text-muted-foreground truncate">{jogo.fase_campeonato || 'Jogo'} • {jogo.time_adversario}</div>}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemovePremiacao(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select value={novaPremTipo} onValueChange={(v) => setNovaPremTipo(v as TipoPremiacaoIndividual)}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    {tiposPremiacaoDisponiveis.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Detalhe (ex: 8 gols)"
                  value={novaPremTitulo}
                  onChange={(e) => setNovaPremTitulo(e.target.value)}
                />
              </div>
              {(editingCampeonato.jogos || []).length > 0 && (
                <Select value={novaPremJogoId || 'none'} onValueChange={(v) => setNovaPremJogoId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Jogo (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem jogo específico</SelectItem>
                    {editingCampeonato.jogos.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.fase_campeonato ? `${j.fase_campeonato} — ` : ''}{j.time_atleta || 'Meu time'} x {j.time_adversario}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleAddPremiacao}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar reconhecimento
              </Button>
            </div>
          )}

          {!editingCampeonato && (
            <p className="text-[11px] text-muted-foreground">
              Salve o campeonato e edite-o para adicionar reconhecimentos individuais.
            </p>
          )}

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
