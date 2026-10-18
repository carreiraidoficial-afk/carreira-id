import type { PerfilAtleta } from '@/hooks/useCarreiraData';
import { POSICAO_LABELS, POSICOES_PODIO, type CurriculoData, type CurriculoPremiacao, type CurriculoTema } from './CurriculoDocument';
import type { CurriculoJogo, CurriculoMidia } from './CurriculoCompletoDocument';
import { imagemParaDataUrl, registrarFontesCurriculo } from './curriculo-assets';

export type CurriculoModelo = 'resumo' | 'completo';

export interface DadosParaCurriculo {
  perfil: PerfilAtleta;
  idade: number | null;
  /** Dados já carregados na tela (experiências, estatísticas e jornada). */
  experiencias: any[];
  stats: any;
  jornada: { campeonatos: any[]; amistosos: any[] };
}

export interface OpcoesCurriculo {
  modelo: CurriculoModelo;
  tema: CurriculoTema;
  /** Só vale no modelo completo; e só entra se o perfil for público. */
  incluirVideos: boolean;
}

const rotuloPremiacao = (tipo: string | null | undefined) =>
  (tipo || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** "20/09 · PHJ Academy 3x3 Bangu · 2ª Rodada": lembra em que jogo foi. */
function detalheDoJogo(j: any): string | null {
  const data = j.data_jogo ? `${String(j.data_jogo).slice(8, 10)}/${String(j.data_jogo).slice(5, 7)}` : null;
  const placar = j.placar_time_atleta != null && j.placar_adversario != null ? `${j.placar_time_atleta}x${j.placar_adversario}` : 'x';
  const confronto = j.time_adversario ? [j.time_atleta, placar, j.time_adversario].filter(Boolean).join(' ') : null;
  return [data, confronto, j.fase_campeonato].filter(Boolean).join(' · ') || null;
}

function paraJogo(j: any, campeonato: { id: string; nome: string } | null): CurriculoJogo {
  const penaltis = j.teve_disputa_penaltis && j.placar_penaltis_time != null
    ? { pro: j.placar_penaltis_time as number, contra: (j.placar_penaltis_adversario ?? 0) as number }
    : null;
  const reb = (j.rebotes_ofensivos || 0) + (j.rebotes_defensivos || 0);
  return {
    campeonatoId: campeonato?.id ?? null,
    data: j.data_jogo,
    competicao: campeonato?.nome ?? null,
    fase: j.fase_campeonato ?? null,
    meuTime: j.time_atleta ?? null,
    adversario: j.time_adversario ?? null,
    golsPro: j.placar_time_atleta ?? null,
    golsContra: j.placar_adversario ?? null,
    penaltis,
    posicao: j.posicao_jogo ?? null,
    minutos: j.minutos_jogados ?? null,
    gols: j.gols_marcados ?? null,
    assistencias: j.assistencias ?? null,
    defesas: j.defesas_importantes ?? null,
    golsSofridos: j.gols_sofridos ?? null,
    pontosAtaque: j.pontos_ataque ?? null,
    pontosBloqueio: j.pontos_bloqueio ?? null,
    pontosSaque: j.pontos_saque ?? null,
    pontos: j.pontos ?? null,
    rebotes: reb || null,
    roubos: j.roubos_bola ?? null,
    destaque: !!j.destaque_jogo,
    local: j.local ?? null,
  };
}

export interface CurriculoPdfPronto {
  blob: Blob;
  nomeArquivo: string;
}

/** Monta o PDF no navegador (sem baixar), para mostrar a prévia e baixar o mesmo arquivo depois. */
export async function montarCurriculoPdf(dados: DadosParaCurriculo, opcoes: OpcoesCurriculo): Promise<CurriculoPdfPronto> {
  const { perfil, idade, experiencias, stats, jornada } = dados;
  const [{ pdf }, resumoMod, completoMod, qr] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./CurriculoDocument'),
    opcoes.modelo === 'completo' ? import('./CurriculoCompletoDocument') : Promise.resolve(null),
    import('qrcode'),
    registrarFontesCurriculo(),
  ]);
  const QRCode: any = (qr as any).default ?? qr;

  const exps = (experiencias || []).map((exp: any) => ({
    nomeEscola: exp.nome_escola,
    dataInicio: exp.data_inicio,
    dataFim: exp.data_fim,
    atual: exp.atual,
    categoria: exp.categoria_instituicao,
    cidade: exp.cidade,
    estado: exp.estado,
    posicao: exp.posicao_jogada || null,
    logoUrl: exp.logo_url || null,
  }));
  const camps: any[] = jornada.campeonatos || [];
  const limiteClubes = opcoes.modelo === 'completo' ? exps.length : 4;

  const [fotoUrl, qrCodeUrl, logoUrl, ...logosClubes] = await Promise.all([
    imagemParaDataUrl(perfil.foto_url, { cortar: { largura: 512, altura: 640 } }),
    QRCode.toDataURL(`https://carreiraid.com.br/${perfil.slug}`, { margin: 1, width: 300 }),
    imagemParaDataUrl('/logo-carreira-id-email.png', { ladoMaximo: 400, formato: 'png' }),
    ...exps.slice(0, limiteClubes).map((x: any) => imagemParaDataUrl(x.logoUrl, { ladoMaximo: 96, formato: 'png' })),
  ]);

  // Premiações = sala de troféus: pódio coletivo (campeão, vice, 3º) + prêmios individuais + cada partida em que foi destaque,
  // sempre dentro do campeonato correspondente (campeonatos mais recentes primeiro).
  const jogosDestaque: any[] = [
    ...camps.flatMap((c) => (c.jogos || []).map((j: any) => ({ j, camp: c }))),
  ].filter(({ j }) => j.destaque_jogo);
  const trofeus: CurriculoPremiacao[] = [...camps]
    .sort((a, b) => (b.data_final || b.data_inicio || '').localeCompare(a.data_final || a.data_inicio || ''))
    .flatMap((c) => {
      const itens: CurriculoPremiacao[] = [];
      const anoCamp = Number((c.data_final || c.data_inicio || '').slice(0, 4)) || null;
      if (POSICOES_PODIO.includes(c.posicao_final)) {
        itens.push({ titulo: POSICAO_LABELS[c.posicao_final], campeonato: c.nome, tipo: 'coletivo', ano: anoCamp });
      }
      (c.premiacoes || []).forEach((p: any) =>
        itens.push({ titulo: p.titulo || rotuloPremiacao(p.tipo_premiacao), campeonato: c.nome, tipo: 'individual', ano: anoCamp }),
      );
      jogosDestaque
        .filter(({ camp }) => camp.id === c.id)
        .sort((x, y) => (x.j.data_jogo || '').localeCompare(y.j.data_jogo || ''))
        .forEach(({ j }) =>
          itens.push({
            titulo: 'Destaque do jogo',
            campeonato: c.nome,
            tipo: 'destaque_jogo',
            ano: anoCamp,
            detalhe: detalheDoJogo(j),
          }),
        );
      return itens;
    });

  const base: CurriculoData = {
    nome: perfil.nome,
    fotoUrl,
    modalidade: perfil.modalidade,
    modalidades: perfil.modalidades || undefined,
    categoria: perfil.categoria,
    cidade: perfil.cidade,
    estado: perfil.estado,
    pais: perfil.pais,
    idade,
    slug: perfil.slug,
    bio: perfil.bio,
    posicaoPrincipal: perfil.posicao_principal,
    posicaoSecundaria: perfil.posicao_secundaria,
    peDominante: perfil.pe_dominante,
    corDestaque: perfil.cor_destaque,
    instagram: perfil.instagram_url,
    qrCodeUrl,
    logoUrl,
    tema: opcoes.tema,
    stats: {
      totalJogos: stats.totalJogos,
      totalGols: stats.totalGols,
      totalAssistencias: stats.totalAssistencias,
      totalVitorias: stats.totalVitorias,
      totalCampeonatos: stats.totalCampeonatos,
      totalPremiacoes: trofeus.length,
      jogosComoGoleiro: stats.jogosComoGoleiro,
      totalDefesas: stats.totalDefesas,
      totalGolsSofridos: stats.totalGolsSofridos,
      totalPenaltisDefendidos: stats.totalPenaltisDefendidos,
    },
    experiencias: exps.map((x: any, i: number) => ({ ...x, logoUrl: logosClubes[i] ?? null })),
    premiacoes: trofeus,
    campeonatos: camps.map((camp) => ({
      nome: camp.nome,
      organizador: camp.organizador || null,
      dataInicio: camp.data_inicio,
      posicaoFinal: camp.posicao_final || null,
      categoria: camp.categoria || null,
      nomeTime: camp.nome_time || null,
    })),
  };

  let documento: React.ReactElement;
  if (opcoes.modelo === 'completo' && completoMod) {
    const jogosBrutos: { j: any; camp: { id: string; nome: string } | null }[] = [
      ...camps.flatMap((c) => (c.jogos || []).map((j: any) => ({ j, camp: { id: c.id as string, nome: c.nome as string } }))),
      ...(jornada.amistosos || []).map((j: any) => ({ j, camp: null })),
    ];
    const jogos = jogosBrutos.map(({ j, camp }) => paraJogo(j, camp));

    // Vídeos: link direto e permanente; só entram se o perfil for público e o dono quiser
    const perfilPublico = perfil.is_public !== false;
    const midias: CurriculoMidia[] = opcoes.incluirVideos && perfilPublico
      ? jogosBrutos.flatMap(({ j }, i) =>
          (j.midias || [])
            .filter((m: any) => (m.tipo_midia === 'video' || m.tipo_midia === 'foto') && (m.url_midia || m.url))
            .map((m: any) => {
              const jg = jogos[i];
              const placar = jg.golsPro != null && jg.golsContra != null ? `${jg.golsPro}x${jg.golsContra}` : '';
              return {
                tipo: m.tipo_midia as 'video' | 'foto',
                url: (m.url_midia || m.url) as string,
                rotulo: [jg.competicao || 'Amistoso', [jg.meuTime, placar, jg.adversario].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
                data: jg.data,
              };
            }),
        )
      : [];

    const { CurriculoCompletoDocument } = completoMod;
    documento = (
      <CurriculoCompletoDocument
        data={{
          ...base,
          jogos,
          midias,
          campeonatosDetalhe: camps.map((c) => ({
            id: c.id,
            nome: c.nome,
            organizador: c.organizador || null,
            dataInicio: c.data_inicio,
            posicaoFinal: c.posicao_final || null,
            categoria: c.categoria || null,
            nomeTime: c.nome_time || null,
          })),
        }}
      />
    );
  } else {
    const { CurriculoDocument } = resumoMod;
    documento = <CurriculoDocument data={base} />;
  }

  const blob = await pdf(documento).toBlob();
  return { blob, nomeArquivo: `curriculo-${opcoes.modelo}-${perfil.slug}-${opcoes.tema}.pdf` };
}

export function baixarCurriculoPdf({ blob, nomeArquivo }: CurriculoPdfPronto): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Monta o PDF no navegador e baixa o arquivo. */
export async function gerarCurriculoPdf(dados: DadosParaCurriculo, opcoes: OpcoesCurriculo): Promise<void> {
  baixarCurriculoPdf(await montarCurriculoPdf(dados, opcoes));
}
