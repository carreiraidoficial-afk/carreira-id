import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/image-compressor';
import { isModalidadeVolei, isModalidadeBasquete } from '@/constants/esportes';
import type {
  CampeonatoPremiacao,
  CreateCampeonatoInput,
  CreateCampeonatoPremiacaoInput,
  CreateJogoInput,
  CreateJogoMidiaInput,
  EstatisticasAtleta,
  JogoComMidia,
  JogoMidia,
  JornadaEsportivaData,
  PosicaoJogo,
} from '@/types/jornada-esportiva';

const EMPTY: JornadaEsportivaData = {
  campeonatos: [],
  amistosos: [],
  estatisticas: {
    totalJogos: 0,
    totalGols: 0,
    totalAssistencias: 0,
    totalVitorias: 0,
    totalCampeonatos: 0,
    posicoesMais: [],
  },
};

function mapMidia(row: any): JogoMidia {
  return {
    id: row.id,
    jogo_id: row.jogo_id,
    tipo_midia: row.tipo_midia,
    // Tabela usa coluna `url`; mantemos url_midia no tipo TS
    url_midia: row.url ?? row.url_midia ?? '',
    ordem: row.ordem ?? 0,
    created_at: row.created_at,
  };
}

export function useJornada(criancaId: string | undefined | null) {
  const queryClient = useQueryClient();
  const queryKey = ['jornada', criancaId] as const;

  const fetchJornada = useCallback(async (): Promise<JornadaEsportivaData> => {
    if (!criancaId) return EMPTY;
      const [campRes, jogosRes] = await Promise.all([
        (supabase as any)
          .from('carreira_campeonatos')
          .select('*')
          .eq('crianca_id', criancaId)
          .order('data_inicio', { ascending: false }),
        (supabase as any)
          .from('carreira_jogos')
          .select('*')
          .eq('crianca_id', criancaId)
          .order('data_jogo', { ascending: false }),
      ]);

      if (campRes.error) throw campRes.error;
      if (jogosRes.error) throw jogosRes.error;

      const campeonatos = campRes.data || [];
      const jogos = jogosRes.data || [];

      const jogoIds = jogos.map((j: any) => j.id);
      let midias: JogoMidia[] = [];
      if (jogoIds.length > 0) {
        const midiasRes = await (supabase as any)
          .from('carreira_jogo_midias')
          .select('*')
          .in('jogo_id', jogoIds)
          .order('ordem', { ascending: true });
        if (midiasRes.error) throw midiasRes.error;
        midias = (midiasRes.data || []).map(mapMidia);
      }

      // Premiações por campeonato
      let premiacoes: CampeonatoPremiacao[] = [];
      const campIds = campeonatos.map((c: any) => c.id);
      if (campIds.length > 0) {
        const premRes = await (supabase as any)
          .from('carreira_campeonato_premiacoes')
          .select('*')
          .in('campeonato_id', campIds);
        if (premRes.error) throw premRes.error;
        premiacoes = (premRes.data || []) as CampeonatoPremiacao[];
      }
      const premByCamp = new Map<string, CampeonatoPremiacao[]>();
      premiacoes.forEach((p) => {
        const arr = premByCamp.get(p.campeonato_id) || [];
        arr.push(p);
        premByCamp.set(p.campeonato_id, arr);
      });

      const midiasByJogo = new Map<string, JogoMidia[]>();
      midias.forEach((m) => {
        const arr = midiasByJogo.get(m.jogo_id) || [];
        arr.push(m);
        midiasByJogo.set(m.jogo_id, arr);
      });

      const jogosComMidia: JogoComMidia[] = jogos.map((j: any) => ({
        ...j,
        midias: midiasByJogo.get(j.id) || [],
      }));

      const amistosos = jogosComMidia.filter((j) => !j.campeonato_id);
      const jogosByCampeonato = new Map<string, JogoComMidia[]>();
      jogosComMidia.forEach((j) => {
        if (!j.campeonato_id) return;
        const arr = jogosByCampeonato.get(j.campeonato_id) || [];
        arr.push(j);
        jogosByCampeonato.set(j.campeonato_id, arr);
      });

      const campeonatosComJogos = campeonatos.map((c: any) => {
        const cJogos = jogosByCampeonato.get(c.id) || [];
        const totalGols = cJogos.reduce((s, j) => s + (j.gols_marcados || 0), 0);
        const totalAssistencias = cJogos.reduce((s, j) => s + (j.assistencias || 0), 0);
        const totalVitorias = cJogos.filter(
          (j) =>
            (j.placar_time_atleta ?? 0) > (j.placar_adversario ?? 0) &&
            j.placar_time_atleta != null &&
            j.placar_adversario != null,
        ).length;
        return {
          ...c,
          jogos: cJogos,
          premiacoes: premByCamp.get(c.id) || [],
          totalJogos: cJogos.length,
          totalGols,
          totalAssistencias,
          totalVitorias,
        };
      });

      // Stats
      const totalGols = jogosComMidia.reduce((s, j) => s + (j.gols_marcados || 0), 0);
      const totalAssistencias = jogosComMidia.reduce((s, j) => s + (j.assistencias || 0), 0);
      const totalVitorias = jogosComMidia.filter(
        (j) =>
          (j.placar_time_atleta ?? 0) > (j.placar_adversario ?? 0) &&
          j.placar_time_atleta != null &&
          j.placar_adversario != null,
      ).length;
      const posCount = new Map<PosicaoJogo, number>();
      jogosComMidia.forEach((j) => {
        if (j.posicao_jogo) posCount.set(j.posicao_jogo, (posCount.get(j.posicao_jogo) || 0) + 1);
      });
      const posicoesMais = Array.from(posCount.entries())
        .map(([posicao, vezes]) => ({ posicao, vezes }))
        .sort((a, b) => b.vezes - a.vezes);

      const jogosVolei = jogosComMidia.filter((j) => isModalidadeVolei((j as any).modalidade));
      const jogosLibero = jogosVolei.filter((j) => j.posicao_jogo === 'libero');
      const jogosVoleiNaoLibero = jogosVolei.filter((j) => j.posicao_jogo !== 'libero');
      const jogosBasquete = jogosComMidia.filter((j) => isModalidadeBasquete((j as any).modalidade));

      const estatisticas: EstatisticasAtleta = {
        totalJogos: jogosComMidia.length,
        totalGols,
        totalAssistencias,
        totalVitorias,
        totalCampeonatos: campeonatos.length,
        posicoesMais,
        jogosComoGoleiro: jogosComMidia.filter((j) => j.posicao_jogo === 'goleiro').length,
        totalDefesas: jogosComMidia.reduce((s, j) => s + (j.posicao_jogo === 'goleiro' ? (j.defesas_importantes || 0) : 0), 0),
        totalGolsSofridos: jogosComMidia.reduce((s, j) => s + (j.posicao_jogo === 'goleiro' ? (j.gols_sofridos || 0) : 0), 0),
        totalPenaltisDefendidos: jogosComMidia.reduce((s, j) => s + (j.posicao_jogo === 'goleiro' ? ((j.penaltis_defendidos || 0) + (j.penaltis_defendidos_disputa || 0)) : 0), 0),
        minutosTotais: jogosComMidia.reduce((s, j) => s + (j.posicao_jogo === 'goleiro' ? (j.minutos_jogados || 0) : 0), 0),
        jogosComProrrogacao: jogosComMidia.filter((j) => j.teve_prorrogacao).length,
        totalGolsPenalti: jogosComMidia.reduce((s, j) => s + (j.posicao_jogo !== 'goleiro' ? (j.gols_penalti || 0) : 0), 0),
        totalPenaltisConvertidosDisputa: jogosComMidia.reduce((s, j) => s + (j.posicao_jogo !== 'goleiro' ? (j.penaltis_convertidos_disputa || 0) : 0), 0),
        totalPontosAtaque: jogosVoleiNaoLibero.reduce((s, j) => s + (j.pontos_ataque || 0), 0),
        totalPontosBloqueio: jogosVoleiNaoLibero.reduce((s, j) => s + (j.pontos_bloqueio || 0), 0),
        totalPontosSaque: jogosVoleiNaoLibero.reduce((s, j) => s + (j.pontos_saque || 0), 0),
        totalErrosCometidos: jogosVoleiNaoLibero.reduce((s, j) => s + (j.erros_cometidos || 0), 0),
        jogosComoLibero: jogosLibero.length,
        totalRecepcoes: jogosLibero.reduce((s, j) => s + (j.recepcoes_realizadas || 0), 0),
        totalDefesasVolei: jogosLibero.reduce((s, j) => s + (j.defesas_realizadas || 0), 0),
        totalErrosRecepcao: jogosLibero.reduce((s, j) => s + (j.erros_recepcao || 0), 0),
        totalPontosBasquete: jogosBasquete.reduce((s, j) => s + (j.pontos || 0), 0),
        totalRebotesOfensivos: jogosBasquete.reduce((s, j) => s + (j.rebotes_ofensivos || 0), 0),
        totalRebotesDefensivos: jogosBasquete.reduce((s, j) => s + (j.rebotes_defensivos || 0), 0),
        totalRoubosBola: jogosBasquete.reduce((s, j) => s + (j.roubos_bola || 0), 0),
        totalTocos: jogosBasquete.reduce((s, j) => s + (j.tocos || 0), 0),
      };

    return { campeonatos: campeonatosComJogos, amistosos, estatisticas };
  }, [criancaId]);

  const query = useQuery({
    queryKey,
    queryFn: fetchJornada,
    enabled: !!criancaId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const data = query.data ?? EMPTY;
  const isLoading = query.isLoading;
  const error = query.error ? (query.error as Error).message : null;

  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey });
  }, [queryClient, criancaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, criancaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: refetch automaticamente ao detectar mudanças nas tabelas da Jornada
  const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!criancaId) return;
    const debouncedInvalidate = () => {
      if (invalidateTimer.current) clearTimeout(invalidateTimer.current);
      invalidateTimer.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['jornada', criancaId] });
      }, 300);
    };
    const channel = supabase
      .channel(`jornada-${criancaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'carreira_campeonatos', filter: `crianca_id=eq.${criancaId}` },
        debouncedInvalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'carreira_jogos', filter: `crianca_id=eq.${criancaId}` },
        debouncedInvalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'carreira_jogo_midias' },
        debouncedInvalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'carreira_campeonato_premiacoes', filter: `crianca_id=eq.${criancaId}` },
        debouncedInvalidate,
      )
      .subscribe();
    return () => {
      if (invalidateTimer.current) clearTimeout(invalidateTimer.current);
      supabase.removeChannel(channel);
    };
  }, [criancaId, queryClient]);

  const criarCampeonato = useCallback(
    async (input: CreateCampeonatoInput): Promise<string> => {
      if (!criancaId) throw new Error('Atleta não definido');
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');
      const { data: inserted, error } = await (supabase as any).from('carreira_campeonatos').insert({
        crianca_id: criancaId,
        criado_por: uid,
        nome: input.nome,
        organizador: input.organizador,
        abrangencia: input.abrangencia,
        data_inicio: input.data_inicio,
        data_final: input.data_final,
        logo_url: input.logo_url ?? null,
        posicao_final: input.posicao_final ?? null,
        categoria: input.categoria ?? null,
        nome_time: input.nome_time ?? null,
        modalidade: input.modalidade,
      }).select('id').single();
      if (error) throw error;
      await fetchData();
      return inserted.id as string;
    },
    [criancaId, fetchData],
  );

  const editarCampeonato = useCallback(
    async (id: string, input: CreateCampeonatoInput) => {
      const { error } = await (supabase as any)
        .from('carreira_campeonatos')
        .update({
          nome: input.nome,
          organizador: input.organizador,
          abrangencia: input.abrangencia,
          data_inicio: input.data_inicio,
          data_final: input.data_final,
          logo_url: input.logo_url ?? null,
          posicao_final: input.posicao_final ?? null,
          categoria: input.categoria ?? null,
          nome_time: input.nome_time ?? null,
          modalidade: input.modalidade,
        })
        .eq('id', id);
      if (error) throw error;
      await fetchData();
    },
    [fetchData],
  );

  const adicionarPremiacaoCampeonato = useCallback(
    async (input: CreateCampeonatoPremiacaoInput) => {
      if (!criancaId) throw new Error('Atleta não definido');
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');
      const { error } = await (supabase as any).from('carreira_campeonato_premiacoes').insert({
        campeonato_id: input.campeonato_id,
        crianca_id: criancaId,
        criado_por: uid,
        tipo_premiacao: input.tipo_premiacao,
        titulo: input.titulo ?? null,
        jogo_id: input.jogo_id ?? null,
      });
      if (error) throw error;
      await fetchData();
    },
    [criancaId, fetchData],
  );

  const excluirPremiacaoCampeonato = useCallback(
    async (id: string) => {
      const { error } = await (supabase as any).from('carreira_campeonato_premiacoes').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    },
    [fetchData],
  );

  const criarJogo = useCallback(
    async (input: CreateJogoInput): Promise<string> => {
      if (!criancaId) throw new Error('Atleta não definido');
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');
      const { data: inserted, error } = await (supabase as any)
        .from('carreira_jogos')
        .insert({
          crianca_id: criancaId,
          criado_por: uid,
          campeonato_id: input.campeonato_id || null,
          tipo_jogo: input.campeonato_id ? 'campeonato' : 'amistoso',
          modalidade: input.modalidade,
          data_jogo: input.data_jogo,
          time_adversario: input.time_adversario,
          time_atleta: input.time_atleta ?? null,
          local: input.local,
          placar_time_atleta: input.placar_time_atleta,
          placar_adversario: input.placar_adversario,
          gols_marcados: input.gols_marcados,
          assistencias: input.assistencias,
          posicao_jogo: input.posicao_jogo,
          observacoes: input.observacoes,
          fase_campeonato: input.fase_campeonato,
        })
        .select('id')
        .single();
      if (error) throw error;
      // Atualiza campos de goleiro/vôlei se fornecidos (sem quebrar caso colunas ainda não existam)
      await (supabase as any).from('carreira_jogos').update({
        minutos_jogados: input.minutos_jogados ?? null,
        gols_sofridos: input.gols_sofridos ?? null,
        defesas_importantes: input.defesas_importantes ?? null,
        penaltis_defendidos: input.penaltis_defendidos ?? null,
        teve_prorrogacao: input.teve_prorrogacao ?? null,
        teve_disputa_penaltis: input.teve_disputa_penaltis ?? null,
        placar_penaltis_time: input.placar_penaltis_time ?? null,
        placar_penaltis_adversario: input.placar_penaltis_adversario ?? null,
        penaltis_defendidos_disputa: input.penaltis_defendidos_disputa ?? null,
        penaltis_gol_lado_correto: input.penaltis_gol_lado_correto ?? null,
        penaltis_gol_lado_errado: input.penaltis_gol_lado_errado ?? null,
        gols_penalti: input.gols_penalti ?? null,
        penaltis_convertidos_disputa: input.penaltis_convertidos_disputa ?? null,
        pontos_ataque: input.pontos_ataque ?? null,
        pontos_bloqueio: input.pontos_bloqueio ?? null,
        pontos_saque: input.pontos_saque ?? null,
        erros_cometidos: input.erros_cometidos ?? null,
        recepcoes_realizadas: input.recepcoes_realizadas ?? null,
        defesas_realizadas: input.defesas_realizadas ?? null,
        erros_recepcao: input.erros_recepcao ?? null,
        sets_detalhe: input.sets_detalhe ?? null,
        pontos: input.pontos ?? null,
        rebotes_ofensivos: input.rebotes_ofensivos ?? null,
        rebotes_defensivos: input.rebotes_defensivos ?? null,
        roubos_bola: input.roubos_bola ?? null,
        tocos: input.tocos ?? null,
        faltas_cometidas: input.faltas_cometidas ?? null,
        arremessos_2pt_tentados: input.arremessos_2pt_tentados ?? null,
        arremessos_2pt_convertidos: input.arremessos_2pt_convertidos ?? null,
        arremessos_3pt_tentados: input.arremessos_3pt_tentados ?? null,
        arremessos_3pt_convertidos: input.arremessos_3pt_convertidos ?? null,
        lances_livres_tentados: input.lances_livres_tentados ?? null,
        lances_livres_convertidos: input.lances_livres_convertidos ?? null,
        quartos_detalhe: input.quartos_detalhe ?? null,
      }).eq('id', inserted.id);
      await fetchData();
      return inserted.id as string;
    },
    [criancaId, fetchData],
  );

  const editarJogo = useCallback(
    async (id: string, input: CreateJogoInput) => {
      const { error } = await (supabase as any)
        .from('carreira_jogos')
        .update({
          campeonato_id: input.campeonato_id || null,
          tipo_jogo: input.campeonato_id ? 'campeonato' : 'amistoso',
          modalidade: input.modalidade,
          data_jogo: input.data_jogo,
          time_adversario: input.time_adversario,
          time_atleta: input.time_atleta ?? null,
          local: input.local,
          placar_time_atleta: input.placar_time_atleta,
          placar_adversario: input.placar_adversario,
          gols_marcados: input.gols_marcados,
          assistencias: input.assistencias,
          posicao_jogo: input.posicao_jogo,
          observacoes: input.observacoes,
          fase_campeonato: input.fase_campeonato,
          minutos_jogados: input.minutos_jogados ?? null,
          gols_sofridos: input.gols_sofridos ?? null,
          defesas_importantes: input.defesas_importantes ?? null,
          penaltis_defendidos: input.penaltis_defendidos ?? null,
          teve_prorrogacao: input.teve_prorrogacao ?? null,
          teve_disputa_penaltis: input.teve_disputa_penaltis ?? null,
          placar_penaltis_time: input.placar_penaltis_time ?? null,
          placar_penaltis_adversario: input.placar_penaltis_adversario ?? null,
          penaltis_defendidos_disputa: input.penaltis_defendidos_disputa ?? null,
          penaltis_gol_lado_correto: input.penaltis_gol_lado_correto ?? null,
          penaltis_gol_lado_errado: input.penaltis_gol_lado_errado ?? null,
          gols_penalti: input.gols_penalti ?? null,
          penaltis_convertidos_disputa: input.penaltis_convertidos_disputa ?? null,
          pontos_ataque: input.pontos_ataque ?? null,
          pontos_bloqueio: input.pontos_bloqueio ?? null,
          pontos_saque: input.pontos_saque ?? null,
          erros_cometidos: input.erros_cometidos ?? null,
          recepcoes_realizadas: input.recepcoes_realizadas ?? null,
          defesas_realizadas: input.defesas_realizadas ?? null,
          erros_recepcao: input.erros_recepcao ?? null,
          sets_detalhe: input.sets_detalhe ?? null,
          pontos: input.pontos ?? null,
          rebotes_ofensivos: input.rebotes_ofensivos ?? null,
          rebotes_defensivos: input.rebotes_defensivos ?? null,
          roubos_bola: input.roubos_bola ?? null,
          tocos: input.tocos ?? null,
          faltas_cometidas: input.faltas_cometidas ?? null,
          arremessos_2pt_tentados: input.arremessos_2pt_tentados ?? null,
          arremessos_2pt_convertidos: input.arremessos_2pt_convertidos ?? null,
          arremessos_3pt_tentados: input.arremessos_3pt_tentados ?? null,
          arremessos_3pt_convertidos: input.arremessos_3pt_convertidos ?? null,
          lances_livres_tentados: input.lances_livres_tentados ?? null,
          lances_livres_convertidos: input.lances_livres_convertidos ?? null,
          quartos_detalhe: input.quartos_detalhe ?? null,
        })
        .eq('id', id);
      if (error) throw error;
      await fetchData();
    },
    [fetchData],
  );

  const uploadArquivo = useCallback(
    async (file: File, subdir: 'campeonatos' | 'jogos'): Promise<string> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');
      // Comprime imagens antes do upload (vídeos passam intactos)
      const toUpload = file.type.startsWith('image/')
        ? await compressImage(file, { maxWidth: 1600, quality: 0.82 })
        : file;
      const ext = (toUpload.type === 'image/jpeg' ? 'jpg' : (toUpload.name.split('.').pop() || 'bin'));
      const path = `${uid}/${subdir}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('jornada-midias').upload(path, toUpload, {
        contentType: toUpload.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('jornada-midias').getPublicUrl(path);
      return data.publicUrl;
    },
    [],
  );

  const adicionarMidiasJogo = useCallback(
    async (jogoId: string, files: File[]) => {
      if (!files.length) return;
      const rows: { jogo_id: string; tipo_midia: 'foto' | 'video'; url: string; ordem: number }[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const url = await uploadArquivo(f, 'jogos');
        rows.push({
          jogo_id: jogoId,
          tipo_midia: f.type.startsWith('video') ? 'video' : 'foto',
          url,
          ordem: i,
        });
      }
      const { error } = await (supabase as any).from('carreira_jogo_midias').insert(rows);
      if (error) throw error;
      await fetchData();
    },
    [uploadArquivo, fetchData],
  );

  const adicionarMidia = useCallback(
    async (input: CreateJogoMidiaInput) => {
      const { error } = await (supabase as any).from('carreira_jogo_midias').insert({
        jogo_id: input.jogo_id,
        tipo_midia: input.tipo_midia,
        url: input.url_midia,
        ordem: input.ordem,
      });
      if (error) throw error;
      await fetchData();
    },
    [fetchData],
  );

  const excluirCampeonato = useCallback(
    async (id: string) => {
      const { error } = await (supabase as any).from('carreira_campeonatos').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    },
    [fetchData],
  );

  const excluirJogo = useCallback(
    async (id: string) => {
      // Mídias deletadas em cascata se FK existir; senão tentamos manualmente
      await (supabase as any).from('carreira_jogo_midias').delete().eq('jogo_id', id);
      const { error } = await (supabase as any).from('carreira_jogos').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    },
    [fetchData],
  );

  const excluirMidia = useCallback(
    async (id: string) => {
      const { error } = await (supabase as any).from('carreira_jogo_midias').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    },
    [fetchData],
  );

  return {
    data,
    isLoading,
    error,
    fetchData,
    criarCampeonato,
    editarCampeonato,
    criarJogo,
    editarJogo,
    adicionarMidia,
    adicionarMidiasJogo,
    uploadArquivo,
    excluirCampeonato,
    excluirJogo,
    excluirMidia,
    adicionarPremiacaoCampeonato,
    excluirPremiacaoCampeonato,
  };
}
