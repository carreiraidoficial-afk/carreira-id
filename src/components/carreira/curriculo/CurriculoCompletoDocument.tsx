import { Document, Page, Text, View, Image, StyleSheet, Link } from '@react-pdf/renderer';
import {
  ano, arroba, corValida, formatDate, limpar, MEDALHA, paleta, POSICAO_LABELS, POSICOES_PODIO,
  type CurriculoData, type CurriculoTema,
} from './CurriculoDocument';

const FONTE = 'PlusJakarta';

export interface CurriculoJogo {
  campeonatoId: string | null;
  data: string;
  competicao: string | null;
  fase: string | null;
  meuTime: string | null;
  adversario: string | null;
  golsPro: number | null;
  golsContra: number | null;
  /** Placar da disputa de pênaltis, quando houve. */
  penaltis?: { pro: number; contra: number } | null;
  posicao: string | null;
  minutos: number | null;
  // Futebol / futsal
  gols: number | null;
  assistencias: number | null;
  // Goleiro
  defesas: number | null;
  golsSofridos: number | null;
  // Vôlei
  pontosAtaque?: number | null;
  pontosBloqueio?: number | null;
  pontosSaque?: number | null;
  // Basquete
  pontos?: number | null;
  rebotes?: number | null;
  roubos?: number | null;
  destaque?: boolean;
  local?: string | null;
}

export interface CurriculoMidia {
  tipo: 'video' | 'foto';
  url: string;
  /** Ex.: "Semifinal · PHJ Academy 4x3 PSG Barra" */
  rotulo: string;
  data: string;
}

export interface CurriculoCampeonatoDetalhe {
  id: string;
  nome: string;
  organizador: string | null;
  dataInicio: string;
  posicaoFinal: string | null;
  categoria: string | null;
  nomeTime: string | null;
}

export interface CurriculoCompletoData extends CurriculoData {
  jogos: CurriculoJogo[];
  midias: CurriculoMidia[];
  campeonatosDetalhe: CurriculoCampeonatoDetalhe[];
}

type Resultado = 'V' | 'E' | 'D' | null;
const resultado = (j: CurriculoJogo): Resultado =>
  j.golsPro == null || j.golsContra == null ? null : j.golsPro > j.golsContra ? 'V' : j.golsPro < j.golsContra ? 'D' : 'E';

/** Etapas escritas à mão ("Semi Final", "Segunda rordada"...) viram um nome padrão. */
export function normalizarFase(fase: string | null | undefined): string {
  const bruto = limpar(fase);
  if (!bruto) return '';
  const s = bruto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/semi/.test(s)) return 'Semifinal';
  if (/quartas/.test(s)) return 'Quartas de final';
  if (/oitavas/.test(s)) return 'Oitavas de final';
  if (/^final$|^a final$/.test(s)) return 'Final';
  if (/terceiro lugar|3 lugar|disputa.*3/.test(s)) return 'Disputa de 3º lugar';
  if (/grupo/.test(s)) return 'Fase de grupos';
  if (/classificat/.test(s)) return 'Classificatório';
  // "Primeira rodada", "1ª Rodada", "Segunda rordada" (erro de digitação)... : o número manda, desde que fale de rodada
  const falaDeRodada = /r.?o?.?d|rod|rda/.test(s);
  if (falaDeRodada && /^(primeira|1)/.test(s)) return '1ª rodada';
  if (falaDeRodada && /^(segunda|2)/.test(s)) return '2ª rodada';
  if (falaDeRodada && /^(terceira|3)/.test(s)) return '3ª rodada';
  return bruto.charAt(0).toUpperCase() + bruto.slice(1);
}

interface ColunaJogo {
  rotulo: string;
  largura: number;
  valor: (j: CurriculoJogo) => number | null | undefined;
}

/** Colunas de desempenho do jogo, conforme o esporte e a posição. */
function colunasDesempenho(d: CurriculoCompletoData): ColunaJogo[] {
  const mods = `${d.modalidade || ''} ${(d.modalidades || []).join(' ')}`.toLowerCase();
  const ehGoleiro = /goleir/i.test(d.posicaoPrincipal || '') || d.jogos.some((j) => (j.defesas ?? 0) > 0);
  if (/v[oô]lei/.test(mods)) {
    return [
      { rotulo: 'Ataque', largura: 32, valor: (j) => j.pontosAtaque },
      { rotulo: 'Bloq.', largura: 30, valor: (j) => j.pontosBloqueio },
      { rotulo: 'Saque', largura: 30, valor: (j) => j.pontosSaque },
    ];
  }
  if (/basquete/.test(mods)) {
    return [
      { rotulo: 'Pts', largura: 28, valor: (j) => j.pontos },
      { rotulo: 'Reb', largura: 28, valor: (j) => j.rebotes },
      { rotulo: 'Rou', largura: 28, valor: (j) => j.roubos },
    ];
  }
  if (ehGoleiro) {
    return [
      { rotulo: 'Def', largura: 32, valor: (j) => j.defesas },
      { rotulo: 'GS', largura: 28, valor: (j) => j.golsSofridos },
    ];
  }
  return [
    { rotulo: 'Gols', largura: 32, valor: (j) => j.gols },
    { rotulo: 'Ast', largura: 28, valor: (j) => j.assistencias },
  ];
}

function criarEstilos(p: ReturnType<typeof paleta>) {
  return StyleSheet.create({
    page: { fontFamily: FONTE, fontSize: 9, color: p.texto, backgroundColor: p.pagina, paddingTop: 44, paddingBottom: 64 },
    cabecalhoFixo: { position: 'absolute', top: 0, left: 0, right: 0, height: 34, backgroundColor: p.faixa, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32 },
    cabecalhoNome: { fontSize: 9, fontWeight: 700, color: '#FFFFFF' },
    cabecalhoTipo: { fontSize: 7, fontWeight: 600, color: p.acento, letterSpacing: 1.6, textTransform: 'uppercase' },
    cabecalhoBarra: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: p.acento },
    // Capa (só página 1)
    faixa: { backgroundColor: p.faixa, height: 168, paddingHorizontal: 32, paddingTop: 26, position: 'relative', marginTop: -44 },
    acentoBarra: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, backgroundColor: p.acento },
    acentoCanto: { position: 'absolute', right: -40, top: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: p.acento, opacity: 0.16 },
    topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    logo: { width: 104, height: 26, objectFit: 'contain' },
    marca: { fontSize: 11, fontWeight: 800, color: '#FFFFFF', letterSpacing: 1.2 },
    tipoDoc: { fontSize: 7.5, fontWeight: 600, color: p.acento, letterSpacing: 2, textTransform: 'uppercase' },
    heroTexto: { position: 'absolute', left: 190, right: 32, top: 66 },
    nome: { fontSize: 25, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.1 },
    linhaEsporte: { fontSize: 11, fontWeight: 600, color: p.acento, marginTop: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 9 },
    chip: { fontSize: 8, fontWeight: 600, color: '#E5E7EB', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, marginRight: 5, marginBottom: 4 },
    foto: { position: 'absolute', left: 32, top: 62, width: 128, height: 160, borderRadius: 14, borderWidth: 4, borderColor: p.pagina, objectFit: 'cover' },
    fotoVazia: { position: 'absolute', left: 32, top: 62, width: 128, height: 160, borderRadius: 14, borderWidth: 4, borderColor: p.pagina, backgroundColor: p.acento, alignItems: 'center', justifyContent: 'center' },
    fotoInicial: { fontSize: 54, fontWeight: 800, color: '#FFFFFF' },
    bioBox: { paddingLeft: 32 + 128 + 24, paddingRight: 32, minHeight: 36, marginTop: 14 },
    bio: { fontSize: 9.5, lineHeight: 1.5, color: p.suave },
    corpo: { paddingHorizontal: 32 },
    secao: { marginTop: 14 },
    secaoTitulo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    secaoTraco: { width: 16, height: 3, borderRadius: 2, backgroundColor: p.acento, marginRight: 7 },
    secaoTexto: { fontSize: 9, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase', color: p.texto },
    secaoNota: { marginLeft: 'auto', fontSize: 7.5, fontWeight: 600, color: p.suave },
    // Números
    numerosFaixa: { flexDirection: 'row', backgroundColor: p.cartao, borderRadius: 10, borderTopWidth: 2, borderTopColor: p.acento, paddingVertical: 7 },
    numeroCelula: { flex: 1, alignItems: 'center' },
    numeroDivisor: { borderLeftWidth: 0.5, borderLeftColor: p.linha },
    numeroValor: { fontSize: 16, fontWeight: 800, color: p.texto, lineHeight: 1 },
    numeroRotulo: { fontSize: 6.5, fontWeight: 600, color: p.suave, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
    // Tabelas
    th: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, backgroundColor: p.cartao, borderRadius: 6, marginBottom: 2 },
    thTxt: { fontSize: 7, fontWeight: 800, color: p.suave, textTransform: 'uppercase', letterSpacing: 0.6 },
    tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.6, borderBottomColor: p.linha },
    td: { fontSize: 8.5, color: p.texto },
    tdSuave: { fontSize: 7.5, color: p.suave, marginTop: 1 },
    centro: { textAlign: 'center' },
    // Campanhas
    camp: { flexDirection: 'row', backgroundColor: p.cartao, borderRadius: 9, padding: 9, marginBottom: 6 },
    campLogo: { width: 28, height: 28, borderRadius: 5, marginRight: 9, objectFit: 'contain' },
    campNome: { fontSize: 10, fontWeight: 700, color: p.texto },
    campMeta: { fontSize: 8, color: p.suave, marginTop: 1.5 },
    campLinha: { flexDirection: 'row', marginTop: 5 },
    campStat: { fontSize: 8, color: p.suave, marginRight: 10 },
    campStatV: { fontWeight: 800, color: p.texto },
    chipPos: { fontSize: 7.5, fontWeight: 800, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 },
    // Mídias e trajetória
    midia: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 0.6, borderBottomColor: p.linha },
    midiaTipo: { fontSize: 7, fontWeight: 800, color: '#FFFFFF', backgroundColor: p.acento, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6, marginRight: 8 },
    midiaLink: { fontSize: 8.5, fontWeight: 700, color: p.acento, textDecoration: 'none' },
    clube: { flexDirection: 'row', marginBottom: 8 },
    clubeLogo: { width: 22, height: 22, borderRadius: 4, marginRight: 9, objectFit: 'contain' },
    clubePonto: { width: 9, height: 9, borderRadius: 5, backgroundColor: p.acento, marginTop: 3, marginRight: 11 },
    clubeNome: { fontSize: 10, fontWeight: 700, color: p.texto },
    clubeMeta: { fontSize: 8.5, color: p.suave, marginTop: 1.5 },
    nota: { fontSize: 7.5, color: p.suave, lineHeight: 1.5, marginTop: 6 },
    // Rodapé fixo
    rodape: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 52, backgroundColor: p.faixa, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32 },
    rodapeBarra: { position: 'absolute', left: 0, right: 0, top: 0, height: 3, backgroundColor: p.acento },
    qr: { width: 34, height: 34, borderRadius: 4, backgroundColor: '#FFFFFF', marginRight: 11 },
    rodapeTitulo: { fontSize: 8, fontWeight: 700, color: '#FFFFFF' },
    rodapeLink: { fontSize: 8, fontWeight: 800, color: p.acento, marginTop: 2 },
    rodapeDireita: { marginLeft: 'auto', fontSize: 7.5, color: '#9CA3AF', textAlign: 'right' },
  });
}

type Estilos = ReturnType<typeof criarEstilos>;

function Titulo({ texto, nota, e }: { texto: string; nota?: string; e: Estilos }) {
  return (
    <View style={e.secaoTitulo} minPresenceAhead={60}>
      <View style={e.secaoTraco} />
      <Text style={e.secaoTexto}>{texto}</Text>
      {nota ? <Text style={e.secaoNota}>{nota}</Text> : null}
    </View>
  );
}

function soma(lista: (number | null | undefined)[]): number {
  return lista.reduce<number>((s, v) => s + (typeof v === 'number' ? v : 0), 0);
}

export function CurriculoCompletoDocument({ data }: { data: CurriculoCompletoData }) {
  const tema: CurriculoTema = data.tema ?? 'claro';
  const acento = corValida(data.corDestaque);
  const p = paleta(tema, acento);
  const e = criarEstilos(p);

  const jogos = [...data.jogos].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const colunas = colunasDesempenho(data);
  const comPlacar = jogos.filter((j) => resultado(j));
  const vit = comPlacar.filter((j) => resultado(j) === 'V').length;

  // Estatística individual: só vale onde foi registrada (campo preenchido), e dizemos isso no documento
  const registrouGols = jogos.filter((j) => j.gols != null || j.assistencias != null);
  const totalGols = soma(jogos.map((j) => j.gols));
  const totalAssist = soma(jogos.map((j) => j.assistencias));
  const ehGoleiro = colunas[0]?.rotulo === 'Def';
  const ehLinha = colunas[0]?.rotulo === 'Gols';
  const jogosDestaque = jogos.filter((j) => j.destaque).length;

  const numeros: { valor: string; rotulo: string }[] = [
    { valor: String(jogos.length), rotulo: 'Jogos' },
    { valor: String(vit), rotulo: 'Vitórias' },
    ...(ehLinha && registrouGols.length ? [{ valor: String(totalGols), rotulo: 'Gols' }, { valor: String(totalAssist), rotulo: 'Assistências' }] : []),
    ...(ehGoleiro ? [{ valor: String(soma(jogos.map((j) => j.defesas))), rotulo: 'Defesas' }] : []),
    { valor: String(data.campeonatosDetalhe.length), rotulo: 'Campeonatos' },
    ...(jogosDestaque ? [{ valor: String(jogosDestaque), rotulo: 'Jogos em destaque' }] : []),
  ].slice(0, 6);

  // Temporadas (por ano do jogo)
  const anos = [...new Set(jogos.map((j) => ano(j.data)))].filter(Boolean).sort((a, b) => b.localeCompare(a));
  const temporadas = anos.map((a) => {
    const js = jogos.filter((j) => ano(j.data) === a);
    const cp = js.filter((j) => resultado(j));
    return {
      ano: a,
      jogos: js.length,
      v: cp.filter((j) => resultado(j) === 'V').length,
      e: cp.filter((j) => resultado(j) === 'E').length,
      d: cp.filter((j) => resultado(j) === 'D').length,
      gols: soma(js.map((j) => j.gols)),
      ast: soma(js.map((j) => j.assistencias)),
    };
  });

  // Campanhas por campeonato
  // Premiações agrupadas pelo campeonato, na ordem em que vieram (coletiva, individuais, destaques de jogo)
  const gruposPremiacoes: { campeonato: string; itens: NonNullable<typeof data.premiacoes> }[] = [];
  (data.premiacoes || []).forEach((pr) => {
    const nome = pr.campeonato || 'Outras conquistas';
    const grupo = gruposPremiacoes.find((g) => g.campeonato === nome);
    if (grupo) grupo.itens.push(pr);
    else gruposPremiacoes.push({ campeonato: nome, itens: [pr] });
  });

  const campanhas = [...data.campeonatosDetalhe]
    .sort((a, b) => (b.dataInicio || '').localeCompare(a.dataInicio || ''))
    .map((c) => {
      const js = jogos.filter((j) => j.campeonatoId === c.id);
      const cp = js.filter((j) => resultado(j));
      return {
        ...c,
        jogos: js.length,
        v: cp.filter((j) => resultado(j) === 'V').length,
        e: cp.filter((j) => resultado(j) === 'E').length,
        d: cp.filter((j) => resultado(j) === 'D').length,
        gp: soma(cp.map((j) => j.golsPro)),
        gc: soma(cp.map((j) => j.golsContra)),
        gols: soma(js.map((j) => j.gols)),
        registrou: js.some((j) => j.gols != null),
      };
    });

  // Vídeos do mesmo jogo ganham número ("vídeo 1", "vídeo 2") para não parecerem repetidos
  const videosBrutos = data.midias.filter((m) => m.tipo === 'video');
  const contagemVideos: Record<string, number> = {};
  const videos = videosBrutos.map((m) => {
    const total = videosBrutos.filter((x) => x.rotulo === m.rotulo).length;
    contagemVideos[m.rotulo] = (contagemVideos[m.rotulo] || 0) + 1;
    return total > 1 ? { ...m, rotulo: `${m.rotulo} (vídeo ${contagemVideos[m.rotulo]})` } : m;
  });
  const fotos = data.midias.filter((m) => m.tipo === 'foto');
  const local = [data.cidade, data.estado].filter(Boolean).join(' - ');
  const posicoes = [data.posicaoPrincipal, data.posicaoSecundaria].filter(Boolean).join(' / ');
  const linhaEsporte = [data.modalidade, posicoes, data.categoria].filter(Boolean).join('  ·  ');
  const chips = [
    data.idade ? `${data.idade} anos` : null,
    data.peDominante ? `Pé ${String(data.peDominante).toLowerCase()}` : null,
    local || null,
    data.pais && data.pais !== 'Brasil' ? data.pais : null,
  ].filter(Boolean) as string[];
  const dataGerado = new Date().toLocaleDateString('pt-BR');
  const link = `carreiraid.com.br/${data.slug}`;

  return (
    <Document title={`Currículo esportivo completo — ${data.nome}`} author="Carreira ID" subject="Currículo esportivo completo">
      <Page size="A4" style={e.page}>
        {/* Cabeçalho das páginas seguintes (não aparece na capa) */}
        <View
          fixed
          style={e.cabecalhoFixo}
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <>
                <Text style={e.cabecalhoNome}>{limpar(data.nome)}</Text>
                <Text style={e.cabecalhoTipo}>Currículo esportivo completo</Text>
                <View style={e.cabecalhoBarra} />
              </>
            ) : null
          }
        />

        {/* Capa */}
        <View style={e.faixa}>
          <View style={e.acentoCanto} />
          <View style={e.topo}>
            {data.logoUrl ? <Image src={data.logoUrl} style={e.logo} /> : <Text style={e.marca}>CARREIRA ID</Text>}
            <Text style={e.tipoDoc}>Currículo completo</Text>
          </View>
          <View style={e.heroTexto}>
            <Text style={[e.nome, limpar(data.nome).length > 26 ? { fontSize: 21 } : {}]}>{limpar(data.nome)}</Text>
            {linhaEsporte ? <Text style={e.linhaEsporte}>{linhaEsporte}</Text> : null}
            {chips.length > 0 ? <View style={e.chips}>{chips.map((c) => <Text key={c} style={e.chip}>{c}</Text>)}</View> : null}
          </View>
          <View style={e.acentoBarra} />
        </View>
        {data.fotoUrl ? (
          <Image src={data.fotoUrl} style={e.foto} />
        ) : (
          <View style={e.fotoVazia}><Text style={e.fotoInicial}>{data.nome.trim().charAt(0).toUpperCase()}</Text></View>
        )}
        <View style={e.bioBox}>{limpar(data.bio) ? <Text style={e.bio}>{limpar(data.bio)}</Text> : null}</View>

        <View style={e.corpo}>
          {/* Números */}
          <View style={e.secao}>
            <Titulo texto="Números da carreira" e={e} />
            <View style={e.numerosFaixa} wrap={false}>
              {numeros.map((n, i) => (
                <View key={n.rotulo} style={[e.numeroCelula, i > 0 ? e.numeroDivisor : {}]}>
                  <Text style={e.numeroValor}>{n.valor}</Text>
                  <Text style={e.numeroRotulo}>{n.rotulo}</Text>
                </View>
              ))}
            </View>
            {ehLinha && registrouGols.length > 0 && registrouGols.length < jogos.length ? (
              <Text style={e.nota}>
                Gols e assistências do atleta constam em {registrouGols.length} de {jogos.length} jogos (só onde foram registrados no perfil).
              </Text>
            ) : null}
          </View>

          {/* Temporadas */}
          {temporadas.length > 0 ? (
            <View style={e.secao}>
              <Titulo texto="Por temporada" e={e} />
              <View style={e.th}>
                <Text style={[e.thTxt, { width: 44 }]}>Ano</Text>
                <Text style={[e.thTxt, e.centro, { width: 44 }]}>Jogos</Text>
                <Text style={[e.thTxt, e.centro, { width: 30 }]}>V</Text>
                <Text style={[e.thTxt, e.centro, { width: 30 }]}>E</Text>
                <Text style={[e.thTxt, e.centro, { width: 30 }]}>D</Text>
                {ehLinha ? <Text style={[e.thTxt, e.centro, { width: 44 }]}>Gols</Text> : null}
                {ehLinha ? <Text style={[e.thTxt, e.centro, { width: 44 }]}>Ast</Text> : null}
              </View>
              {temporadas.map((t) => (
                <View key={t.ano} style={e.tr} wrap={false}>
                  <Text style={[e.td, { width: 44, fontWeight: 800, color: p.acento }]}>{t.ano}</Text>
                  <Text style={[e.td, e.centro, { width: 44 }]}>{t.jogos}</Text>
                  <Text style={[e.td, e.centro, { width: 30 }]}>{t.v}</Text>
                  <Text style={[e.td, e.centro, { width: 30 }]}>{t.e}</Text>
                  <Text style={[e.td, e.centro, { width: 30 }]}>{t.d}</Text>
                  {ehLinha ? <Text style={[e.td, e.centro, { width: 44 }]}>{t.gols}</Text> : null}
                  {ehLinha ? <Text style={[e.td, e.centro, { width: 44 }]}>{t.ast}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          {/* Campanhas */}
          {campanhas.length > 0 ? (
            <View style={e.secao}>
              <Titulo texto="Campeonatos disputados" nota={`${campanhas.length} no total`} e={e} />
              {campanhas.map((c) => {
                const medalha = c.posicaoFinal && POSICOES_PODIO.includes(c.posicaoFinal) ? MEDALHA[c.posicaoFinal] : undefined;
                return (
                  <View key={c.id} style={e.camp} wrap={false}>
                    <View style={{ flex: 1 }}>
                      <Text style={e.campNome}>{limpar(c.nome)}</Text>
                      <Text style={e.campMeta}>
                        {[ano(c.dataInicio), c.categoria, c.nomeTime, c.organizador ? `Org.: ${limpar(c.organizador)}` : null].filter(Boolean).join('  ·  ')}
                      </Text>
                      <View style={e.campLinha}>
                        <Text style={e.campStat}><Text style={e.campStatV}>{c.jogos}</Text> {c.jogos === 1 ? 'jogo' : 'jogos'}</Text>
                        {c.jogos > 0 ? (
                          <>
                            <Text style={e.campStat}><Text style={e.campStatV}>{c.v}V {c.e}E {c.d}D</Text></Text>
                            <Text style={e.campStat}>Gols <Text style={e.campStatV}>{c.gp}x{c.gc}</Text></Text>
                          </>
                        ) : null}
                        {ehLinha && c.registrou ? <Text style={e.campStat}>Gols do atleta <Text style={e.campStatV}>{c.gols}</Text></Text> : null}
                      </View>
                    </View>
                    {c.posicaoFinal && medalha ? (
                      <Text style={[e.chipPos, { backgroundColor: medalha.fundo, color: medalha.texto, alignSelf: 'flex-start' }]}>
                        {POSICAO_LABELS[c.posicaoFinal] || c.posicaoFinal}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Histórico de jogos */}
          {jogos.length > 0 ? (
            <View style={e.secao}>
              <Titulo texto="Histórico de jogos" nota={`${jogos.length} jogos`} e={e} />
              <View style={e.th} fixed={false}>
                <Text style={[e.thTxt, { width: 44 }]}>Data</Text>
                <Text style={[e.thTxt, { flex: 1 }]}>Competição · Partida</Text>
                <Text style={[e.thTxt, e.centro, { width: 38 }]}>Placar</Text>
                <Text style={[e.thTxt, e.centro, { width: 20 }]}>R</Text>
                {colunas.map((c) => <Text key={c.rotulo} style={[e.thTxt, e.centro, { width: c.largura }]}>{c.rotulo}</Text>)}
              </View>
              {jogos.map((j, i) => {
                const r = resultado(j);
                const cor = r === 'V' ? '#16A34A' : r === 'D' ? '#DC2626' : '#6B7280';
                const fase = normalizarFase(j.fase);
                const partida = [j.meuTime, 'x', j.adversario].filter(Boolean).join(' ');
                return (
                  <View key={i} style={e.tr} wrap={false}>
                    <Text style={[e.td, { width: 44, fontSize: 8 }]}>{j.data ? `${j.data.slice(8, 10)}/${j.data.slice(5, 7)}/${j.data.slice(2, 4)}` : ''}</Text>
                    <View style={{ flex: 1, paddingRight: 6 }}>
                      <Text style={[e.td, { fontWeight: 700 }]}>{limpar(partida)}</Text>
                      <Text style={e.tdSuave}>
                        {[j.competicao ? limpar(j.competicao) : 'Amistoso', fase || null, j.destaque ? 'Jogo em destaque' : null].filter(Boolean).join('  ·  ')}
                      </Text>
                    </View>
                    <View style={{ width: 38 }}>
                      <Text style={[e.td, e.centro, { fontWeight: 800 }]}>{r ? `${j.golsPro}x${j.golsContra}` : '—'}</Text>
                      {j.penaltis ? <Text style={[e.tdSuave, e.centro]}>pên. {j.penaltis.pro}x{j.penaltis.contra}</Text> : null}
                    </View>
                    <Text style={[e.td, e.centro, { width: 20, fontWeight: 800, color: cor }]}>{r ?? ''}</Text>
                    {colunas.map((c) => {
                      const v = c.valor(j);
                      return <Text key={c.rotulo} style={[e.td, e.centro, { width: c.largura, color: v ? p.texto : p.suave }]}>{v == null ? '—' : v}</Text>;
                    })}
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Vídeos e fotos: o PDF leva a quem recebe direto para o conteúdo */}
          {videos.length > 0 ? (
            <View style={e.secao}>
              <Titulo texto="Vídeos" nota={`${videos.length} vídeos${fotos.length ? ` · ${fotos.length} fotos no perfil` : ''}`} e={e} />
              {videos.slice(0, 12).map((m, i) => (
                <View key={i} style={e.midia} wrap={false}>
                  <Text style={e.midiaTipo}>VÍDEO</Text>
                  <Text style={[e.td, { flex: 1 }]}>{limpar(m.rotulo)}</Text>
                  <Link src={m.url} style={e.midiaLink}>Assistir</Link>
                </View>
              ))}
              {videos.length > 12 ? <Text style={e.nota}>+ {videos.length - 12} vídeos no perfil completo.</Text> : null}
            </View>
          ) : null}

          {/* Trajetória */}
          {data.experiencias.length > 0 ? (
            <View style={e.secao}>
              <Titulo texto="Trajetória" e={e} />
              {data.experiencias.map((exp, i) => (
                <View key={i} style={e.clube} wrap={false}>
                  {exp.logoUrl ? <Image src={exp.logoUrl} style={e.clubeLogo} /> : <View style={e.clubePonto} />}
                  <View style={{ flex: 1 }}>
                    <Text style={e.clubeNome}>{limpar(exp.nomeEscola)}</Text>
                    <Text style={e.clubeMeta}>
                      {[
                        `${formatDate(exp.dataInicio)} — ${exp.atual ? 'Atual' : formatDate(exp.dataFim)}`,
                        exp.categoria,
                        exp.posicao,
                        exp.cidade ? `${exp.cidade}${exp.estado ? '/' + exp.estado : ''}` : null,
                      ].filter(Boolean).join('  ·  ')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Premiações: coletivas (pódio) e individuais, cada uma dentro do campeonato correspondente */}
          {(data.premiacoes || []).length > 0 ? (
            <View style={e.secao}>
              <Titulo texto="Premiações" nota={`${(data.premiacoes || []).length} no total`} e={e} />
              {gruposPremiacoes.map((g) => (
                <View key={g.campeonato} style={{ marginBottom: 8 }}>
                  <Text style={[e.td, { fontWeight: 800, marginBottom: 2 }]}>{limpar(g.campeonato)}</Text>
                  {g.itens.map((pr, i) => (
                    <View key={i} style={e.midia} wrap={false}>
                      <Text style={[e.td, { flex: 1, fontWeight: 700 }]}>{limpar(pr.titulo)}</Text>
                      {pr.detalhe ? <Text style={e.tdSuave}>{limpar(pr.detalhe)}</Text> : null}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : null}

          <Text style={[e.nota, { marginTop: 14 }]}>
            Dados registrados pela família e pelos colaboradores do atleta no Carreira ID. Os números refletem apenas o que foi lançado no perfil.
          </Text>
        </View>

        {/* Rodapé fixo com QR do perfil e numeração */}
        <View style={e.rodape} fixed>
          <View style={e.rodapeBarra} />
          {data.qrCodeUrl ? <Image src={data.qrCodeUrl} style={e.qr} /> : null}
          <View>
            <Text style={e.rodapeTitulo}>Perfil completo, jogos e vídeos</Text>
            <Text style={e.rodapeLink}>{link}</Text>
          </View>
          <Text
            style={e.rodapeDireita}
            render={({ pageNumber, totalPages }) =>
              `Gerado em ${dataGerado}${data.instagram && arroba(data.instagram) ? `  ·  ${arroba(data.instagram)}` : ''}\nPágina ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
