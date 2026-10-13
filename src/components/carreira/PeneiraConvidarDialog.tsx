import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Send, User, Filter } from 'lucide-react';
import { useSearchAtletasForPeneira, useSendConvitesPeneira, Peneira } from '@/hooks/usePeneirasData';
import { MODALIDADES, CATEGORIAS, ESTADOS } from '@/constants/esportes';
import { toast } from 'sonner';

const POSICOES = [
  'Goleiro', 'Lateral Direito', 'Lateral Esquerdo', 'Zagueiro',
  'Volante', 'Meia', 'Atacante', 'Ponta Direita', 'Ponta Esquerda',
  'Centroavante',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peneira: Peneira;
}

export function PeneiraConvidarDialog({ open, onOpenChange, peneira }: Props) {
  const [estado, setEstado] = useState(peneira.estado || '');
  const [cidade, setCidade] = useState(peneira.cidade || '');
  const [modalidade, setModalidade] = useState(peneira.modalidade || '');
  const [posicao, setPosicao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: atletas = [], isLoading } = useSearchAtletasForPeneira({
    estado: estado || undefined,
    cidade: cidade || undefined,
    modalidade: modalidade || undefined,
    posicao: posicao || undefined,
    categoria: categoria || undefined,
    enabled: open,
  });

  const sendConvites = useSendConvitesPeneira();

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === atletas.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(atletas.map((a: any) => a.id)));
    }
  };

  const handleSend = async () => {
    if (selected.size === 0) {
      toast.error('Selecione ao menos um atleta');
      return;
    }
    const atletaIds = atletas
      .filter((a: any) => selected.has(a.id))
      .map((a: any) => ({ perfil_id: a.id, user_id: a.user_id }));

    await sendConvites.mutateAsync({ peneiraId: peneira.id, atletaIds });
    onOpenChange(false);
    setSelected(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Convidar Atletas — {peneira.titulo}
          </DialogTitle>
        </DialogHeader>

        <p className="rounded-md bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
          Aparecem só atletas cujo responsável ativou o recebimento de convites e que combinam com a categoria da peneira. Máximo de 50 convites por dia.
        </p>

        {/* Filters */}
        <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1.5 self-start">
          <Filter className="w-4 h-4" /> Filtros
        </Button>

        {showFilters && (
          <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/50 border">
            <div>
              <Label className="text-[10px]">Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {ESTADOS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Cidade</Label>
              <Input className="h-8 text-xs" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" />
            </div>
            <div>
              <Label className="text-[10px]">Modalidade</Label>
              <Select value={modalidade} onValueChange={setModalidade}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {MODALIDADES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Posição</Label>
              <Select value={posicao} onValueChange={setPosicao}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {POSICOES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-[10px]">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{isLoading ? 'Buscando...' : `${atletas.length} atletas encontrados`}</span>
          {atletas.length > 0 && (
            <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-6">
              {selected.size === atletas.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 max-h-[40vh]">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : atletas.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Nenhum atleta encontrado com esses filtros</p>
          ) : (
            <div className="space-y-1">
              {atletas.map((atleta: any) => (
                <div
                  key={atleta.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    selected.has(atleta.id) ? 'bg-primary/10' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => toggleSelect(atleta.id)}
                >
                  <Checkbox checked={selected.has(atleta.id)} className="shrink-0" />
                  <Avatar className="w-8 h-8">
                    {atleta.foto_url && <AvatarImage src={atleta.foto_url} />}
                    <AvatarFallback><User className="w-3 h-3" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{atleta.nome}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      {atleta.posicao_principal && <span>{atleta.posicao_principal}</span>}
                      {atleta.categoria && <span>• {atleta.categoria}</span>}
                      {atleta.cidade && <span>• {atleta.cidade}/{atleta.estado}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={selected.size === 0 || sendConvites.isPending}
          className="w-full gap-2"
        >
          {sendConvites.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar {selected.size > 0 ? `${selected.size} convite(s)` : 'convites'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
