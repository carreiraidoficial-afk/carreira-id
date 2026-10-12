import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, MessageCircle, Search } from 'lucide-react';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Consulta do backup de campeonatos (schema campeonatos_backup, fechado para a API). Só leitura:
 * tudo passa por funções backup_* que só respondem para admin.
 */

const rpc = async <T,>(nome: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await (supabase as any).rpc(nome, args ?? {});
  if (error) throw error;
  return data as T;
};

interface Resumo {
  campeonatos: number; times: number; jogadores: number; comissao: number; jogos: number; jogos_finalizados: number; eventos: number;
  vinculados: number; em_analise: number; ultima_coleta: string | null; tamanho_mb: number;
}
interface Campeonato {
  id: string; fonte: string; fonte_id: string; nome: string; edicao: string | null; categoria: string | null; ano: number | null;
  time_foco: string | null; coletado_em: string; times: number; jogos: number; jogos_finalizados: number; jogadores: number;
}
interface TimeLinha {
  id: string; nome: string; jogadores: number; jogos: number; vitorias: number; empates: number; derrotas: number;
  gols_pro: number; gols_contra: number; saldo: number; pontos: number;
}
interface JogoLinha {
  id: string; data_hora: string | null; rodada: string | null; local: string | null; mandante: string | null; visitante: string | null;
  placar_mandante: number | null; placar_visitante: number | null; finalizado: boolean; wo: boolean; eventos: number;
}
interface JogadorLinha {
  id: string; nome_completo: string; posicao: string | null; papel: string; camisa: number | null; data_nascimento: string | null; vinculo_status: string; crianca_id: string | null; time: string; campeonato: string;
  categoria: string | null; jogos: number; gols: number; assistencias: number; destaques: number; defesas: number; amarelos: number; vermelhos: number;
}
interface JogadorJogo {
  jogo_id: string; data_hora: string | null; rodada: string | null; mandante: string | null; visitante: string | null;
  placar_mandante: number | null; placar_visitante: number | null; finalizado: boolean; jogou: number; gols: number;
  assistencias: number; destaque: number; defesas: number; amarelos: number; vermelhos: number;
}
interface EventoJogo { jogador_id: string; nome_completo: string; time: string | null; tipo: string; quantidade: number }

interface ContatoTime {
  id: string; nome_time: string; responsavel_nome: string | null; email: string | null; telefone: string | null;
  cidade: string | null; estado: string | null; status_contato: string; contatado_em: string | null; observacao: string | null;
  categorias: string | null; atletas: number; comissao: number;
}
const STATUS_CONTATO: Record<string, string> = {
  nao_contatado: 'Não contatado', contatado: 'Contatado', respondeu: 'Respondeu', interessado: 'Interessado', sem_interesse: 'Sem interesse', parceiro: 'Parceiro',
};

const VINCULO: Record<string, string> = { nao_vinculado: 'Sem vínculo', em_analise: 'Em análise', vinculado: 'Vinculado', recusado: 'Recusado' };
const TIPO: Record<string, string> = {
  gol: '⚽ Gol', assistencia: '🎯 Assistência', presenca: 'Jogou', destaque: '⭐ Destaque', defesa: '🧤 Defesa', amarelo: '🟨 Amarelo', vermelho: '🟥 Vermelho', outro: 'Outro',
};

const nascBR = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');
const dataBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const placar = (a: number | null, b: number | null) => (a == null || b == null ? 'a jogar' : `${a} x ${b}`);

function Carregando() {
  return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-2xl font-bold">{valor}</div>
      <div className="text-xs text-muted-foreground">{rotulo}</div>
    </div>
  );
}

function VisaoGeral({ campeonatos }: { campeonatos: Campeonato[] | undefined }) {
  const { data: r } = useQuery({ queryKey: ['bk-resumo'], queryFn: () => rpc<Resumo>('backup_resumo'), staleTime: 60_000 });
  return (
    <div className="space-y-4">
      {r ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-9">
          <Numero rotulo="Campeonatos" valor={r.campeonatos} />
          <Numero rotulo="Times" valor={r.times} />
          <Numero rotulo="Atletas" valor={r.jogadores} />
          <Numero rotulo="Comissão técnica" valor={r.comissao} />
          <Numero rotulo="Jogos" valor={`${r.jogos_finalizados}/${r.jogos}`} />
          <Numero rotulo="Eventos" valor={r.eventos} />
          <Numero rotulo="Vinculados ao app" valor={r.vinculados} />
          <Numero rotulo="Em análise" valor={r.em_analise} />
          <Numero rotulo="Espaço (MB)" valor={r.tamanho_mb} />
        </div>
      ) : <Carregando />}
      <Card>
        <CardHeader><CardTitle className="text-base">Campeonatos guardados</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {!campeonatos ? <Carregando /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campeonato</TableHead><TableHead>Categoria</TableHead><TableHead>Fonte</TableHead>
                  <TableHead className="text-right">Times</TableHead><TableHead className="text-right">Jogadores</TableHead>
                  <TableHead className="text-right">Jogos</TableHead><TableHead>Coletado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campeonatos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}{c.edicao ? ` · ${c.edicao}` : ''}</TableCell>
                    <TableCell>{c.categoria}</TableCell>
                    <TableCell><Badge variant="outline">{c.fonte}</Badge></TableCell>
                    <TableCell className="text-right">{c.times}</TableCell>
                    <TableCell className="text-right">{c.jogadores}</TableCell>
                    <TableCell className="text-right">{c.jogos_finalizados}/{c.jogos}</TableCell>
                    <TableCell className="whitespace-nowrap">{dataBR(c.coletado_em)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">O que dá para buscar no futuro</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p><b className="text-foreground">iFut:</b> a Super Copa Trivella 2026 está completa (Sub 08 a Sub 15). Outros campeonatos do iFut podem ser coletados da mesma forma (jogos, gols, assistências, destaque, cartões).</p>
          <p><b className="text-foreground">Copa União da Base:</b> ainda não coletada. Traz jogos, placares, escalações e artilharia total, mas não traz gol por jogo nem assistência.</p>
          <p><b className="text-foreground">Taça Edilson Silva (Ritmo do Esporte):</b> ainda não coletada. Mesma plataforma da Copa União.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function DetalheJogador({ jogador, onClose }: { jogador: JogadorLinha | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['bk-jogador-jogos', jogador?.id],
    queryFn: () => rpc<JogadorJogo[]>('backup_jogador_jogos', { p_jogador: jogador!.id }),
    enabled: !!jogador,
  });
  return (
    <Dialog open={!!jogador} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{jogador?.nome_completo}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {jogador?.posicao || 'Sem posição'}{jogador?.data_nascimento ? ` · nasc. ${nascBR(jogador.data_nascimento)}` : ''}{jogador?.camisa != null ? ` · camisa ${jogador.camisa}` : ''} · {jogador?.time} · {jogador?.campeonato} {jogador?.categoria} · {VINCULO[jogador?.vinculo_status ?? 'nao_vinculado']}
          </p>
        </DialogHeader>
        {isLoading ? <Carregando /> : (
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead><TableHead>Jogo</TableHead><TableHead>Placar</TableHead>
                  <TableHead className="text-right">Gols</TableHead><TableHead className="text-right">Assist.</TableHead><TableHead>Outros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data || []).map((j) => (
                  <TableRow key={j.jogo_id}>
                    <TableCell className="whitespace-nowrap">{dataBR(j.data_hora)}</TableCell>
                    <TableCell>{j.rodada ? `${j.rodada}: ` : ''}{j.mandante} x {j.visitante}{j.jogou ? '' : ' (não jogou)'}</TableCell>
                    <TableCell>{placar(j.placar_mandante, j.placar_visitante)}</TableCell>
                    <TableCell className="text-right">{j.gols}</TableCell>
                    <TableCell className="text-right">{j.assistencias}</TableCell>
                    <TableCell className="space-x-1">
                      {j.destaque > 0 && <Badge>⭐ Destaque</Badge>}
                      {j.defesas > 0 && <Badge variant="secondary">🧤 {j.defesas}</Badge>}
                      {j.amarelos > 0 && <Badge variant="secondary">🟨 {j.amarelos}</Badge>}
                      {j.vermelhos > 0 && <Badge variant="destructive">🟥 {j.vermelhos}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const TAMANHO_PAGINA = 40;

function Jogadores({ campeonatos }: { campeonatos: Campeonato[] | undefined }) {
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [campeonato, setCampeonato] = useState('todos');
  const [vinculo, setVinculo] = useState('todos');
  const [papel, setPapel] = useState('jogador');
  const [pagina, setPagina] = useState(0);
  const [aberto, setAberto] = useState<JogadorLinha | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setTermo(busca); setPagina(0); }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  const { data, isFetching } = useQuery({
    queryKey: ['bk-jogadores', termo, campeonato, vinculo, papel, pagina],
    queryFn: () => rpc<{ total: number; linhas: JogadorLinha[] }>('backup_jogadores', {
      p_busca: termo || null,
      p_campeonato: campeonato === 'todos' ? null : campeonato,
      p_vinculo: vinculo === 'todos' ? null : vinculo,
      p_papel: papel === 'todos' ? null : papel,
      p_limite: TAMANHO_PAGINA,
      p_offset: pagina * TAMANHO_PAGINA,
    }),
    placeholderData: (prev) => prev,
  });
  const total = data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do atleta (sem precisar de acento)" className="pl-8" />
          </div>
          <Select value={campeonato} onValueChange={(v) => { setCampeonato(v); setPagina(0); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Campeonato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {(campeonatos || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.categoria} · {c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={papel} onValueChange={(v) => { setPapel(v); setPagina(0); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="jogador">Atletas</SelectItem>
              <SelectItem value="comissao">Comissão técnica</SelectItem>
              <SelectItem value="todos">Atletas e comissão</SelectItem>
            </SelectContent>
          </Select>
          <Select value={vinculo} onValueChange={(v) => { setVinculo(v); setPagina(0); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Vínculo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer vínculo</SelectItem>
              {Object.entries(VINCULO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto pt-4">
          <p className="mb-2 text-sm text-muted-foreground">{total} jogador(es) encontrado(s). Clique numa linha para ver os jogos.</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atleta</TableHead><TableHead>Time</TableHead><TableHead>Cat.</TableHead><TableHead>Posição</TableHead><TableHead>Nasc.</TableHead><TableHead className="text-right">Nº</TableHead>
                <TableHead className="text-right">Jogos</TableHead><TableHead className="text-right">Gols</TableHead><TableHead className="text-right">Assist.</TableHead>
                <TableHead className="text-right">⭐</TableHead><TableHead className="text-right">🟨</TableHead><TableHead className="text-right">🟥</TableHead><TableHead>Vínculo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.linhas || []).map((j) => (
                <TableRow key={j.id} className="cursor-pointer" onClick={() => setAberto(j)}>
                  <TableCell className="font-medium">{j.nome_completo}</TableCell>
                  <TableCell>{j.time}</TableCell>
                  <TableCell>{j.categoria}</TableCell>
                  <TableCell>{j.posicao || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{nascBR(j.data_nascimento)}</TableCell>
                  <TableCell className="text-right">{j.camisa ?? '—'}</TableCell>
                  <TableCell className="text-right">{j.jogos}</TableCell>
                  <TableCell className="text-right">{j.gols}</TableCell>
                  <TableCell className="text-right">{j.assistencias}</TableCell>
                  <TableCell className="text-right">{j.destaques}</TableCell>
                  <TableCell className="text-right">{j.amarelos}</TableCell>
                  <TableCell className="text-right">{j.vermelhos}</TableCell>
                  <TableCell><Badge variant={j.vinculo_status === 'vinculado' ? 'default' : 'outline'}>{VINCULO[j.vinculo_status]}</Badge></TableCell>
                </TableRow>
              ))}
              {data && data.linhas.length === 0 && (
                <TableRow><TableCell colSpan={13} className="py-6 text-center text-muted-foreground">Nenhum atleta com esse nome nos campeonatos guardados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="outline" size="icon" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm">{pagina + 1} / {paginas}</span>
            <Button variant="outline" size="icon" disabled={pagina + 1 >= paginas} onClick={() => setPagina(pagina + 1)} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
      <DetalheJogador jogador={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}

function TimesEJogos({ campeonatos }: { campeonatos: Campeonato[] | undefined }) {
  const [campeonato, setCampeonato] = useState<string>('');
  const [jogo, setJogo] = useState<JogoLinha | null>(null);
  useEffect(() => { if (!campeonato && campeonatos?.length) setCampeonato(campeonatos[0].id); }, [campeonatos, campeonato]);

  const { data: times, isLoading: carregandoTimes } = useQuery({
    queryKey: ['bk-times', campeonato], queryFn: () => rpc<TimeLinha[]>('backup_times', { p_campeonato: campeonato }), enabled: !!campeonato,
  });
  const { data: jogos, isLoading: carregandoJogos } = useQuery({
    queryKey: ['bk-jogos', campeonato], queryFn: () => rpc<JogoLinha[]>('backup_jogos', { p_campeonato: campeonato }), enabled: !!campeonato,
  });
  const { data: eventos } = useQuery({
    queryKey: ['bk-jogo-eventos', jogo?.id], queryFn: () => rpc<EventoJogo[]>('backup_jogo_eventos', { p_jogo: jogo!.id }), enabled: !!jogo,
  });

  return (
    <div className="space-y-3">
      <Select value={campeonato} onValueChange={setCampeonato}>
        <SelectTrigger className="w-64"><SelectValue placeholder="Campeonato" /></SelectTrigger>
        <SelectContent>
          {(campeonatos || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.categoria} · {c.nome}</SelectItem>)}
        </SelectContent>
      </Select>
      <Card>
        <CardHeader><CardTitle className="text-base">Times (classificação pelos jogos guardados)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {carregandoTimes ? <Carregando /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead><TableHead className="text-right">Pts</TableHead><TableHead className="text-right">J</TableHead>
                  <TableHead className="text-right">V</TableHead><TableHead className="text-right">E</TableHead><TableHead className="text-right">D</TableHead>
                  <TableHead className="text-right">GP</TableHead><TableHead className="text-right">GC</TableHead><TableHead className="text-right">SG</TableHead>
                  <TableHead className="text-right">Atletas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(times || []).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.nome}</TableCell>
                    <TableCell className="text-right">{t.pontos}</TableCell><TableCell className="text-right">{t.jogos}</TableCell>
                    <TableCell className="text-right">{t.vitorias}</TableCell><TableCell className="text-right">{t.empates}</TableCell><TableCell className="text-right">{t.derrotas}</TableCell>
                    <TableCell className="text-right">{t.gols_pro}</TableCell><TableCell className="text-right">{t.gols_contra}</TableCell><TableCell className="text-right">{t.saldo}</TableCell>
                    <TableCell className="text-right">{t.jogadores}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Jogos (clique para ver gols, assistências e cartões)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {carregandoJogos ? <Carregando /> : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Data</TableHead><TableHead>Rodada</TableHead><TableHead>Jogo</TableHead><TableHead>Placar</TableHead><TableHead>Local</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(jogos || []).map((j) => (
                  <TableRow key={j.id} className="cursor-pointer" onClick={() => setJogo(j)}>
                    <TableCell className="whitespace-nowrap">{dataBR(j.data_hora)}</TableCell>
                    <TableCell>{j.rodada}</TableCell>
                    <TableCell>{j.mandante} x {j.visitante}{j.wo ? ' (W.O.)' : ''}</TableCell>
                    <TableCell>{placar(j.placar_mandante, j.placar_visitante)}</TableCell>
                    <TableCell>{j.local || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={!!jogo} onOpenChange={(o) => !o && setJogo(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{jogo?.mandante} {placar(jogo?.placar_mandante ?? null, jogo?.placar_visitante ?? null)} {jogo?.visitante}</DialogTitle>
            <p className="text-sm text-muted-foreground">{dataBR(jogo?.data_hora ?? null)} · {jogo?.rodada} · {jogo?.local}</p>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Atleta</TableHead><TableHead>Time</TableHead><TableHead>Evento</TableHead></TableRow></TableHeader>
              <TableBody>
                {(eventos || []).filter((e) => e.tipo !== 'presenca').map((e, i) => (
                  <TableRow key={`${e.jogador_id}-${e.tipo}-${i}`}>
                    <TableCell>{e.nome_completo}</TableCell><TableCell>{e.time}</TableCell>
                    <TableCell>{TIPO[e.tipo] ?? e.tipo}{e.quantidade > 1 ? ` ×${e.quantidade}` : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">{(eventos || []).filter((e) => e.tipo === 'presenca').length} atletas escalados.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContatosTimes() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['bk-contatos'], queryFn: () => rpc<ContatoTime[]>('backup_contatos') });
  const [aberto, setAberto] = useState<ContatoTime | null>(null);
  const [status, setStatus] = useState('nao_contatado');
  const [obs, setObs] = useState('');
  const salvar = useMutation({
    mutationFn: () => rpc('backup_contato_atualizar', { p_id: aberto!.id, p_status: status, p_observacao: obs.trim() || null }),
    onSuccess: () => { toast.success('Acompanhamento salvo'); qc.invalidateQueries({ queryKey: ['bk-contatos'] }); setAberto(null); },
    onError: () => toast.error('Não consegui salvar'),
  });
  const abrir = (c: ContatoTime) => { setAberto(c); setStatus(c.status_contato); setObs(c.observacao ?? ''); };
  const zap = (tel: string | null) => {
    const d = (tel ?? '').replace(/\D/g, '');
    return d ? `https://wa.me/${d.startsWith('55') ? d : `55${d}`}` : null;
  };
  if (isLoading) return <Carregando />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Responsável cadastrado em cada time (em geral o técnico ou dono da equipe). Uso exclusivo para o Carreira ID oferecer o app. Clique numa linha para anotar o andamento.
      </p>
      <Card>
        <CardContent className="overflow-x-auto pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead><TableHead>Responsável</TableHead><TableHead>Email</TableHead><TableHead>Telefone</TableHead>
                <TableHead>Categorias</TableHead><TableHead className="text-right">Atletas</TableHead><TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data || []).map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => abrir(c)}>
                  <TableCell className="font-medium">{c.nome_time}</TableCell>
                  <TableCell>{c.responsavel_nome || '—'}</TableCell>
                  <TableCell>{c.email || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {c.telefone || '—'}
                    {zap(c.telefone) && (
                      <a href={zap(c.telefone)!} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="ml-2 inline-flex align-middle text-green-600" aria-label="Abrir WhatsApp">
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                  </TableCell>
                  <TableCell>{c.categorias || '—'}</TableCell>
                  <TableCell className="text-right">{c.atletas}</TableCell>
                  <TableCell><Badge variant={c.status_contato === 'nao_contatado' ? 'outline' : 'default'}>{STATUS_CONTATO[c.status_contato]}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{aberto?.nome_time}</DialogTitle>
            <p className="text-sm text-muted-foreground">{aberto?.responsavel_nome} · {aberto?.email} · {aberto?.telefone}</p>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_CONTATO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Anotações (quem falou, o que combinou...)" rows={4} />
            <Button className="w-full" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CarreiraAdminBancoCampeonatosPage() {
  const { data: campeonatos } = useQuery({
    queryKey: ['bk-campeonatos'], queryFn: () => rpc<Campeonato[]>('backup_campeonatos'), staleTime: 60_000,
  });
  return (
    <CarreiraAdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Banco de campeonatos</h1>
          <p className="text-muted-foreground">Backup interno de campeonatos, times, atletas e jogos. Só você vê. Nada daqui aparece no app para outras pessoas.</p>
        </div>
        <Tabs defaultValue="geral">
          <TabsList>
            <TabsTrigger value="geral">Visão geral</TabsTrigger>
            <TabsTrigger value="jogadores">Atletas</TabsTrigger>
            <TabsTrigger value="times">Times e jogos</TabsTrigger>
            <TabsTrigger value="contatos">Contatos dos times</TabsTrigger>
          </TabsList>
          <TabsContent value="geral"><VisaoGeral campeonatos={campeonatos} /></TabsContent>
          <TabsContent value="jogadores"><Jogadores campeonatos={campeonatos} /></TabsContent>
          <TabsContent value="times"><TimesEJogos campeonatos={campeonatos} /></TabsContent>
          <TabsContent value="contatos"><ContatosTimes /></TabsContent>
        </Tabs>
      </div>
    </CarreiraAdminLayout>
  );
}
