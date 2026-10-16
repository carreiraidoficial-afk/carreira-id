import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Crown, Download, FileText, Files, Loader2, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { parseDataLocal } from '@/lib/datas';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { useCarreiraExperiencias } from '@/hooks/useCarreiraExperienciasData';
import { useCarreiraStats } from '@/hooks/useCarreiraJornadaData';
import { useJornada } from '@/hooks/useJornada';
import type { PerfilAtleta } from '@/hooks/useCarreiraData';
import type { CurriculoTema } from './CurriculoDocument';
import { gerarCurriculoPdf, type CurriculoModelo } from './gerarCurriculoPdf';

interface Props {
  perfil: PerfilAtleta;
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  /** Recurso liberado no plano do atleta (Elite). */
  liberado: boolean;
}

function useIdadeCrianca(criancaId: string | null | undefined, ativo: boolean) {
  return useQuery({
    queryKey: ['crianca-data-nascimento', criancaId],
    queryFn: async () => {
      const { data } = await supabase.from('criancas').select('data_nascimento').eq('id', criancaId!).maybeSingle();
      if (!data?.data_nascimento) return null;
      const nascimento = parseDataLocal(data.data_nascimento);
      const hoje = new Date();
      let idade = hoje.getFullYear() - nascimento.getFullYear();
      const aindaNao = hoje.getMonth() < nascimento.getMonth() || (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
      return aindaNao ? idade - 1 : idade;
    },
    enabled: !!criancaId && ativo,
  });
}

function Opcao({
  ativa, onClick, icone, titulo, descricao, cor,
}: { ativa: boolean; onClick: () => void; icone: React.ReactNode; titulo: string; descricao: string; cor: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className="flex flex-1 flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors"
      style={{ borderColor: ativa ? cor : 'hsl(var(--border))', backgroundColor: ativa ? `${cor}14` : undefined }}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: ativa ? cor : undefined }}>
        {icone}
        {titulo}
      </span>
      <span className="text-xs leading-snug text-muted-foreground">{descricao}</span>
    </button>
  );
}

export function CurriculoPdfDialog({ perfil, open, onOpenChange, liberado }: Props) {
  const navigate = useNavigate();
  const cor = perfil.cor_destaque || '#3b82f6';
  const criancaId = perfil.crianca_id || null;
  const [modelo, setModelo] = useState<CurriculoModelo>('resumo');
  const [tema, setTema] = useState<CurriculoTema>('claro');
  const [incluirVideos, setIncluirVideos] = useState(true);
  const [gerando, setGerando] = useState(false);

  const { data: experiencias } = useCarreiraExperiencias(open ? criancaId : null);
  const { stats } = useCarreiraStats(open ? criancaId : null, 'todos');
  const jornada = useJornada(open ? criancaId : null);
  const { data: idade } = useIdadeCrianca(criancaId, open);

  const perfilPublico = perfil.is_public !== false;
  const carregando = jornada.isLoading;

  const baixar = async () => {
    setGerando(true);
    try {
      await gerarCurriculoPdf(
        { perfil, idade: idade ?? null, experiencias: experiencias || [], stats, jornada: jornada.data as any },
        { modelo, tema, incluirVideos },
      );
      onOpenChange(false);
    } catch (err) {
      console.error('[CurriculoPdfDialog] erro ao gerar PDF:', err);
      toast.error('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!gerando) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: cor }} />
            Currículo esportivo em PDF
          </DialogTitle>
          <DialogDescription>
            Escolha como o currículo de {perfil.nome.split(' ')[0]} vai ficar. Ele leva um QR code para o perfil completo.
          </DialogDescription>
        </DialogHeader>

        {!liberado ? (
          <div className="space-y-3 rounded-xl border p-4 text-center">
            <Crown className="mx-auto h-7 w-7" style={{ color: cor }} />
            <p className="text-sm font-semibold">O currículo em PDF é um recurso do plano Elite</p>
            <p className="text-xs text-muted-foreground">Com o Elite você baixa o resumo de uma página e o currículo completo, com todos os jogos e campanhas.</p>
            <Button className="w-full gap-2 text-white" style={{ backgroundColor: cor }} onClick={() => { onOpenChange(false); navigate(carreiraPath('/planos')); }}>
              <Crown className="h-4 w-4" /> Conhecer o Elite
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modelo</p>
              <div className="flex gap-2">
                <Opcao ativa={modelo === 'resumo'} onClick={() => setModelo('resumo')} cor={cor}
                  icone={<FileText className="h-4 w-4" />} titulo="Resumo" descricao="1 página, só os dados principais" />
                <Opcao ativa={modelo === 'completo'} onClick={() => setModelo('completo')} cor={cor}
                  icone={<Files className="h-4 w-4" />} titulo="Completo" descricao="Todos os jogos, campanhas e temporadas (2+ páginas)" />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aparência</p>
              <div className="flex gap-2">
                <Opcao ativa={tema === 'claro'} onClick={() => setTema('claro')} cor={cor}
                  icone={<Sun className="h-4 w-4" />} titulo="Claro" descricao="Fundo branco, bom para imprimir" />
                <Opcao ativa={tema === 'escuro'} onClick={() => setTema('escuro')} cor={cor}
                  icone={<Moon className="h-4 w-4" />} titulo="Escuro" descricao="Fundo preto, bom para compartilhar na tela" />
              </div>
            </div>

            {modelo === 'completo' && (
              <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Incluir links dos vídeos</p>
                  <p className="text-xs text-muted-foreground">
                    {perfilPublico
                      ? 'Quem receber o PDF poderá abrir os vídeos dos jogos.'
                      : 'Indisponível: o perfil está privado, e os vídeos não podem ficar em um arquivo compartilhado.'}
                  </p>
                </div>
                <Switch checked={perfilPublico && incluirVideos} disabled={!perfilPublico} onCheckedChange={setIncluirVideos} />
              </div>
            )}

            <Button className="w-full gap-2 text-white" style={{ backgroundColor: cor }} disabled={gerando || carregando} onClick={baixar}>
              {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {gerando ? 'Gerando o PDF...' : carregando ? 'Carregando os dados...' : 'Baixar PDF'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
