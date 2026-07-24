import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCarreiraExperiencias } from '@/hooks/useCarreiraExperienciasData';
import { useCarreiraStats } from '@/hooks/useCarreiraJornadaData';
import { useJornada } from '@/hooks/useJornada';
import type { CurriculoData } from './CurriculoDocument';

interface BaixarCurriculoPdfButtonProps {
  criancaId: string | null | undefined;
  nome: string;
  fotoUrl: string | null;
  modalidade: string | null;
  categoria: string | null;
  cidade: string | null;
  estado: string | null;
  slug: string;
}

function useIdadeCrianca(criancaId: string | null | undefined) {
  return useQuery({
    queryKey: ['crianca-data-nascimento', criancaId],
    queryFn: async () => {
      const { data } = await supabase
        .from('criancas')
        .select('data_nascimento')
        .eq('id', criancaId!)
        .maybeSingle();
      if (!data?.data_nascimento) return null;
      const nascimento = new Date(data.data_nascimento);
      const hoje = new Date();
      let idade = hoje.getFullYear() - nascimento.getFullYear();
      const aindaNaoFezAniversario =
        hoje.getMonth() < nascimento.getMonth() ||
        (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
      if (aindaNaoFezAniversario) idade--;
      return idade;
    },
    enabled: !!criancaId,
  });
}

export function BaixarCurriculoPdfButton(props: BaixarCurriculoPdfButtonProps) {
  const { criancaId, nome, fotoUrl, modalidade, categoria, cidade, estado, slug } = props;
  const [gerando, setGerando] = useState(false);

  const { data: experiencias } = useCarreiraExperiencias(criancaId);
  const { stats } = useCarreiraStats(criancaId, 'todos');
  const jornada = useJornada(criancaId);
  const { data: idade } = useIdadeCrianca(criancaId);

  const handleDownload = async () => {
    setGerando(true);
    try {
      const [{ pdf }, { CurriculoDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./CurriculoDocument'),
      ]);

      const data: CurriculoData = {
        nome,
        fotoUrl,
        modalidade,
        categoria,
        cidade,
        estado,
        idade: idade ?? null,
        slug,
        stats: {
          totalJogos: stats.totalJogos,
          totalGols: stats.totalGols,
          totalAssistencias: stats.totalAssistencias,
          totalVitorias: stats.totalVitorias,
          totalCampeonatos: stats.totalCampeonatos,
          totalPremiacoes: stats.totalPremiacoes,
        },
        experiencias: (experiencias || []).map((exp) => ({
          nomeEscola: exp.nome_escola,
          dataInicio: exp.data_inicio,
          dataFim: exp.data_fim,
          atual: exp.atual,
          categoria: exp.categoria_instituicao,
          cidade: exp.cidade,
          estado: exp.estado,
        })),
        campeonatos: (jornada.data.campeonatos || []).map((camp: any) => ({
          nome: camp.nome,
          organizador: camp.organizador || null,
          dataInicio: camp.data_inicio,
          posicaoFinal: camp.posicao_final || null,
          categoria: camp.categoria || null,
          nomeTime: camp.nome_time || null,
        })),
      };

      const blob = await pdf(<CurriculoDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `curriculo-esportivo-${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[BaixarCurriculoPdfButton] erro ao gerar PDF:', err);
      toast.error('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={gerando} className="gap-2">
      {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {gerando ? 'Gerando PDF...' : 'Baixar Currículo em PDF'}
    </Button>
  );
}
